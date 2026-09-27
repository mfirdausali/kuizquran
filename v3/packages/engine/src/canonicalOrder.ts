// v3-D09: the canonical event order — `(ts, deviceId, deviceSeq, id)`
// ascending, NEVER `ts` alone (clocks skew and milliseconds tie). Missing
// deviceId/deviceSeq/id (pre-selection-era events, edge case #58) sort as
// `""`/`0`/`""` — still a TOTAL, deterministic order, never a crash.
//
// THE ONE SHARED IMPLEMENTATION (v3-D261). Until this file existed, the
// identical comparator was hand-declared TWICE with no shared source: once
// in `apps/web/lib/idb/schema.ts` (the client's own IndexedDB cursor order,
// what a real learner's session assembly folds) and once in
// `worker/fold-runner/src/canonicalOrder.ts` (the server's fold and the
// nightly `fold_determinism_check` — a confirmed P1 there resets the
// 7-consecutive-green-nights launch gate). Each copy's own docblock merely
// ASSERTED the other agreed; nothing mechanically checked it, the exact
// "tested resolver exists, a caller re-derives it inline" shape this
// codebase has repeatedly closed elsewhere (`gradeClassToWire` v3-D83,
// `lastActiveDayMs` v3-D113, `digestsMatch` v3-D159, `gateStateOf`
// v3-D211/D212). Both files now import this module instead of re-declaring
// the rule, so a future edit to the tie-break order can no longer land on
// one side and not the other.

import type { DrillEvent } from "./types.ts";

/** The subset of `DrillEvent` this ordering actually reads. */
type CanonicalOrderable = Pick<DrillEvent, "ts" | "deviceId" | "deviceSeq" | "id">;

/** The canonical sort key for an event: `(ts, deviceId, deviceSeq, id)`. */
export function canonicalKey(e: CanonicalOrderable): [number, string, number, string] {
  return [e.ts, e.deviceId ?? "", e.deviceSeq ?? 0, e.id ?? ""];
}

/** Compare two events in canonical order. */
export function compareCanonical(a: CanonicalOrderable, b: CanonicalOrderable): number {
  const ka = canonicalKey(a);
  const kb = canonicalKey(b);
  for (let i = 0; i < ka.length; i++) {
    const x = ka[i]!;
    const y = kb[i]!;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * A NEW array, sorted by `(ts, deviceId, deviceSeq, id)` ascending. Never
 * mutates its input.
 */
export function canonicalOrder<T extends CanonicalOrderable>(events: T[]): T[] {
  return [...events].sort(compareCanonical);
}
