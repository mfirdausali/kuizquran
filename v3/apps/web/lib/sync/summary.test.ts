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
  it("current() is {cannotSync: 0, divergences: 0} before any report", () => {
    expect(syncSummary.current).toEqual({ cannotSync: 0, divergences: 0 });
  });
});

describe("report() overwrites, never accumulates", () => {
  it("reflects exactly the last reported cycle's counts", () => {
    syncSummary.report({
      quarantined: [{ id: "a", bytes: 9_000 }],
      divergences: [],
    });
    expect(syncSummary.current).toEqual({ cannotSync: 1, divergences: 0 });

    // A LATER cycle with fewer quarantined rows (the operator fixed it, or a
    // stale row finally aged past this device's log) must DROP the old
    // count, not add to it.
    syncSummary.report({ quarantined: [], divergences: [] });
    expect(syncSummary.current).toEqual({ cannotSync: 0, divergences: 0 });
  });
});

describe("subscribe()", () => {
  it("calls the listener immediately with the current value", () => {
    syncSummary.report({ quarantined: [{ id: "a", bytes: 9_000 }], divergences: [] });
    const fn = vi.fn();
    syncSummary.subscribe(fn);
    expect(fn).toHaveBeenCalledWith({ cannotSync: 1, divergences: 0 });
  });

  it("notifies subscribers on a real change", () => {
    const fn = vi.fn();
    syncSummary.subscribe(fn);
    fn.mockClear();
    syncSummary.report({ quarantined: [], divergences: [DIVERGENCE] });
    expect(fn).toHaveBeenCalledWith({ cannotSync: 0, divergences: 1 });
  });

  it("does NOT notify subscribers when the reported counts are unchanged", () => {
    syncSummary.report({ quarantined: [{ id: "a", bytes: 9_000 }], divergences: [] });
    const fn = vi.fn();
    syncSummary.subscribe(fn);
    fn.mockClear();
    // Identical counts, a different array instance — a real second cycle
    // scanning the same still-quarantined row produces exactly this shape.
    syncSummary.report({ quarantined: [{ id: "a", bytes: 9_000 }], divergences: [] });
    expect(fn).not.toHaveBeenCalled();
  });

  it("returns an unsubscribe function that stops further notifications", () => {
    const fn = vi.fn();
    const unsubscribe = syncSummary.subscribe(fn);
    fn.mockClear();
    unsubscribe();
    syncSummary.report({ quarantined: [{ id: "a", bytes: 9_000 }], divergences: [] });
    expect(fn).not.toHaveBeenCalled();
  });
});
