// Last-active-day (v2-BUG-2 fix). v1's useSession.ts hardcoded
// `lastActiveDay: null` into assembleQueue, so the make-up merge (FR3 step 1)
// never fired live — the "never dropped" guarantee only existed in tests. This
// derives the real value straight from the append-only event log (invariant #2:
// events are truth), so the session caller has no excuse to hardcode it again.
// Pure — no clock, no IO; `events` is whatever the caller already read from the log.

import type { DrillEvent } from "./types.ts";

/**
 * The ms timestamp of the most recent event in the log, or null if the log is
 * empty (a brand-new learner has no "last active day" yet). Any ms within a
 * learning-day is equivalent for assembleQueue's purposes (it only compares via
 * learning-day-aligned arithmetic in daybound.ts), so the raw max `ts` suffices —
 * no need to snap it to the day's start here.
 */
export function lastActiveDayMs(events: DrillEvent[]): number | null {
  if (events.length === 0) return null;
  let max = -Infinity;
  for (const e of events) if (e.ts > max) max = e.ts;
  return max;
}
