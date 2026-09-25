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

import { useCallback, useEffect, useState } from "react";
import type { Corpus } from "@engine/types.ts";
import type { AtomState } from "@engine/atom.ts";
import { rebuild } from "@engine/rebuild.ts";
import { atomKey } from "@engine/atom.ts";
import { currentBand } from "@engine/strength.ts";
import { gateDue } from "@engine/gate.ts";
import { awayDayOffsets, dayIndexOf } from "@engine/awayDays.ts";
import { candidatesForPace, DEFAULT_PACE_MODE, paceConfig, type PaceMode } from "@engine/pace.ts";
import { currentTz, getEventsForSurah, useLogState, useWriterStatus } from "@/lib/idb";
import type { LocalEventRow } from "@/lib/idb";
import { readChoices } from "@/lib/onboarding/choices";
import { setDayAway } from "@/lib/plan/awayDay";
import { buildForecast, type EnrolledSurah } from "@/lib/plan/forecast";
import { EmptyPlanAwayList } from "./EmptyPlanAwayList";
import { PlanCalendar } from "./PlanCalendar";

interface PlanIslandProps {
  corpus: Corpus;
  now: number;
  tz: string;
  /** FALLBACK ONLY, used until the learner's real pace mode loads from
   *  onboarding choices (v3-D221) — client-only IndexedDB storage a server
   *  component cannot read, which is why this is a prop at all. The engine's
   *  Steady default. Once the read below resolves, the REAL choice — Sprint's
   *  16 min/day, Maintain's reviews-only 8 — replaces it, the same
   *  `choices.pace` read `SessionGate.tsx`/`TodaySession.tsx` already use
   *  (v3-D138) for the identical reason: a plan built on an assumed pace is
   *  exactly the "every ETA lies" failure E-06 was closed to prevent. */
  minutesPerDay: number;
}

