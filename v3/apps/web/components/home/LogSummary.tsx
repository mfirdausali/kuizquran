"use client";

// A CLIENT ISLAND that reads the event log. WIREFRAME §1 (dashboard) and
// edge cases #72 / #73.
//
// This is the smallest honest thing the dashboard can say before the engine is
// wired: how many events the log holds, and therefore whether this device has
// any history at all. It is NOT the due-count — that requires assembleQueue
// over rebuilt atoms, which is step 19's work and which must arrive as DATA
// (check-boundaries.mjs clause 5 forbids it appearing in a view, which is how
// DEFECTS.md#B2 stays impossible by construction rather than merely fixed).
//
// TWO RULES ARE DEMONSTRATED HERE, and every later island must copy them:
//
// 1. NO IDB IN AN RSC (#72). This file carries "use client" and so must every
//    file that imports it, or check-boundaries.mjs clause 2 fails the build.
//    The reason is not stylistic: a server render has no log, so it renders 0;
//    the client hydrates with the real value; React sees 0 vs 4 and in
//    PRODUCTION silently paints the wrong number. "0 ayat due" shown to a
//    learner who has four is a retention-honesty violation (§10: the numbers
//    shown must be the numbers the scheduler uses).
//
// 2. SKELETONS ARE NEVER ZEROS (#73). `status` is switched EXHAUSTIVELY over
//    all four cases. `pending` paints a skeleton, never a digit. `empty` is a
//    DESIGNED zero-state, not `ready` with an empty array — conflating them is
//    exactly how a brand-new learner ends up staring at a skeleton forever.
//    Because LogState is a discriminated union under `strict`, forgetting a
//    case is a TYPE ERROR, not a runtime surprise.

import { useCallback } from "react";
import { countEvents, useLogState } from "@/lib/idb";

export function LogSummary() {
  // Stable identity: an inline arrow would be a new function every render and
  // the effect would re-run forever.
  const selector = useCallback(() => countEvents(), []);
  // What "empty" means for THIS selector, stated explicitly. `0` is a
  // legitimate non-empty VALUE for other selectors, which is why the hook
  // refuses a truthiness default.
  const isEmpty = useCallback((n: number) => n === 0, []);

  const state = useLogState<number>(selector, isEmpty, []);

  switch (state.status) {
    case "pending":
      return (
        <p className="caption">
          <span className="skel" aria-hidden="true" />{" "}
          <span className="sr-only">Reading your history…</span>
          reading your history…
        </p>
      );

    case "empty":
      // The designed zero-state. Per WIREFRAME §12: no "Continue" CTA when
      // there is nothing to continue — lead with the library instead.
      return (
        <p className="caption">
          Nothing recorded on this device yet. Pick a surah in the Library to
          begin.
        </p>
      );

    case "ready":
      return (
        <p className="caption">
          {state.data} event{state.data === 1 ? "" : "s"} recorded on this
          device.
        </p>
      );

    case "broken":
      // The hard-fail path. Each reason gets its OWN copy — "you're in private
      // browsing" and "another tab is mid-upgrade" are not the same problem
      // and must never share a message.
      return (
        <div className="banner banner--warn" role="alert">
          <p>Your history could not be read on this device.</p>
          <p className="sub">
            Reason: <code>{state.reason}</code>. Nothing has been lost — the log
            is append-only and re-readable once storage recovers.
          </p>
        </div>
      );
  }
}
