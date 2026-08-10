// Build-plan step 11 (Site model — the minimal, wire-relevant subset needed
// to unblock step 10's DrillEvent freeze): WIREFRAME.md §23's Site
// abstraction. `Site = { kind: "ayah" | "seam", surah, ayah: n }` — a spec
// binds to a SITE, never bare "an ayah", so a seam (which spans two ayat)
// is itself a coordinate rather than a special case bolted onto one ayah.
//
// Scope note: this is the Site/siteKey/expand/visitOrdinal slice only.
// `admit()`'s 4-clause admissibility predicate, `ResourceLedger`, and
// lane rotation (`lapPerm`/`stride`) are real, larger step-11 work not
// attempted here — this run's job is unblocking the wire freeze, not the
// full selection engine. See DECISIONS.md's v3-D27 for the explicit scope
// boundary.

import { describe, expect, it } from "vitest";
import { siteKey, siteToAtomKey, expand, nextVisitOrdinal, type Site } from "../src/site.ts";
import { atomKey } from "../src/atom.ts";

describe("siteKey — total, surah-scoped (same spirit as atomKey, E-01)", () => {
  it("an ayah site keys as surah:ayah:n", () => {
    const site: Site = { kind: "ayah", surah: 12, ayah: 5 };
    expect(siteKey(site)).toBe("12:ayah:5");
  });

  it("a seam site keys as surah:seam:n — distinct from the ayah site at the same n", () => {
    const site: Site = { kind: "seam", surah: 12, ayah: 5 };
    expect(siteKey(site)).toBe("12:seam:5");
    expect(siteKey(site)).not.toBe(siteKey({ kind: "ayah", surah: 12, ayah: 5 }));
  });

  it("two surahs sharing an ayah number never collide (the E-01 property, carried into Site)", () => {
    expect(siteKey({ kind: "ayah", surah: 12, ayah: 5 })).not.toBe(siteKey({ kind: "ayah", surah: 67, ayah: 5 }));
  });
});

describe("siteToAtomKey — TOTAL: ayah -> ayah:n, seam(n) -> connection:n", () => {
  it("an ayah site maps to its ayah atom key", () => {
    const site: Site = { kind: "ayah", surah: 12, ayah: 5 };
    expect(siteToAtomKey(site)).toBe(atomKey(12, "ayah", 5));
  });

  it("a seam site maps to the CONNECTION atom key, ref = the seam's own ayah number (the `from` ayah)", () => {
    const site: Site = { kind: "seam", surah: 12, ayah: 5 };
    expect(siteToAtomKey(site)).toBe(atomKey(12, "connection", 5));
  });
});

describe("expand — packaging (WIREFRAME.md Q3): the unit is the Site", () => {
  it("a single ayah expands to exactly [ayah:n], no seam", () => {
    const sites = expand(12, 5, 5, 111);
    expect(sites).toEqual([{ kind: "ayah", surah: 12, ayah: 5 }]);
  });

  it("a range a..b expands to ayah sites a..b PLUS seam sites a..b-1 (never a seam AT b)", () => {
    const sites = expand(12, 4, 6, 111);
    expect(sites.filter((s) => s.kind === "ayah").map((s) => s.ayah)).toEqual([4, 5, 6]);
    expect(sites.filter((s) => s.kind === "seam").map((s) => s.ayah)).toEqual([4, 5]);
  });

  it("E-08 dies by construction: a range ending at the surah's LAST ayah never constructs its OOB seam", () => {
    const ayahCount = 111;
    const sites = expand(12, 109, ayahCount, ayahCount);
    // The last emitted seam is at ayahCount-1 (110); a seam AT ayahCount
    // (111, which would need a nonexistent ayah 112) is never constructed.
    const seamAyat = sites.filter((s) => s.kind === "seam").map((s) => s.ayah);
    expect(seamAyat).toEqual([109, 110]);
    expect(seamAyat).not.toContain(ayahCount);
  });

  it("a whole-surah expand covers every ayah and every seam, in order", () => {
    const sites = expand(103, 1, 3, 3); // Al-Asr, 3 ayat
    expect(sites.map((s) => `${s.kind}:${s.ayah}`)).toEqual(["ayah:1", "seam:1", "ayah:2", "seam:2", "ayah:3"]);
  });

  it("throws rather than silently clamping on an out-of-range request (fail loud, E-01's own philosophy)", () => {
    expect(() => expand(103, 1, 4, 3)).toThrow(); // Al-Asr has no ayah 4
  });
});

describe("nextVisitOrdinal — commutative, set-monotone (WIREFRAME.md Q2: 'record the ordinal, don't derive it')", () => {
  it("the first visit to a site is ordinal 1", () => {
    expect(nextVisitOrdinal([])).toBe(1);
  });

  it("is max(recorded) + 1, regardless of array order (immune to arrival/merge order)", () => {
    expect(nextVisitOrdinal([1, 2, 3])).toBe(4);
    expect(nextVisitOrdinal([3, 1, 2])).toBe(4);
    expect(nextVisitOrdinal([2, 3, 1])).toBe(4);
  });

  it("is commutative and idempotent under duplicate merge (a device's own events re-seen twice)", () => {
    expect(nextVisitOrdinal([1, 2, 2, 3, 3, 3])).toBe(4);
  });
});
