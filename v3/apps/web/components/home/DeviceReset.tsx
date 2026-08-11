"use client";

// DEVICE RESET — edge case #104.
//
//   "Device reset / new learner | fe | destructive action | confirm enumerates
//    N surahs of loss"
//
// ---------------------------------------------------------------------------
// WHY A COUNT IS NOT AN ENUMERATION
// ---------------------------------------------------------------------------
// The requirement is not "ask are you sure". It is that the confirm ENUMERATES
// what will be lost, and it says so because "are you sure?" is the dialog
// everyone clicks through. A learner handing their phone to a family member,
// or genuinely starting over, cannot make that decision from a generic warning
// — they need to see that it is 3 surahs and 1,400 taps, not "some data".
//
// So this component READS THE LOG FIRST and shows the real numbers, and the
// destructive button does not exist until those numbers are on screen. A
// confirm rendered before the read has finished would be a confirm about an
// unknown quantity, which is the same defect in slower clothing.
//
// ---------------------------------------------------------------------------
// WHY IT NAMES SYNC EXPLICITLY
// ---------------------------------------------------------------------------
// The log is the truth and it is append-only, but "append-only" is a property
// of the STORE, not a promise that the bytes exist elsewhere. Unsynced events
// live on this device alone. Clearing local storage destroys exactly those, and
// no support ticket can reconstruct them (the sync path is idempotent by
// client-stamped uuid — an event that never left is an event nobody has).
//
// The honest confirm therefore distinguishes what is recoverable from what is
// not. Saying "you can sign in again later" without that distinction would be
// the most damaging kind of half-truth this surface could tell.
//
// NOTHING IS DELETED HERE YET. This build has no account adoption and no
// server-side identity to restore from, so a working reset button would be an
// irreversible action with no recovery path behind it. What ships is the
// enumeration — the part #104 is actually about — with the action disabled and
// the reason stated. A destructive control that works before its recovery path
// exists is worse than one that waits.

import { useCallback } from "react";
import { getAllEvents, useLogState } from "@/lib/idb";

interface ResetScope {
  events: number;
  /** Distinct surahs with at least one event — the "N surahs" #104 names. */
  surahs: number[];
  /** Events not yet accepted by the server: the genuinely unrecoverable part. */
  unsynced: number;
}

export function DeviceReset() {
  const selector = useCallback(async (): Promise<ResetScope> => {
    const events = await getAllEvents();
    const surahs = new Set<number>();
    let unsynced = 0;
    for (const e of events) {
      if (typeof e.surah === "number") surahs.add(e.surah);
      // `syncedAt == null` means pending — the interpretation lib/sync owns.
      if (e.syncedAt === null || e.syncedAt === undefined) unsynced++;
    }
    return {
      events: events.length,
      surahs: [...surahs].sort((a, b) => a - b),
      unsynced,
    };
  }, []);

  const isEmpty = useCallback((s: ResetScope) => s.events === 0, []);
  const state = useLogState<ResetScope>(selector, isEmpty, []);

  switch (state.status) {
    case "pending":
      return (
        <p className="caption">
          <span className="skel" aria-hidden="true" />{" "}
          <span className="sr-only">Working out what is on this device…</span>
          working out what is on this device…
        </p>
      );

    case "empty":
      // Nothing to lose, so nothing to warn about. A reset offered here would
      // invent a decision the learner does not have to make.
      return (
        <p className="caption">
          There is nothing recorded on this device, so there is nothing to
          clear.
        </p>
      );

    case "ready":
      return (
        <div className="stack stack--tight">
          <p className="caption">Clearing this device would remove:</p>
          <ul style={{ margin: 0, paddingInlineStart: "1.1rem" }}>
            <li className="caption">
              {state.data.surahs.length} surah
              {state.data.surahs.length === 1 ? "" : "s"} of history
              {state.data.surahs.length > 0 ? (
                <>
                  {" "}
                  (
                  <span className="ltr-island">{state.data.surahs.join(", ")}</span>
                  )
                </>
              ) : null}
            </li>
            <li className="caption">
              {state.data.events} recorded event
              {state.data.events === 1 ? "" : "s"} — every tap, gate and review
              behind your schedule
            </li>
            <li className="caption">
              {state.data.unsynced} of those {state.data.unsynced === 1 ? "has" : "have"}{" "}
              not reached the server yet.{" "}
              {state.data.unsynced > 0
                ? "Those cannot be recovered by anyone, including us."
                : "Everything else has been backed up."}
            </li>
          </ul>
          <button type="button" className="btn hit" disabled>
            Clear this device
          </button>
          <p className="caption">
            Disabled in this build: there is no account to restore from yet, so
            clearing would be permanent with no way back. It unlocks together
            with sign-in.
          </p>
        </div>
      );

    case "broken":
      return (
        <div className="banner banner--warn" role="alert">
          <p>What is on this device could not be read.</p>
          <p className="sub">
            Reason: <code>{state.reason}</code>. Nothing is offered for deletion
            while the contents are unknown — a reset that cannot say what it
            would destroy is not a choice anyone can make.
          </p>
        </div>
      );
  }
}
