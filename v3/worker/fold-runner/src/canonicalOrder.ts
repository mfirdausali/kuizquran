// v3-D09: "Canonical event order — (ts, deviceId, deviceSeq, uuid). Never
// `ts` alone — clocks skew and milliseconds tie. deviceSeq is per-device
// monotonic, assigned at emit." Why it matters (v3-D09's own words):
// `v2/src/db/eventLog.ts:113` drops the incoming `seq` on merge, so the
// client re-assigns a fresh LOCAL one and log order becomes arrival order.
// The server has the identical problem from the opposite direction: it
// receives events from however many devices in whatever order the network
// delivers them, and must fold them in ONE canonical order regardless —
// this file is that canonicalization, proven arrival-order-invariant by
// test/canonicalOrder.test.ts.

import type { DrillEvent } from "../../../packages/engine/src/types.ts";

function cmp(a: string | number, b: string | number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * A NEW array, sorted by (ts, deviceId, deviceSeq, uuid) ascending. Never
 * mutates its input. Missing deviceId/deviceSeq/id (pre-selection-era
 * events, edge case #58) sort as if `""`/`0`/`""` — still a TOTAL,
 * deterministic order, never a crash.
 */
export function canonicalOrder(events: DrillEvent[]): DrillEvent[] {
  return [...events].sort((a, b) => {
    return (
      cmp(a.ts, b.ts) ||
      cmp(a.deviceId ?? "", b.deviceId ?? "") ||
      cmp(a.deviceSeq ?? 0, b.deviceSeq ?? 0) ||
      cmp(a.id ?? "", b.id ?? "")
    );
  });
}
