// Last-active-day (v2-BUG-2 fix). v1's useSession.ts hardcoded
// `lastActiveDay: null` into assembleQueue, so the make-up merge (FR3 step 1)
// never fired live — the "never dropped" guarantee only existed in tests. This
// derives the real value straight from the append-only event log (invariant #2:
// events are truth), so the session caller has no excuse to hardcode it again.
// Pure — no clock, no IO; `events` is whatever the caller already read from the log.
//
// v3-D259 — "active" means the learner RETRIEVED something in a structured
// session, never merely that some event carries a recent `ts`. The make-up
// merge fires only on a gap of >= 2 learning-days, so any audit-only event
// stamped "now" silently switched it off for a churned learner: the
// `interruption` `acknowledgeReentry` writes on a stale-tab re-entry, a
// `session_start` from a session opened and abandoned, a read-only Test
// (`test_*`), a planned-absence toggle (`day_marked_away`), an `adoption`
// audit row. The counted set is exactly the event types `rebuild.ts` folds as
// retrieval evidence, and only when structured — invariant #5: free-play is
// evidence only and never moves lifecycle, so it cannot move this either.

import type { DrillEvent, EventType } from "./types.ts";

/** The event types `rebuild.ts#applyEvent` folds as a retrieval outcome. */
const RETRIEVAL_EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  "tap",
  "reconstruct_tap",
  "rung_complete",
  "ayah_produced",
  "gate_result",
  "junction_result",
  "chain_step",
]);

/** Whether an event is structured retrieval evidence — the only kind of event
 *  that makes a learning-day "active" (same `structured !== false` default
 *  `rebuild.ts#isStructured` uses). */
export function isRetrievalActivity(e: DrillEvent): boolean {
  return RETRIEVAL_EVENT_TYPES.has(e.type) && e.structured !== false;
}

/**
 * The ms timestamp of the most recent structured retrieval in the log, or null
 * if there is none (a brand-new learner has no "last active day" yet). Any ms
 * within a learning-day is equivalent for assembleQueue's purposes (it only
 * compares via learning-day-aligned arithmetic in daybound.ts), so the raw max
 * `ts` suffices — no need to snap it to the day's start here.
 */
export function lastActiveDayMs(events: DrillEvent[]): number | null {
  let max = -Infinity;
  for (const e of events) if (isRetrievalActivity(e) && e.ts > max) max = e.ts;
  return max === -Infinity ? null : max;
}
