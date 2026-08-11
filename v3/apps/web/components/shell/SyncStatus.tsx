"use client";

// The "N pending" indicator — edge case #103.
//
//     | 103 | Outbox growth offline-for-days | fe | invisible risk | quiet
//       'N pending' indicator; NEVER BLOCKS A SESSION | M6 |
//
// TWO PROPERTIES, both load-bearing:
//
// 1. IT NEVER BLOCKS. This is a PASSIVE OBSERVER. It reads a count and paints
//    it. It does not trigger a flush, it does not await one, and no session
//    assembly / drill / grading path reads it. A learner mid-session is
//    unaffected by anything on this line.
//
// 2. SKELETONS ARE NEVER ZEROS (#73). The count goes through the SAME
//    three-state LogState model as every other log read, so a not-yet-read
//    count paints a SKELETON, never `0`. A pending indicator that paints "0
//    pending" while it is still counting is the same retention-honesty
//    violation as "0 ayat due" — it states a fact the app has not established.
//
// Quiet means quiet: a count and a state. Not a modal, not a toast, not a red
// badge. It is only ever ESCALATED for the two cases that genuinely need a
// human: a QUARANTINED event that can never sync (#110) and a #50 payload
// DIVERGENCE. Those are distinct counts, deliberately, because "waiting" and
// "cannot" are different facts and must not share a number.

import { useCallback } from "react";
import { useLogState } from "@/lib/idb/useLogState";
import { countPending } from "@/lib/sync/outbox";

export interface SyncStatusProps {
  /** Events that can never sync (#110 oversize). Surfaced as a DISTINCT count
   *  beside the pending one — "waiting" and "cannot" are different facts. */
  cannotSync?: number;
  /** #50 payload divergences observed on the pull. */
  divergences?: number;
}

export function SyncStatus({ cannotSync = 0, divergences = 0 }: SyncStatusProps) {
  // Stable identity: an inline arrow would be a new function every render and
  // the effect would re-run forever.
  const selector = useCallback(() => countPending(), []);
  // What "empty" means for THIS selector, stated explicitly — the hook refuses
  // a truthiness default because `0` is a legitimate value elsewhere. Here
  // zero pending IS the empty state: everything is synced.
  const isEmpty = useCallback((n: number) => n === 0, []);

  const state = useLogState<number>(selector, isEmpty, []);

  // The escalations are independent of the pending count's own state: a
  // divergence is worth saying even while the count is still loading.
  const escalation =
    cannotSync > 0 || divergences > 0 ? (
      <span className="caption" role="status">
        {cannotSync > 0 ? `${cannotSync} cannot sync` : null}
        {cannotSync > 0 && divergences > 0 ? " · " : null}
        {divergences > 0 ? `${divergences} need review` : null}
      </span>
    ) : null;

  switch (state.status) {
    case "pending":
      // A SKELETON, never a digit. We have not looked yet.
      return (
        <p className="caption">
          <span className="skel" aria-hidden="true" />{" "}
          <span className="sr-only">Checking what still needs to sync…</span>
          {escalation}
        </p>
      );

    case "empty":
      // Everything is synced. Designed zero-state, and deliberately calm —
      // "all synced" is the normal condition, not an achievement.
      return <p className="caption">All synced.{escalation ? <> {escalation}</> : null}</p>;

    case "ready":
      return (
        <p className="caption">
          {state.data} waiting to sync.{escalation ? <> {escalation}</> : null}
        </p>
      );

    case "broken":
      // The log could not be read. This says so without alarm: the local log
      // is truth and nothing has been lost — only the count is unavailable.
      return (
        <p className="caption">
          Sync status unavailable (<code>{state.reason}</code>). Your work is
          saved on this device.
        </p>
      );
  }
}
