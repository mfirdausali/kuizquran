// lib/sync/summary.ts — the missing wire between `syncCycle()`'s
// `quarantined`/`divergences` counts (computed on every cycle since
// build-plan step 21) and `SyncStatus.tsx`'s escalation props (unit-tested
// since the same step, never fed a real value outside a test). See
// SyncTrigger.tsx and SyncStatus.tsx for the wiring proof at the component
// level — this file proves the store primitive in isolation.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Divergence } from "./merge.ts";
import { resetSyncSummaryForTests, syncSummary } from "./summary.ts";

const DIVERGENCE: Divergence = {
  id: "d",
  localDigest: "local",
  serverDigest: "server",
  seenAt: 1_700_000_000_000,
};

beforeEach(() => {
  resetSyncSummaryForTests();
});

describe("starts at zero", () => {
  it("current() is {cannotSync: 0, divergences: 0, futureTs: 0, clockSkewMs: null, authDead: false} before any report", () => {
    expect(syncSummary.current).toEqual({
      cannotSync: 0,
      divergences: 0,
      futureTs: 0,
      clockSkewMs: null,
      authDead: false,
    });
  });
});

describe("report() overwrites, never accumulates", () => {
  it("reflects exactly the last reported cycle's counts", () => {
    syncSummary.report(
      {
        quarantined: [{ id: "a", bytes: 9_000 }],
        divergences: [],
      },
      false,
    );
    expect(syncSummary.current).toEqual({
      cannotSync: 1,
      divergences: 0,
      futureTs: 0,
      clockSkewMs: null,
      authDead: false,
    });

    // A LATER cycle with fewer quarantined rows (the operator fixed it, or a
    // stale row finally aged past this device's log) must DROP the old
    // count, not add to it.
    syncSummary.report({ quarantined: [], divergences: [] }, false);
    expect(syncSummary.current).toEqual({
      cannotSync: 0,
      divergences: 0,
      futureTs: 0,
      clockSkewMs: null,
      authDead: false,
    });
  });

  // v3-D162: `authDead` is likewise the CURRENT state, not a latch — a later
  // cycle whose re-mint succeeded must be able to clear a previously-true
  // value, the same "drop, never accumulate" property the two counts above
  // already have.
  it("reflects exactly the last reported cycle's authDead value, in both directions", () => {
    syncSummary.report({ quarantined: [], divergences: [] }, true);
    expect(syncSummary.current).toEqual({
      cannotSync: 0,
      divergences: 0,
      futureTs: 0,
      clockSkewMs: null,
      authDead: true,
    });

    syncSummary.report({ quarantined: [], divergences: [] }, false);
    expect(syncSummary.current).toEqual({
      cannotSync: 0,
      divergences: 0,
      futureTs: 0,
      clockSkewMs: null,
      authDead: false,
    });
  });
});

describe("v3-D240 — futureTs (#111 far-future timestamps, accepted and flagged)", () => {
  it("starts at zero", () => {
    expect(syncSummary.current).toEqual({
      cannotSync: 0,
      divergences: 0,
      futureTs: 0,
      clockSkewMs: null,
      authDead: false,
    });
  });

  it("reflects exactly the last reported cycle's count, overwriting rather than accumulating", () => {
    syncSummary.report({ quarantined: [], divergences: [], futureTs: ["a", "b"] }, false);
    expect(syncSummary.current.futureTs).toBe(2);

    // A LATER cycle whose page carried no far-future rows must DROP the old
    // count, not add to it — the same "current state, not a delta" property
    // `cannotSync`/`divergences` already have, for the same reason:
    // `pullFromServer`'s own loop re-derives `futureTs` fresh on every page.
    syncSummary.report({ quarantined: [], divergences: [], futureTs: [] }, false);
    expect(syncSummary.current.futureTs).toBe(0);
  });

  it("notifies subscribers when only futureTs changes", () => {
    syncSummary.report({ quarantined: [], divergences: [], futureTs: [] }, false);
    const fn = vi.fn();
    syncSummary.subscribe(fn);
    fn.mockClear();
    syncSummary.report({ quarantined: [], divergences: [], futureTs: ["a"] }, false);
    expect(fn).toHaveBeenCalledWith({
      cannotSync: 0,
      divergences: 0,
      futureTs: 1,
      clockSkewMs: null,
      authDead: false,
    });
  });
});

