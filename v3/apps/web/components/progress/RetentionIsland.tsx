"use client";

// THE CLIENT ISLAND that turns the event log into the retention summary.
//
// ---------------------------------------------------------------------------
// WHY THE LOG IS READ HERE AND NOT ON THE SERVER
// ---------------------------------------------------------------------------
// Edge case #72, and on THIS route it is the sharpest version of it. A server
// render has no IndexedDB, so every atom folds to 0: the half-life headline
// would render "—", the distribution would read 100% "Not started", and
// slipping would read zero. The client then hydrates with the truth, and in
// PRODUCTION React silently keeps the server's markup — leaving a learner
// looking at a clean board while the scheduler believes three ayat are going.
//
// That is WIREFRAME §10's named failure ("an app that shows a green dashboard
// while its own scheduler thinks the learner is lapsing has lied to them"), not
// a cosmetic hydration nit. check-boundaries.mjs clauses 1-2 enforce the split;
// this file is the client half of it, and the "use client" directive is on line
// 1 because `isClient()` only reads the first five lines.
//
// The CORPUS arrives as a prop from the server component. The LOG is read here.
// "Corpus is server. Log is client."
//
// ---------------------------------------------------------------------------
// FOUR STATES, EXHAUSTIVELY — edge case #73
// ---------------------------------------------------------------------------
// `pending` paints `.skel` and claims NO number. A half-life headline or a band
// count painted while the log is still opening is a false claim, not a loading
// state — and on this panel the false claim is specifically "nothing is
// slipping". `empty` is a DESIGNED zero-state, not `ready` with an empty map:
// it still shows the shape of the graph ahead, with every figure honestly
// unmeasured. `broken` says so, because a silent fallback to the empty state
// would be indistinguishable from a learner who genuinely has no history.

import { useCallback } from "react";

import type { Corpus } from "@engine/types.ts";
import { rebuild } from "@engine/rebuild.ts";
import { getEventsForSurah, useLogState } from "@/lib/idb";
import type { LocalEventRow } from "@/lib/idb";
import { buildRetentionSummary } from "@/lib/progress/retention";
import { RetentionPanel } from "./RetentionPanel";

interface RetentionIslandProps {
  corpus: Corpus;
  /** Resolved once on the server and passed down, so every figure in one
   *  render decays to the same instant. */
  now: number;
  /** The instant "since" is measured from — one week back, decided by the page
   *  and passed in so this island reads no clock of its own. */
  since: number;
}

export function RetentionIsland({ corpus, now, since }: RetentionIslandProps) {
  const surah = corpus.meta.surah;

  // Stable identity: an inline arrow would be a new function every render and
  // the effect would re-run forever.
  const selector = useCallback(() => getEventsForSurah(surah), [surah]);
  const isEmpty = useCallback((rows: LocalEventRow[]) => rows.length === 0, []);

  const state = useLogState<LocalEventRow[]>(selector, isEmpty, [surah]);

  switch (state.status) {
    case "pending":
      // Skeletons are never zeros (#73). The panel's SHAPE is painted so the
      // layout does not jump, but not one figure is claimed.
      return (
        <div className="stack stack--tight" aria-busy="true">
          <p className="caption">
            <span className="skel" aria-hidden="true" />{" "}
            <span className="sr-only">Reading your progress…</span>
            reading your progress…
          </p>
          <div className="stack stack--tight" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="skel skel--row" />
            ))}
          </div>
        </div>
      );

    case "empty":
      // A designed zero-state that STILL SHOWS THE SHAPE. The half-life reads
      // "—" (not "0 days") and the distribution reads "Not started" across the
      // whole graph, which is the truth and is more useful than a blank card.
      return (
        <>
          <p className="caption">
            Nothing recorded for this surah on this device yet — so there is no
            decay to report, and everything below is still ahead of you.
          </p>
          <RetentionPanel summary={summaryFor(corpus, [], now, since)} />
        </>
      );

    case "ready":
      return <RetentionPanel summary={summaryFor(corpus, state.data, now, since)} />;

    case "broken":
      return (
        <div className="banner banner--warn" role="alert">
          <p>Your retention figures could not be read on this device.</p>
          <p className="sub">
            Reason: <code>{state.reason}</code>. Nothing has been lost — the log
            is append-only and re-readable once storage recovers.
          </p>
        </div>
      );
  }
}

/** Fold the log into atoms, then into the summary. `rebuild()` is the engine's
 *  own fold — the app never re-implements strength math, it asks for it. */
function summaryFor(corpus: Corpus, events: LocalEventRow[], now: number, since: number) {
  return buildRetentionSummary({ corpus, atoms: rebuild(events), events, now, since });
}
