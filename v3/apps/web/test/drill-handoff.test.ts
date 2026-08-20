// The `/drill` → `/session` URL contract (`lib/drill/handoff.ts`), both
// directions. Pure string/record functions, so no DOM and no corpus — the
// point of extracting the contract into its own module is that a link the
// picker WRITES and a request the session route READS are proven to agree here,
// once, rather than by inspection at two call sites that can drift.

import { describe, expect, it } from "vitest";
import { drillHref, parseDrillParams } from "@/lib/drill/handoff";
import type { DrillSelection } from "@/lib/drill/sites";

/** Parse a full href back the way the route does: split its query string into
 *  the record `parseDrillParams` takes. Proves the two halves round-trip
 *  through an ACTUAL URL, not just matching record shapes. */
function parseHref(href: string) {
  const query = href.slice(href.indexOf("?") + 1);
  const params = Object.fromEntries(new URLSearchParams(query));
  return parseDrillParams(params);
}

describe("drillHref ↔ parseDrillParams round-trip", () => {
  it("round-trips a graded range", () => {
    const sel: DrillSelection = { kind: "range", from: 2, to: 7 };
    const spec = parseHref(drillHref(sel, "graded"));
    expect(spec).toEqual({ selection: sel, mode: "graded" });
  });

  it("round-trips a victory-lap range", () => {
    const sel: DrillSelection = { kind: "range", from: 1, to: 1 };
    const spec = parseHref(drillHref(sel, "victory-lap"));
    expect(spec).toEqual({ selection: sel, mode: "victory-lap" });
  });

  it("round-trips a page selection and its mode", () => {
    const sel: DrillSelection = { kind: "page", page: 235 };
    expect(parseHref(drillHref(sel, "graded"))).toEqual({ selection: sel, mode: "graded" });
    expect(parseHref(drillHref(sel, "victory-lap"))).toEqual({
      selection: sel,
      mode: "victory-lap",
    });
  });
});

describe("parseDrillParams validation — a hand-edited URL degrades honestly", () => {
  it("returns null when there is no drill param (an ordinary session)", () => {
    expect(parseDrillParams({})).toBeNull();
    expect(parseDrillParams({ mode: "floor" } as never)).toBeNull();
  });

  it("rejects a descending or sub-1 range rather than drilling backwards", () => {
    expect(parseDrillParams({ drill: "range", from: "6", to: "3" })).toBeNull();
    expect(parseDrillParams({ drill: "range", from: "0", to: "3" })).toBeNull();
    expect(parseDrillParams({ drill: "range", from: "x", to: "3" })).toBeNull();
  });

  it("accepts a single-ayah range (from === to)", () => {
    expect(parseDrillParams({ drill: "range", from: "4", to: "4" })).toEqual({
      selection: { kind: "range", from: 4, to: 4 },
      mode: "graded",
    });
  });

  it("rejects a non-positive or non-integer page", () => {
    expect(parseDrillParams({ drill: "page", page: "0" })).toBeNull();
    expect(parseDrillParams({ drill: "page", page: "abc" })).toBeNull();
  });

  it("treats any grade other than 'victory' as graded — the safe default", () => {
    // A mistyped grade must never silently turn a graded review into an
    // un-damaging victory lap; only the exact string opts in.
    expect(parseDrillParams({ drill: "range", from: "1", to: "2", grade: "nonsense" })?.mode).toBe(
      "graded",
    );
    expect(parseDrillParams({ drill: "range", from: "1", to: "2", grade: "victory" })?.mode).toBe(
      "victory-lap",
    );
  });
});
