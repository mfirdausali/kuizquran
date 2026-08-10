// v3-D09: the canonical event order is (ts, deviceId, deviceSeq, uuid),
// NEVER `ts` alone — clocks skew and milliseconds tie. This is the fold-
// runner's own half of the fix for `v2/src/db/eventLog.ts:113`'s bug
// (DEFECTS.md#B5 in spirit — arrival order becomes fold order): the
// SERVER receives events in whatever order they arrive over the network,
// from however many devices, and must fold them in one canonical order
// regardless — proving arrival-order-INVARIANCE is the actual guarantee
// that matters, not just that sorting exists.

import { describe, expect, it } from "vitest";
import { canonicalOrder } from "../src/canonicalOrder.ts";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";

function ev(partial: Partial<DrillEvent> & { ts: number }): DrillEvent {
  return { type: "session_start", surah: 12, ayah: 1, rung: "S1", ...partial };
}

/** Deterministic (seeded) Fisher-Yates — no Math.random. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe("canonicalOrder — v3-D09's (ts, deviceId, deviceSeq, uuid)", () => {
  it("orders primarily by ts", () => {
    const a = ev({ id: "a", ts: 300 });
    const b = ev({ id: "b", ts: 100 });
    const c = ev({ id: "c", ts: 200 });
    expect(canonicalOrder([a, b, c]).map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks a ts tie by deviceId", () => {
    const a = ev({ id: "a", ts: 100, deviceId: "zzz" });
    const b = ev({ id: "b", ts: 100, deviceId: "aaa" });
    expect(canonicalOrder([a, b]).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("breaks a (ts, deviceId) tie by deviceSeq", () => {
    const a = ev({ id: "a", ts: 100, deviceId: "d1", deviceSeq: 5 });
    const b = ev({ id: "b", ts: 100, deviceId: "d1", deviceSeq: 2 });
    expect(canonicalOrder([a, b]).map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("breaks a full (ts, deviceId, deviceSeq) tie by uuid (id)", () => {
    const a = ev({ id: "zzz", ts: 100, deviceId: "d1", deviceSeq: 1 });
    const b = ev({ id: "aaa", ts: 100, deviceId: "d1", deviceSeq: 1 });
    expect(canonicalOrder([a, b]).map((e) => e.id)).toEqual(["aaa", "zzz"]);
  });

  it("never mutates the input array", () => {
    const a = ev({ id: "a", ts: 300 });
    const b = ev({ id: "b", ts: 100 });
    const input = [a, b];
    canonicalOrder(input);
    expect(input).toEqual([a, b]);
  });

  it("handles pre-selection-era events missing deviceId/deviceSeq/id (edge case #58) without crashing, total order", () => {
    const bare = ev({ ts: 100 });
    const full = ev({ id: "x", ts: 100, deviceId: "d1", deviceSeq: 1 });
    expect(() => canonicalOrder([bare, full])).not.toThrow();
    expect(canonicalOrder([bare, full]).length).toBe(2);
  });

  it("is ARRIVAL-ORDER INVARIANT: any shuffle of the same event set canonical-orders to the identical sequence", () => {
    const events: DrillEvent[] = Array.from({ length: 25 }, (_, i) =>
      ev({
        id: `e${i}`,
        ts: 1000 + ((i * 37) % 500), // non-monotonic ts on purpose
        deviceId: i % 3 === 0 ? "device-a" : i % 3 === 1 ? "device-b" : "device-c",
        deviceSeq: i,
      }),
    );
    const canonical = canonicalOrder(events).map((e) => e.id);

    for (let seed = 0; seed < 15; seed++) {
      const shuffled = seededShuffle(events, seed);
      const reordered = canonicalOrder(shuffled).map((e) => e.id);
      expect(reordered, `arrival-order divergence at shuffle seed ${seed}`).toEqual(canonical);
    }
  });
});
