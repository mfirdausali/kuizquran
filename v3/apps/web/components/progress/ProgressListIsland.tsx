"use client";

// THE CLIENT ISLAND that turns the event log into progress rows.
//
// ---------------------------------------------------------------------------
// WHY THE LOG IS READ HERE AND NOT ON THE SERVER
// ---------------------------------------------------------------------------
// Edge case #72, and it is not stylistic. A server render has no IndexedDB, so
// every strength renders 0; the client then hydrates with the real values;
// React sees 0 vs 48 and in PRODUCTION silently keeps the wrong one. "0%" shown
// to a learner who is carrying an ayah is a retention-honesty violation (§10:
// the numbers shown must be the numbers the scheduler uses), not a cosmetic
// bug. check-boundaries.mjs clause 2 enforces the split; this file is the
// client half of it.
//
// The CORPUS arrives as a prop from the server component, because corpus is
// server (it is static, cacheable, and identical for every learner). The LOG
// is read here. That is the whole of "Corpus is server. Log is client."
//
// ---------------------------------------------------------------------------
// THREE STATES, EXHAUSTIVELY
// ---------------------------------------------------------------------------
// `status` is switched over all four LogState cases. `pending` paints
// SKELETONS — never the digit 0, never "—" (edge case #73: a pending read that
// paints 0 is the same lie as an SSR'd 0). `empty` is a DESIGNED zero-state,
// not `ready` with an empty array.
//
// Note what `empty` means for THIS island: an empty LOG, not an empty table.
// A learner with no events still has 221 atoms' worth of memory graph ahead of
// them, so the empty state still renders the full table — every row simply
// reads "Not started". Hiding the table would hide the map.

import { useCallback } from "react";
import type { Corpus } from "@engine/types.ts";
import { rebuild } from "@engine/rebuild.ts";
import { getEventsForSurah, useLogState } from "@/lib/idb";
import type { LocalEventRow } from "@/lib/idb";
import { buildProgressRows, type ProgressRow } from "@/lib/progress/rows";
import { ProgressTable } from "./ProgressTable";

interface ProgressListIslandProps {
  corpus: Corpus;
  /** Passed in rather than read from a clock, so a test can freeze it and the
   *  island stays as pure as everything under it. */
  now: number;
}

export function ProgressListIsland({ corpus, now }: ProgressListIslandProps) {
  const surah = corpus.meta.surah;

  // Stable identity: an inline arrow would be a new function every render and
  // the effect would re-run forever.
  const selector = useCallback(() => getEventsForSurah(surah), [surah]);
  // What "empty" means for THIS selector, stated explicitly — the hook refuses
  // a truthiness default because `0` and `[]` are legitimate VALUES elsewhere.
  const isEmpty = useCallback((rows: LocalEventRow[]) => rows.length === 0, []);

  const state = useLogState<LocalEventRow[]>(selector, isEmpty, [surah]);

  switch (state.status) {
    case "pending":
      // Skeletons are never zeros. The table's SHAPE is painted so the layout
      // does not jump, but not one number is claimed.
      return (
        <div className="stack stack--tight" aria-busy="true">
          <p className="caption">
            <span className="skel" aria-hidden="true" />{" "}
            <span className="sr-only">Reading your progress…</span>
            reading your progress…
          </p>
          <div className="stack stack--tight" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="skel skel--row" />
            ))}
          </div>
        </div>
      );

    case "empty":
      // A designed zero-state that STILL SHOWS THE MAP. Every row reads "Not
      // started", which is the truth and is more useful than an empty screen:
      // the learner sees the shape of what is ahead, joints included.
      return (
        <>
          <p className="caption">
            Nothing recorded for this surah on this device yet — so every item
            below is still ahead of you.
          </p>
          <ProgressTable rows={rowsFor(corpus, [], now)} />
        </>
      );

    case "ready":
      return <ProgressTable rows={rowsFor(corpus, state.data, now)} />;

    case "broken":
      // Each reason gets its own copy — "you're in private browsing" and
      // "another tab is mid-upgrade" are not the same problem.
      return (
        <div className="banner banner--warn" role="alert">
          <p>Your progress could not be read on this device.</p>
          <p className="sub">
            Reason: <code>{state.reason}</code>. Nothing has been lost — the log
            is append-only and re-readable once storage recovers.
          </p>
        </div>
      );
  }
}

/** Fold the log into atoms, then into rows. `rebuild()` is the engine's own
 *  fold — the app never re-implements strength math, it asks for it. */
function rowsFor(corpus: Corpus, events: LocalEventRow[], now: number): ProgressRow[] {
  const atoms = rebuild(events);
  return buildProgressRows({ corpus, atoms, events, now });
}
