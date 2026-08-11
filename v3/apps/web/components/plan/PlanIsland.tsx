"use client";

// THE CLIENT ISLAND behind the plan calendar.
//
// The forecast is LOG-DERIVED — what is due today, how much remains, how fast
// the learner is actually going. So it is read here and not on the server
// (edge case #72: a server render has no log and would paint a confident
// forecast built from zero events, which is a worse lie than a skeleton).
//
// The corpus arrives as a prop. Corpus is server; log is client.
//
// WHAT THIS ISLAND DOES NOT DO: decide a zone, round a number, or choose a
// finish date. All of that is `lib/plan/forecast.ts`. This file folds the log
// into atoms, counts what is left, and hands the numbers over.

import { useCallback } from "react";
import type { Corpus } from "@engine/types.ts";
import type { AtomState } from "@engine/atom.ts";
import { rebuild } from "@engine/rebuild.ts";
import { atomKey } from "@engine/atom.ts";
import { currentBand } from "@engine/strength.ts";
import { getEventsForSurah, useLogState } from "@/lib/idb";
import type { LocalEventRow } from "@/lib/idb";
import { buildForecast, type EnrolledSurah } from "@/lib/plan/forecast";
import { PlanCalendar } from "./PlanCalendar";

interface PlanIslandProps {
  corpus: Corpus;
  now: number;
  tz: string;
  /** The learner's daily commitment. From the pace mode once that persists
   *  (M6); the engine's Steady default until then. */
  minutesPerDay: number;
}

export function PlanIsland({ corpus, now, tz, minutesPerDay }: PlanIslandProps) {
  const surah = corpus.meta.surah;
  const selector = useCallback(() => getEventsForSurah(surah), [surah]);
  const isEmpty = useCallback((rows: LocalEventRow[]) => rows.length === 0, []);
  const state = useLogState<LocalEventRow[]>(selector, isEmpty, [surah]);

  switch (state.status) {
    case "pending":
      // Skeletons are never zeros (#73). A forecast is a number-dense surface,
      // so painting it early is painting it wrong.
      return (
        <p className="caption" aria-busy="true">
          <span className="skel" aria-hidden="true" />{" "}
          <span className="sr-only">Working out your plan…</span>
          working out your plan…
        </p>
      );

    case "empty":
      // A designed zero-state. There is genuinely no forecast to make from no
      // events — and saying so is more honest than projecting a schedule for
      // a learner who has not started.
      return (
        <p className="caption">
          Nothing recorded yet, so there is no pace to project from. Your plan
          appears after your first session.
        </p>
      );

    case "ready": {
      const atoms = rebuild(state.data);
      return (
        <PlanCalendar
          forecast={buildForecast({
            now,
            tz,
            minutesPerDay,
            enrolled: [enrolmentOf(corpus, atoms, now)],
            dueToday: dueToday(corpus, atoms, now),
            // Marking a day away is a WRITE, and the write path (an event
            // type, an outbox row) is M6's. The forecast already redistributes
            // around away days — the mechanism is here, the control is not.
            awayDays: [],
          })}
        />
      );
    }

    case "broken":
      return (
        <div className="banner banner--warn" role="alert">
          <p>Your plan could not be worked out on this device.</p>
          <p className="sub">
            Reason: <code>{state.reason}</code>. Nothing has been lost — the log
            is append-only and re-readable once storage recovers.
          </p>
        </div>
      );
  }
}

/** How much of this surah is left to carry. "Remaining" means NOT YET IN THE
 *  CARRY BAND — an ayah at 60% is still work, and counting it as done is how
 *  an ETA quietly becomes optimistic. */
function enrolmentOf(corpus: Corpus, atoms: Map<string, AtomState>, now: number): EnrolledSurah {
  const surah = corpus.meta.surah;
  let remaining = 0;
  for (let ayah = 1; ayah <= corpus.meta.ayahCount; ayah++) {
    const atom = atoms.get(atomKey(surah, "ayah", ayah));
    // The band comes from the engine, already decayed to `now`. Nothing here
    // compares a strength to a threshold.
    if (!atom || currentBand(atom, now) !== "carry") remaining += 1;
  }
  return {
    surah,
    remainingAyat: remaining,
    avgWordsPerAyah: Math.max(1, Math.round(corpus.meta.wordCount / corpus.meta.ayahCount)),
  };
}

/** What is actually due right now — the only day genuinely knowable, which is
 *  precisely why it is the only day that gets named items. */
function dueToday(corpus: Corpus, atoms: Map<string, AtomState>, now: number) {
  const surah = corpus.meta.surah;
  const gates: { surah: number; ayah: number }[] = [];
  const learn: { surah: number; ayah: number }[] = [];
  let reviews = 0;

  for (let ayah = 1; ayah <= corpus.meta.ayahCount; ayah++) {
    const atom = atoms.get(atomKey(surah, "ayah", ayah));
    if (!atom) {
      // The next unencoded ayah is the one that gets learned. Only the first,
      // because the Steady pace unlocks one new ayah a day.
      if (learn.length === 0) learn.push({ surah, ayah });
      continue;
    }
    if (atom.gateDueAt !== null && !atom.gatePassed && atom.gateDueAt <= now) {
      gates.push({ surah, ayah });
    } else if (atom.encoded && currentBand(atom, now) !== "carry") {
      reviews += 1;
    }
  }
  return { gates, reviews, learn };
}
