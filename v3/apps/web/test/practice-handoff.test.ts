// The `/practice` → `/session` URL contract (`lib/practice/handoff.ts`), both
// directions. Pure string/record functions, so no DOM and no corpus — the
// point of extracting the contract into its own module is that a link the
// picker WRITES and a request the session route READS are proven to agree
// here, once, rather than by inspection at two call sites that can drift.
// Mirrors `test/drill-handoff.test.ts`'s own method exactly.

import { describe, expect, it } from "vitest";
import { practiceHref, parsePracticeParams, type PracticeSpec } from "@/lib/practice/handoff";

/** Parse a full href back the way the route does: split its query string into
 *  the record `parsePracticeParams` takes. Proves the two halves round-trip
 *  through an ACTUAL URL, not just matching record shapes. */
function parseHref(href: string) {
  const query = href.slice(href.indexOf("?") + 1);
  const params = Object.fromEntries(new URLSearchParams(query));
  return parsePracticeParams(params);
}

describe("practiceHref ↔ parsePracticeParams round-trip", () => {
  it("round-trips an 'S2' (partial) request", () => {
    const spec: PracticeSpec = { ayah: 3, drill: "S2" };
    expect(parseHref(practiceHref(spec))).toEqual(spec);
  });

  it("round-trips an 'S3' (full) request", () => {
    const spec: PracticeSpec = { ayah: 111, drill: "S3" };
    expect(parseHref(practiceHref(spec))).toEqual(spec);
  });
});

describe("parsePracticeParams validation — a hand-edited URL degrades honestly", () => {
  it("returns null when there is no 'practice=1' marker (an ordinary session)", () => {
    expect(parsePracticeParams({})).toBeNull();
    expect(parsePracticeParams({ ayah: "3", drill: "s2" })).toBeNull();
    expect(parsePracticeParams({ practice: "true", ayah: "3", drill: "s2" })).toBeNull();
  });

  it("rejects a non-positive or non-integer ayah", () => {
    expect(parsePracticeParams({ practice: "1", ayah: "0", drill: "s2" })).toBeNull();
    expect(parsePracticeParams({ practice: "1", ayah: "abc", drill: "s2" })).toBeNull();
    expect(parsePracticeParams({ practice: "1", ayah: "-1", drill: "s3" })).toBeNull();
  });

  it("rejects any drill value other than 's2'/'s3' — no silent fallback to a guess", () => {
    expect(parsePracticeParams({ practice: "1", ayah: "3", drill: "s1" })).toBeNull();
    expect(parsePracticeParams({ practice: "1", ayah: "3", drill: "chain" })).toBeNull();
    expect(parsePracticeParams({ practice: "1", ayah: "3" })).toBeNull();
  });
});
