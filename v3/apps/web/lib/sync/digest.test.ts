// `digest.ts` had never had a test file of its own — every property it
// claims (obligation 1: absent === null === undefined; obligation 2: key
// order is irrelevant) was only exercised INCIDENTALLY through
// `merge.test.ts`'s realistic event fixtures, which happen to touch the
// digest but were never built to pin these two specific obligations. This
// file pins them directly, plus `digestsMatch()` itself — the documented,
// exported "whether two events carry the same wire payload" function that
// `merge.ts` had zero callers for until this run (it re-derived the
// identical `eventDigest(a) === eventDigest(b)` comparison inline instead).
//
// NO ARABIC LITERALS. Fixtures use plain object shapes, never corpus text.

import { describe, expect, it } from "vitest";
import type { DrillEvent } from "@engine/types.ts";
import { canonicalJson, digestsMatch, eventDigest } from "./digest.ts";

describe("canonicalJson", () => {
  it("obligation 1: an explicit null and an absent key digest identically", () => {
    expect(canonicalJson({ a: 1, b: null })).toBe(canonicalJson({ a: 1 }));
  });

  it("obligation 1: an explicit undefined and an absent key digest identically", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it("obligation 1 is recursive: a nested null/absent pair also collapses", () => {
    expect(canonicalJson({ a: { x: 1, y: null } })).toBe(canonicalJson({ a: { x: 1 } }));
  });

  it("obligation 2: top-level key order is irrelevant", () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it("obligation 2: nested key order is irrelevant too", () => {
    expect(canonicalJson({ outer: { a: 1, b: 2 } })).toBe(
      canonicalJson({ outer: { b: 2, a: 1 } }),
    );
  });

  it("a genuinely different value digests differently (the suite cannot pass vacuously)", () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });

  it("arrays are positional — order is meaning, never sorted", () => {
    expect(canonicalJson({ a: [1, 2, 3] })).not.toBe(canonicalJson({ a: [3, 2, 1] }));
  });

  it("null and undefined collapse to the same sentinel inside an array too", () => {
    expect(canonicalJson([1, null, 3])).toBe(canonicalJson([1, undefined, 3]));
  });
});

const NOW = 1_700_000_000_000;

/** A minimal but realistic wire event, at a fixture coordinate. */
function ev(over: Partial<DrillEvent> & { id: string }): DrillEvent {
  return {
    type: "rung_complete",
    ts: NOW,
    surah: 12,
    ayah: 1,
    rung: "S1",
    ...over,
  };
}

describe("eventDigest", () => {
  it("a local-only field never participates: a pending row and its synced self digest identically", () => {
    const pending = { ...ev({ id: "a" }) };
    const synced = { ...ev({ id: "a" }), syncedAt: NOW + 5000 };
    expect(eventDigest(pending)).toBe(eventDigest(synced));
  });
});

describe("digestsMatch — the exported function `merge.ts` now calls at its #50 comparison", () => {
  it("is true for two events carrying the same wire payload", () => {
    expect(digestsMatch(ev({ id: "a" }), ev({ id: "a" }))).toBe(true);
  });

  it("is false when the wire payload genuinely differs", () => {
    expect(digestsMatch(ev({ id: "a", correct: true }), ev({ id: "a", correct: false }))).toBe(
      false,
    );
  });

  it("agrees with a direct eventDigest comparison (it is not a second, drifting implementation)", () => {
    const a = ev({ id: "a", latency: 200 });
    const b = ev({ id: "a", latency: undefined });
    expect(digestsMatch(a, b)).toBe(eventDigest(a) === eventDigest(b));
  });
});
