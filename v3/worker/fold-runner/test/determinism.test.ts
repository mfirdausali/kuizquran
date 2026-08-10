// WIREFRAME.md §16: "A nightly job re-folds a sample of the event log from
// scratch and compares it to the live atom cache. It must be 100%; ANY
// divergence is the highest-severity page... invariant #2 exists to
// prevent [the cache disagreeing with truth]. Without this check,
// invariant #2 is a claim; with it, it is monitored."
//
// compareAtomCaches is the comparison primitive; foldDeterminismCheck
// composes it with a fresh fold. Both pure, DB-free — the live deployment
// wiring (reading a real atom_cache table, scheduling the nightly run) is
// explicitly deferred, see DECISIONS.md v3-D32.

import { describe, expect, it } from "vitest";
import { compareAtomCaches, foldDeterminismCheck } from "../src/determinism.ts";
import { foldEvents } from "../src/fold.ts";
import type { AtomState } from "../../../packages/engine/src/atom.ts";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";

function atom(overrides: Partial<AtomState> = {}): AtomState {
  return {
    surah: 12,
    kind: "ayah",
    ref: 4,
    strength: 0,
    stability: 1,
    difficulty: 0.3,
    lastRetrieval: null,
    reps: 0,
    lapses: 0,
    encoded: false,
    gatePassed: false,
    gateDueAt: null,
    ...overrides,
  } as AtomState;
}

describe("compareAtomCaches — the fold_determinism_check comparison primitive", () => {
  it("matches when both caches are identical", () => {
    const a = new Map([["12:ayah:4", atom()]]);
    const b = new Map([["12:ayah:4", atom()]]);
    expect(compareAtomCaches(a, b)).toEqual({ matches: true, divergentKeys: [] });
  });

  it("reports a divergent key when a field differs — ANY divergence, however small", () => {
    const a = new Map([["12:ayah:4", atom({ strength: 10 })]]);
    const b = new Map([["12:ayah:4", atom({ strength: 11 })]]);
    const result = compareAtomCaches(a, b);
    expect(result.matches).toBe(false);
    expect(result.divergentKeys).toEqual(["12:ayah:4"]);
  });

  it("reports a key present in only one cache as divergent (never silently ignored)", () => {
    const a = new Map([
      ["12:ayah:4", atom()],
      ["12:ayah:5", atom({ ref: 5 })],
    ]);
    const b = new Map([["12:ayah:4", atom()]]);
    const result = compareAtomCaches(a, b);
    expect(result.matches).toBe(false);
    expect(result.divergentKeys).toEqual(["12:ayah:5"]);
  });

  it("an empty-vs-empty comparison matches", () => {
    expect(compareAtomCaches(new Map(), new Map())).toEqual({ matches: true, divergentKeys: [] });
  });
});

describe("foldDeterminismCheck — re-fold from scratch, compare to the live cache", () => {
  const events: DrillEvent[] = [
    { type: "rung_start", ts: 100, surah: 12, ayah: 4, rung: "S1", id: "e1" },
    { type: "rung_complete", ts: 200, surah: 12, ayah: 4, rung: "S1", correct: true, structured: true, id: "e2" },
  ];

  it("matches when the live cache agrees with a fresh fold", () => {
    const liveCache = foldEvents(events);
    const result = foldDeterminismCheck(events, liveCache);
    expect(result.matches).toBe(true);
  });

  it("catches a corrupted live cache — the exact failure invariant #2 exists to prevent", () => {
    const liveCache = foldEvents(events);
    const corrupted = new Map(liveCache);
    const key = [...corrupted.keys()][0]!;
    corrupted.set(key, { ...corrupted.get(key)!, strength: 999 });

    const result = foldDeterminismCheck(events, corrupted);
    expect(result.matches).toBe(false);
    expect(result.divergentKeys).toContain(key);
  });
});