// v3-D243: edge case #111's own third clause — "skew measured client-now vs
// server-now, not per-event" — a DEVICE-level measurement independent of any
// one event's own `ts`. See `lib/sync/clockSkew.ts`'s own header for why
// this is a genuinely different fact from `futureTs` above.
describe("v3-D243 — clockSkewMs (#111's device-level clock-skew measurement)", () => {
  it("starts at null, never a fabricated 0", () => {
    expect(syncSummary.current.clockSkewMs).toBeNull();
  });

  it("reflects exactly the last reported cycle's measurement, overwriting rather than accumulating", () => {
    syncSummary.report({ quarantined: [], divergences: [], clockSkewMs: 42_000 }, false);
    expect(syncSummary.current.clockSkewMs).toBe(42_000);

    // A LATER cycle whose response carried no readable Date header must DROP
    // the earlier measurement, not keep reporting a stale one — the same
    // "current state, not a latch" property `authDead` already has.
    syncSummary.report({ quarantined: [], divergences: [], clockSkewMs: null }, false);
    expect(syncSummary.current.clockSkewMs).toBeNull();
  });

  it("is null when `report()`'s caller omits it entirely — a pre-v3-D243 call site keeps compiling and simply reports null", () => {
    syncSummary.report({ quarantined: [], divergences: [] }, false);
    expect(syncSummary.current.clockSkewMs).toBeNull();
  });

  it("a NEGATIVE skew (this device's clock is BEHIND the server) round-trips as-is, never clamped to zero", () => {
    syncSummary.report({ quarantined: [], divergences: [], clockSkewMs: -15_000 }, false);
    expect(syncSummary.current.clockSkewMs).toBe(-15_000);
  });

  it("notifies subscribers when only clockSkewMs changes", () => {
    syncSummary.report({ quarantined: [], divergences: [] }, false);
    const fn = vi.fn();
    syncSummary.subscribe(fn);
    fn.mockClear();
    syncSummary.report({ quarantined: [], divergences: [], clockSkewMs: 90_000 }, false);
    expect(fn).toHaveBeenCalledWith({
      cannotSync: 0,
      divergences: 0,
      futureTs: 0,
      clockSkewMs: 90_000,
      authDead: false,
    });
  });

  it("does NOT notify subscribers when clockSkewMs is unchanged, including null === null", () => {
    syncSummary.report({ quarantined: [], divergences: [] }, false);
    const fn = vi.fn();
    syncSummary.subscribe(fn);
    fn.mockClear();
    syncSummary.report({ quarantined: [], divergences: [], clockSkewMs: null }, false);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("subscribe()", () => {
  it("calls the listener immediately with the current value", () => {
    syncSummary.report({ quarantined: [{ id: "a", bytes: 9_000 }], divergences: [] }, false);
    const fn = vi.fn();
    syncSummary.subscribe(fn);
    expect(fn).toHaveBeenCalledWith({
      cannotSync: 1,
      divergences: 0,
      futureTs: 0,
      clockSkewMs: null,
      authDead: false,
    });
  });

  it("notifies subscribers on a real change", () => {
    const fn = vi.fn();
    syncSummary.subscribe(fn);
    fn.mockClear();
    syncSummary.report({ quarantined: [], divergences: [DIVERGENCE] }, false);
    expect(fn).toHaveBeenCalledWith({
      cannotSync: 0,
      divergences: 1,
      futureTs: 0,
      clockSkewMs: null,
      authDead: false,
    });
  });

  // v3-D162: a change in ONLY authDead — the two counts unchanged — must
  // still notify. A subscriber that only watched cannotSync/divergences for
  // equality would silently swallow exactly this transition.
  it("notifies subscribers when only authDead changes", () => {
    syncSummary.report({ quarantined: [], divergences: [] }, false);
    const fn = vi.fn();
    syncSummary.subscribe(fn);
    fn.mockClear();
    syncSummary.report({ quarantined: [], divergences: [] }, true);
    expect(fn).toHaveBeenCalledWith({
      cannotSync: 0,
      divergences: 0,
      futureTs: 0,
      clockSkewMs: null,
      authDead: true,
    });
  });

  it("does NOT notify subscribers when the reported counts are unchanged", () => {
    syncSummary.report({ quarantined: [{ id: "a", bytes: 9_000 }], divergences: [] }, false);
    const fn = vi.fn();
    syncSummary.subscribe(fn);
    fn.mockClear();
    // Identical counts, a different array instance — a real second cycle
    // scanning the same still-quarantined row produces exactly this shape.
    syncSummary.report({ quarantined: [{ id: "a", bytes: 9_000 }], divergences: [] }, false);
    expect(fn).not.toHaveBeenCalled();
  });

  it("returns an unsubscribe function that stops further notifications", () => {
    const fn = vi.fn();
    const unsubscribe = syncSummary.subscribe(fn);
    fn.mockClear();
    unsubscribe();
    syncSummary.report({ quarantined: [{ id: "a", bytes: 9_000 }], divergences: [] }, false);
    expect(fn).not.toHaveBeenCalled();
  });
});