export function PlanIsland({ corpus, now, tz, minutesPerDay: fallbackMinutesPerDay }: PlanIslandProps) {
  const surah = corpus.meta.surah;
  const selector = useCallback(() => getEventsForSurah(surah), [surah]);
  const isEmpty = useCallback((rows: LocalEventRow[]) => rows.length === 0, []);
  // Bumped after a successful away-day toggle so `useLogState` re-reads the
  // log — its own effect only re-runs on a `deps` change, never on a write
  // it has no way to know happened (it holds no live subscription).
  const [refreshNonce, setRefreshNonce] = useState(0);
  const state = useLogState<LocalEventRow[]>(selector, isEmpty, [surah, refreshNonce]);

  // v3-D221: the learner's REAL daily commitment, not always Steady's
  // assumed 8. Independent of the log read above — never blocks first paint
  // on it, and never re-runs on `refreshNonce` (a pace change persists
  // through onboarding's own screens, not through an away-day toggle).
  const [minutesPerDay, setMinutesPerDay] = useState(fallbackMinutesPerDay);
  // v3-D238: the raw mode too, not just its minute budget — `dueToday` below
  // needs `newAyahCeiling` (Sprint=3, Maintain=0), a fact `minutesPerDay`
  // alone cannot carry (Maintain and Steady share the same 8 min/day but
  // differ completely in what they may unlock).
  const [paceMode, setPaceMode] = useState<PaceMode>(DEFAULT_PACE_MODE);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const choices = await readChoices();
      if (!alive) return;
      const mode = choices?.pace ?? DEFAULT_PACE_MODE;
      setMinutesPerDay(paceConfig(mode).budgetMin);
      setPaceMode(mode);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // WIREFRAME §14 "Planned absences": commits through the SAME
  // commit-before-paint `append()` every other event uses, then forces the
  // log re-read above. `offset` is resolved against THIS render's own `now`
  // — the same `now` `awayDayOffsets` below reads it back against — so a
  // toggle written now always lands on the day currently shown at `offset`.
  //
  // v3-D226: `append()` re-asserts writer status at commit time
  // (`lib/idb/writeLock.ts#assertWriter`, edge case #75) and throws
  // `NotWriterError` for any tab that does not hold the lock —
  // `SessionIsland.tsx`/`TestIsland.tsx` both guard their own commit paths
  // against exactly that. This one did not: a stale `canWrite` snapshot
  // (the lock changed hands between render and click) must not surface as
  // an unhandled promise rejection with a silently-inert button — caught
  // here and swallowed, since `writeLock`'s own subscription below is what
  // actually keeps the affordance honest render to render.
  const writer = useWriterStatus();
  const canWrite = writer.role === "writer";
  const handleToggleAway = useCallback(
    async (offset: number, away: boolean) => {
      try {
        await setDayAway(surah, dayIndexOf(now) + offset, away, { now: Date.now(), tz: currentTz() });
      } catch {
        return;
      }
      setRefreshNonce((n) => n + 1);
    },
    [surah, now],
  );

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
      // a learner who has not started. But marking a future day away (v3-D220)
      // needs no forecast at all — only the toggle itself — so it is offered
      // here too, rather than making a learner wait for a first session just
      // to book known travel.
      return (
        <div className="stack">
          <p className="caption">
            Nothing recorded yet, so there is no pace to project from. Your
            plan appears after your first session.
          </p>
          <EmptyPlanAwayList now={now} tz={tz} onToggleAway={canWrite ? handleToggleAway : undefined} />
        </div>
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
            dueToday: dueToday(corpus, atoms, now, paceMode),
            // v3-D207: read straight off the same log this island already
            // holds — the day_marked_away toggle `handleToggleAway` writes.
            awayDays: awayDayOffsets(state.data, now),
          })}
          onToggleAway={canWrite ? handleToggleAway : undefined}
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
 *  precisely why it is the only day that gets named items.
 *
 *  Exported for `test/plan-due-today.test.ts` only, which pins two
 *  delegations: (1) `gate.ts#gateDue()` rather than re-deriving its own copy
 *  of the predicate, and (2) `pace.ts#candidatesForPace()` for how many new
 *  ayat the `learn` list may name — Steady's ceiling of 1 is NOT universal
 *  (Sprint=3, Maintain=0) — rather than a second, pace-blind cap. Both are
 *  the "tested resolver exists, the caller re-derives it inline" shape this
 *  build has repeatedly closed elsewhere (v3-D227, v3-D238). `pace` defaults
 *  to Steady so every pre-existing caller/test is unchanged. */
export function dueToday(
  corpus: Corpus,
  atoms: Map<string, AtomState>,
  now: number,
  pace: PaceMode = DEFAULT_PACE_MODE,
) {
  const surah = corpus.meta.surah;
  const gates: { surah: number; ayah: number }[] = [];
  const learnCandidates: number[] = [];
  let reviews = 0;

  for (let ayah = 1; ayah <= corpus.meta.ayahCount; ayah++) {
    const atom = atoms.get(atomKey(surah, "ayah", ayah));
    // `gateDue` is asked FIRST, for any atom that exists, so the delegation
    // `plan-due-today.test.ts` pins stays discriminating: an inline copy
    // lacking `gateDue`'s own `encoded` term would still be caught listing a
    // stray `gateDueAt` on an un-encoded atom.
    if (atom && gateDue(atom, now)) {
      gates.push({ surah, ayah });
    } else if (!atom || !atom.encoded) {
      // Every unencoded ayah is a real candidate — mirroring `run.ts
      // #learnCandidatesFor`'s own shape — capped below to the mode's actual
      // ceiling, never to a hardcoded 1. v3-D252: "unencoded" includes an
      // atom row that EXISTS with `encoded: false` (a demoted ayah, or an
      // abandoned Learn pass) — such an atom is never a gate (`gateDue`
      // requires `encoded`) nor a review (below), so the old `!atom`-only
      // test listed it nowhere at all.
      learnCandidates.push(ayah);
    } else if (currentBand(atom, now) !== "carry") {
      reviews += 1;
    }
  }
  const learn = candidatesForPace(learnCandidates, pace).map((ayah) => ({ surah, ayah }));
  return { gates, reviews, learn };
}
