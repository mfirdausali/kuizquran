"use client";

// THE DASHBOARD'S "MY SURAHS" BLOCK — WIREFRAME §1, edge cases #97 and #98.
//
// ---------------------------------------------------------------------------
// #97 — THE ZERO STATE LEADS WITH SOMEWHERE TO GO, NEVER AN EMPTY BOX
// ---------------------------------------------------------------------------
//   "Zero-state dashboard | fe | empty box | leads with recommender + library
//    (§12)"
//
// A learner arriving with nothing enrolled must not be shown a card that says
// "0 surahs" and stops. §12's rule is that the zero state leads with the
// recommender and the library — i.e. with the NEXT ACTION — and that there is
// no "Continue" CTA when there is nothing to continue, because a Continue
// button that starts nothing is the dashboard lying about what it has.
//
// The recommender proper is build-plan step 30 and is deliberately last. What
// stands in for it here is the honest subset: the surahs this build can
// actually teach, in the order onboarding offers them, each a real link. That
// is a recommendation made of facts rather than a placeholder box.
//
// ---------------------------------------------------------------------------
// #98 — RETURNING AFTER WEEKS SAYS WHAT WAS DEFERRED
// ---------------------------------------------------------------------------
//   "Returning after weeks | fe | silent queue cap | makeup messaging says what
//    was deferred"
//
// The failure this prevents is silent: a learner returns after three weeks, the
// scheduler caps the session to a workable size, and the dashboard shows a
// small number with no explanation. They conclude either that the app forgot
// their backlog or that three weeks cost them nothing. Both readings corrode
// exactly the trust the retention frame is built on.
//
// So when the gap since the last recorded activity is long, this component SAYS
// there is a backlog and says it will be spread rather than dumped. It does NOT
// compute the queue: `assembleQueue` is the engine's, the cap is the engine's,
// and naming either here would be an engine decision in a view
// (`check-boundaries.mjs` clause 5). What a view may honestly report is the
// LOG's own fact — how long since the last event — which is what it does.
//
// ---------------------------------------------------------------------------
// SKELETONS ARE NEVER ZEROS (#73)
// ---------------------------------------------------------------------------
// `status` is switched exhaustively. `pending` paints a skeleton, never a
// digit; `empty` is the DESIGNED zero state, not `ready` with nothing in it.

import { useCallback } from "react";
import Link from "next/link";
import { getAllEvents, useLogState } from "@/lib/idb";
import { OFFERED_SURAHS, surahLabel } from "@/lib/onboarding/surahs";

/** What the dashboard needs from the log, and nothing more. Reading the whole
 *  log to derive two numbers is affordable at this size and is honest about
 *  where the truth lives; when the atom cache lands this selector changes and
 *  no view does. */
interface Summary {
  events: number;
  /** Milliseconds since the most recent event, or null when there are none. */
  sinceLastMs: number | null;
}

/** A gap long enough that the learner will notice the schedule reacting to it.
 *  Presentation-side only: it decides what SENTENCE to show, never what the
 *  scheduler does. The engine's own make-up rule (gap >= 2 learning-days) is
 *  the engine's and is not restated here. */
const LONG_ABSENCE_MS = 14 * 24 * 60 * 60 * 1000;

export function MySurahs() {
  const selector = useCallback(async (): Promise<Summary> => {
    const events = await getAllEvents();
    if (events.length === 0) return { events: 0, sinceLastMs: null };
    let latest = 0;
    for (const e of events) {
      const ts = typeof e.ts === "number" ? e.ts : 0;
      if (ts > latest) latest = ts;
    }
    return { events: events.length, sinceLastMs: latest > 0 ? Date.now() - latest : null };
  }, []);

  const isEmpty = useCallback((s: Summary) => s.events === 0, []);
  const state = useLogState<Summary>(selector, isEmpty, []);

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
      // #97. No "Continue", because there is nothing to continue. Lead with
      // where to go instead.
      return (
        <div className="stack stack--tight">
          <p className="caption">
            Nothing on this device yet. Start with one surah — the app will tell
            you what it costs per day before you commit.
          </p>
          <nav aria-label="Surahs you can start">
            {OFFERED_SURAHS.map((s) => (
              <Link key={s.surah} href={`/surah/${s.surah}`} className="row-link">
                <span>{surahLabel(s)}</span>
                <span className="meta-line">start</span>
              </Link>
            ))}
          </nav>
          <Link href="/library" className="btn hit">
            Browse the library
          </Link>
        </div>
      );

    case "ready": {
      const longAbsence =
        state.data.sinceLastMs !== null && state.data.sinceLastMs >= LONG_ABSENCE_MS;
      const days =
        state.data.sinceLastMs === null
          ? null
          : Math.floor(state.data.sinceLastMs / (24 * 60 * 60 * 1000));
      return (
        <div className="stack stack--tight">
          <p className="caption">
            {state.data.events} event{state.data.events === 1 ? "" : "s"} recorded
            on this device.
          </p>
          {longAbsence && days !== null ? (
            // #98. Name the gap, and say what happens to the backlog — before
            // the learner opens a session and finds it shorter than they feared
            // or longer than they hoped.
            <div className="banner banner--warn" role="status">
              <p>It has been about {days} days.</p>
              <p className="sub">
                Everything you were holding is still here, and some of it has
                decayed. Your next sessions will work through the backlog a
                piece at a time instead of handing you all of it at once — and
                nothing was deleted for being late.
              </p>
            </div>
          ) : null}
        </div>
      );
    }

    case "broken":
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
