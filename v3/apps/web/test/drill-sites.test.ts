// DEFECTS.md#38 and the range/page site selection.
//
// Every test here is specified by the MUTATION it must fail against, per
// CLAUDE.md's twice-learned lesson (v3-D38, v3-D45): a green suite is evidence
// about the tests, not proof about the code. Each `it` names its killing
// mutation, and each was run and confirmed RED before this file was reported as
// covering anything.
//
// The geometry is REAL, read from the compiled corpus rather than hand-written,
// so a drift in the page map breaks these tests instead of quietly passing.

import { describe, expect, it } from "vitest";
import { siteKey, type Site } from "@engine/site.ts";
import {
  pagesForSurah,
  sitesForPage,
  sitesForRange,
  type PageSpan,
  type VerseGeometry,
} from "@/lib/drill/sites";
import { YUSUF_GEOMETRY, YUSUF_AYAH_COUNT } from "./fixtures/geometry";

const SURAH = 12;

const spans = (): PageSpan[] => pagesForSurah(YUSUF_GEOMETRY);

/** Assert-and-return, so a missing element FAILS the test naming what was
 *  missing rather than being cast away with `as` — a cast here would let a
 *  geometry regression surface as a confusing undefined-property error. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`expected ${what} to exist`);
  return value;
}

describe("pagesForSurah", () => {
  it("reads Yusuf's real geometry: 14 pages, 235..248", () => {
    const p = spans();
    expect(p).toHaveLength(14);
    expect(must(p[0], 'first page').page).toBe(235);
    expect(must(p[p.length - 1], 'last page').page).toBe(248);
  });

  it("page 235 holds only 4 ayat — the surah starts mid-page (#11)", () => {
    const p = spans();
    const first = must(p[0], "page 235");
    expect(first.firstAyah).toBe(1);
    expect(first.lastAyah).toBe(4);
    expect(first.sharedWithOtherSurah).toBe(true);
  });

  it("a middle page is wholly this surah's", () => {
    const mid = must(spans().find((s) => s.page === 240), "page 240");
    expect(mid.sharedWithOtherSurah).toBe(false);
  });

  it("covers every ayah exactly once across pages", () => {
    const seen = new Set<number>();
    for (const s of spans()) {
      for (let n = s.firstAyah; n <= s.lastAyah; n++) {
        expect(seen.has(n)).toBe(false);
        seen.add(n);
      }
    }
    expect(seen.size).toBe(YUSUF_AYAH_COUNT);
  });

  // G9 — edge case #63. MUTATION: make pagesForSurah tolerate nulls (e.g. by
  // filtering them out instead of returning []). Confirmed RED.
  it("degrades to no pages when geometry is absent, and does not throw", () => {
    const noGeometry: VerseGeometry[] = Array.from({ length: 10 }, (_, i) => ({
      ayah: i + 1,
      page: null,
    }));
    expect(() => pagesForSurah(noGeometry)).not.toThrow();
    expect(pagesForSurah(noGeometry)).toEqual([]);
  });

  // A PARTIAL map is as dangerous as none: pages built from half a geometry
  // orphan seams while looking complete. MUTATION: treat partial as usable.
  it("treats a partial geometry as absent", () => {
    const partial: VerseGeometry[] = [
      { ayah: 1, page: 235 },
      { ayah: 2, page: null },
      { ayah: 3, page: 235 },
    ];
    expect(pagesForSurah(partial)).toEqual([]);
  });

  it("returns no pages for an empty verse list", () => {
    expect(pagesForSurah([])).toEqual([]);
  });
});

describe("sitesForRange", () => {
  // G4. MUTATION: hand-count `to - from + 1` for ayat instead of deriving from
  // the returned array — off-by-one on single-ayah ranges. Confirmed RED.
  it("derives counts from the returned sites, including a single-ayah range", () => {
    const one = sitesForRange(SURAH, 7, 7, YUSUF_AYAH_COUNT);
    expect(one.filter((s) => s.kind === "ayah")).toHaveLength(1);
    expect(one.filter((s) => s.kind === "seam")).toHaveLength(0);
    expect(one).toHaveLength(1);
  });

  it("emits N ayat and N-1 seams for a multi-ayah range", () => {
    const r = sitesForRange(SURAH, 4, 9, YUSUF_AYAH_COUNT);
    expect(r.filter((s) => s.kind === "ayah")).toHaveLength(6);
    expect(r.filter((s) => s.kind === "seam")).toHaveLength(5);
  });

  it("never emits a seam AT the range end — that seam belongs to no range", () => {
    const r = sitesForRange(SURAH, 4, 9, YUSUF_AYAH_COUNT);
    expect(r.some((s) => s.kind === "seam" && s.ayah === 9)).toBe(false);
  });

  it("throws on an impossible range rather than clamping it away", () => {
    expect(() => sitesForRange(SURAH, 0, 5, YUSUF_AYAH_COUNT)).toThrow();
    expect(() => sitesForRange(SURAH, 5, 4, YUSUF_AYAH_COUNT)).toThrow();
    expect(() =>
      sitesForRange(SURAH, 1, YUSUF_AYAH_COUNT + 1, YUSUF_AYAH_COUNT),
    ).toThrow();
  });
});

describe("sitesForPage — DEFECTS.md#38", () => {
  // ==========================================================================
  // G1. THE TEST THAT MATTERS MOST.
  //
  // The 13 orphaned seams are invisible in every per-page assertion. Each page
  // looks complete on its own; only the UNION reveals that 13 junctions are
  // never drilled by any page. This is the test that would otherwise ship
  // silently green.
  //
  // MUTATION: delete the boundary-seam clause in sitesForPage (i.e. resolve a
  // page as plain expand(first, last)). Coverage falls 110 -> 97 and this test
  // names all 13 missing seams. Confirmed RED.
  // ==========================================================================
  it("covers ALL 110 seams and 111 ayat across the 14 pages", () => {
    const union = new Set<string>();
    for (const span of spans()) {
      for (const s of sitesForPage(SURAH, span, YUSUF_AYAH_COUNT)) {
        union.add(siteKey(s));
      }
    }

    const missingAyat: number[] = [];
    for (let n = 1; n <= YUSUF_AYAH_COUNT; n++) {
      if (!union.has(siteKey({ kind: "ayah", surah: SURAH, ayah: n }))) {
        missingAyat.push(n);
      }
    }
    expect(missingAyat).toEqual([]);

    const missingSeams: number[] = [];
    for (let n = 1; n < YUSUF_AYAH_COUNT; n++) {
      if (!union.has(siteKey({ kind: "seam", surah: SURAH, ayah: n }))) {
        missingSeams.push(n);
      }
    }
    // Named explicitly: these are exactly the seams the naive implementation
    // drops — the page-turn junctions, the hardest ones in the surah.
    expect(missingSeams).toEqual([]);

    expect(union.size).toBe(YUSUF_AYAH_COUNT + (YUSUF_AYAH_COUNT - 1));
  });

  // The regression stated positively: the 13 known page-turn seams must each be
  // owned by the page holding their FROM ayah.
  it("drills each of the 13 page-turn seams exactly once, on the right page", () => {
    const KNOWN_BOUNDARY_SEAMS = [4, 14, 22, 30, 37, 43, 52, 63, 69, 78, 86, 95, 103];
    const owners = new Map<number, number[]>();
    for (const span of spans()) {
      for (const s of sitesForPage(SURAH, span, YUSUF_AYAH_COUNT)) {
        if (s.kind !== "seam") continue;
        if (!KNOWN_BOUNDARY_SEAMS.includes(s.ayah)) continue;
        const list = owners.get(s.ayah) ?? [];
        list.push(span.page);
        owners.set(s.ayah, list);
      }
    }
    for (const seam of KNOWN_BOUNDARY_SEAMS) {
      const pages = owners.get(seam);
      expect(pages, `seam ${seam} is orphaned`).toBeDefined();
      expect(pages, `seam ${seam} is double-counted`).toHaveLength(1);
      // Owned by the page containing its FROM ayah.
      const owner = must(
        spans().find((s) => seam >= s.firstAyah && seam <= s.lastAyah),
        `owning page for seam ${seam}`,
      );
      expect(must((pages as number[])[0], "owner page")).toBe(owner.page);
    }
  });

  // G2. MUTATION: assign the boundary seam to the page containing its TO ayah
  // (i.e. also push a seam at firstAyah - 1), or let both pages claim it — 13
  // duplicates appear and union size < sum. Confirmed RED.
  it("never double-counts: union size equals the sum of per-page sizes", () => {
    const union = new Set<string>();
    let sum = 0;
    for (const span of spans()) {
      const sites = sitesForPage(SURAH, span, YUSUF_AYAH_COUNT);
      sum += sites.length;
      for (const s of sites) union.add(siteKey(s));
    }
    expect(union.size).toBe(sum);
  });

  // G3 — E-08. MUTATION: weaken the `last < ayahCount` guard to `<=` — a seam
  // at ayah 111 appears, probing past the end of the surah. Confirmed RED.
  it("emits no seam at the surah's final ayah on the last page", () => {
    const all = spans();
    const last = must(all[all.length - 1], "final page");
    expect(last.lastAyah).toBe(YUSUF_AYAH_COUNT);
    const sites = sitesForPage(SURAH, last, YUSUF_AYAH_COUNT);
    expect(sites.some((s) => s.kind === "seam" && s.ayah === YUSUF_AYAH_COUNT)).toBe(
      false,
    );
    // And the final page's last site is the final ayah, not a dangling seam.
    const tail = must(sites[sites.length - 1], "final site");
    expect(tail.kind).toBe("ayah");
    expect(tail.ayah).toBe(YUSUF_AYAH_COUNT);
  });

  it("a non-final page ENDS on the seam into the next page", () => {
    const first = must(spans()[0], "first page");
    const sites = sitesForPage(SURAH, first, YUSUF_AYAH_COUNT);
    const tail = must(sites[sites.length - 1], "final site");
    expect(tail.kind).toBe("seam");
    expect(tail.ayah).toBe(first.lastAyah);
  });

  it("a page is a strict superset of expand() over the same span", () => {
    const span = must(spans()[3], "fourth page");
    const page = sitesForPage(SURAH, span, YUSUF_AYAH_COUNT);
    const range = sitesForRange(SURAH, span.firstAyah, span.lastAyah, YUSUF_AYAH_COUNT);
    expect(page.length).toBe(range.length + 1);
    for (const s of range) {
      expect(page.some((p) => siteKey(p) === siteKey(s))).toBe(true);
    }
  });
});
