// The drill preview: partial pages, the estimate, and graded vs victory lap.
//
// As in drill-sites.test.ts, every test names the mutation it must fail
// against, and each mutation was run and confirmed RED before this file was
// reported as covering anything.

import { describe, expect, it } from "vitest";
import { initAtom, type AtomState } from "@engine/atom.ts";
import { COST_PER_CHAIN, COST_PER_JUNCTION } from "@engine/capacity.ts";
import { update } from "@engine/update.ts";
import { siteToAtomKey, type Site } from "@engine/site.ts";
import {
  buildDrillPreview,
  formatMinutes,
  structuredFor,
} from "@/lib/drill/preview";
import { sitesForPage, sitesForRange } from "@/lib/drill/sites";

const SURAH = 12;
const COUNT = 111;

/** Build an atom map in which the listed ayat are encoded and every seam in
 *  range has a connection atom.
 *
 *  CRITICAL: every ayah NOT in `encodedAyat` still gets an atom — one with
 *  `encoded: false`. That is the realistic state, because an ayah acquires an
 *  atom the moment it is first touched (S1/S2) and only becomes `encoded` once
 *  the S3 whole-bank is completed. If un-learned ayat were simply ABSENT from
 *  the map, the `!atom` check alone would skip them and a test asserting the
 *  partial-page behaviour would pass even with the `encoded` guard deleted —
 *  which is exactly the surviving mutation this helper was rewritten to kill. */
function atomsFor(sites: readonly Site[], encodedAyat: readonly number[]): Map<string, AtomState> {
  const map = new Map<string, AtomState>();
  for (const s of sites) {
    const key = siteToAtomKey(s);
    if (s.kind === "seam") {
      map.set(key, initAtom(SURAH, "connection", s.ayah));
      continue;
    }
    map.set(key, {
      ...initAtom(SURAH, "ayah", s.ayah),
      encoded: encodedAyat.includes(s.ayah),
    });
  }
  return map;
}

describe("buildDrillPreview — counts and estimate", () => {
  const sites = sitesForRange(SURAH, 1, 6, COUNT);
  const allAyat = [1, 2, 3, 4, 5, 6];

  it("counts 6 ayat and 5 seams for a 6-ayah range", () => {
    const p = buildDrillPreview({
      sites,
      atoms: atomsFor(sites, allAyat),
      mode: "graded",
    });
    expect(p.ayahCount).toBe(6);
    expect(p.seamCount).toBe(5);
    expect(p.stepCount).toBe(11);
  });

  // G5. MUTATION: alter a cost constant in the expectation (or hardcode 8.6
  // from WIREFRAME §13) — the expected minutes shift and this goes RED.
  // Confirmed RED. Note the doc's "8.6 min" is NOT reproducible from the
  // shipped model; 1.25*6 + 0.17*5 = 8.35.
  it("takes its estimate from the engine cost model, not a local formula", () => {
    const p = buildDrillPreview({
      sites,
      atoms: atomsFor(sites, allAyat),
      mode: "graded",
    });
    expect(p.estimatedMinutes).toBeCloseTo(COST_PER_CHAIN * 6 + COST_PER_JUNCTION * 5, 10);
    expect(p.estimatedMinutes).toBeCloseTo(8.35, 10);
  });

  it("estimates only the DRILLED work, so skipped ayat cost no minutes", () => {
    const partial = buildDrillPreview({
      sites,
      atoms: atomsFor(sites, [1, 2, 3]),
      mode: "graded",
    });
    const full = buildDrillPreview({
      sites,
      atoms: atomsFor(sites, allAyat),
      mode: "graded",
    });
    expect(partial.estimatedMinutes).toBeLessThan(full.estimatedMinutes);
    expect(partial.estimatedMinutes).toBeCloseTo(
      COST_PER_CHAIN * partial.ayahCount + COST_PER_JUNCTION * partial.seamCount,
      10,
    );
  });

  it("formats minutes in one place", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(0.4)).toBe("under a minute");
    expect(formatMinutes(8.35)).toBe("8.4 min");
  });
});

describe("partial pages — skipped is not failed", () => {
  // A 10-ayah page where only 7 ayat are learned.
  const span = { page: 236, firstAyah: 5, lastAyah: 14, sharedWithOtherSurah: false };
  const sites = sitesForPage(SURAH, span, COUNT);
  const learned = [5, 6, 7, 8, 9, 10, 11];

  // G8. MUTATION: remove the `encoded` check in buildDrillPreview — phantom
  // atoms get credited, drilled ayat becomes 10 and the denominator lies.
  // Confirmed RED.
  it("drills 7, skips 3, fails none", () => {
    const p = buildDrillPreview({ sites, atoms: atomsFor(sites, learned), mode: "graded" });
    expect(p.ayahCount).toBe(7);
    expect(p.skippedAyahCount).toBe(3);
    expect(p.drilledSites.every((s) => s.kind !== "ayah" || learned.includes(s.ayah))).toBe(true);
  });

  it("marks un-learned ayat 'not-learned', never an error state", () => {
    const p = buildDrillPreview({ sites, atoms: atomsFor(sites, learned), mode: "graded" });
    const skipped = p.sites.filter((s) => !s.drilled && s.site.kind === "ayah");
    expect(skipped.map((s) => s.site.ayah).sort((a, b) => a - b)).toEqual([12, 13, 14]);
    for (const s of skipped) expect(s.skipReason).toBe("not-learned");
  });

  it("states the honest denominator UP FRONT, and says skipped not wrong", () => {
    const p = buildDrillPreview({ sites, atoms: atomsFor(sites, learned), mode: "graded" });
    expect(p.partialNotice).toBe(
      "7 of 10 ayat here are ready. The other 3 haven't been learned yet — " +
        "they'll be skipped, not marked wrong.",
    );
  });

  // MUTATION: always emit partialNotice — a fully-ready page then renders a
  // reassuring notice about nothing. Confirmed RED.
  it("says nothing when the whole selection is ready", () => {
    const all = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    const p = buildDrillPreview({ sites, atoms: atomsFor(sites, all), mode: "graded" });
    expect(p.partialNotice).toBeNull();
    expect(p.skippedAyahCount).toBe(0);
  });

  // THE MUTATION-KILLING CASE, kept explicit and separate.
  //
  // An ayah that has been TOUCHED but never ENCODED has an atom, so `!atom` is
  // false and only the `encoded` guard can skip it. Deleting that guard leaves
  // every other test in this file green (verified — the mutation survived once,
  // which is why this test exists). Without this case the suite would be
  // evidence about the tests and not about the code.
  it("skips a touched-but-never-encoded ayah, which HAS an atom", () => {
    const atoms = atomsFor(sites, learned);
    const key = siteToAtomKey({ kind: "ayah", surah: SURAH, ayah: 12 });
    const touched = atoms.get(key) as AtomState;
    expect(touched).toBeDefined();
    expect(touched.encoded).toBe(false);
    // Give it real activity, so nothing but `encoded` distinguishes it.
    atoms.set(key, { ...touched, reps: 3, strength: 22, stability: 1.4 });

    const p = buildDrillPreview({ sites, atoms, mode: "graded" });
    expect(p.drilledSites.some((s) => s.kind === "ayah" && s.ayah === 12)).toBe(false);
    const entry = p.sites.find((s) => s.site.kind === "ayah" && s.site.ayah === 12);
    expect(entry?.skipReason).toBe("not-learned");
    expect(p.ayahCount).toBe(7);
  });

  // The first-run state: nothing touched at all. An ayah with no atom reads the
  // same as an un-encoded one — "not learned yet" — because to the learner it
  // is the same fact.
  it("skips everything when nothing has been learned, and blames nothing", () => {
    const p = buildDrillPreview({ sites, atoms: new Map(), mode: "graded" });
    expect(p.stepCount).toBe(0);
    const ayahReasons = new Set(
      p.sites.filter((s) => s.site.kind === "ayah").map((s) => s.skipReason),
    );
    expect([...ayahReasons]).toEqual(["not-learned"]);
    const seamReasons = new Set(
      p.sites.filter((s) => s.site.kind === "seam").map((s) => s.skipReason),
    );
    expect([...seamReasons]).toEqual(["seam-not-reached"]);
  });

  // G10. The seam-side sibling of "states the honest denominator UP FRONT":
  // an unreached joint is a different fact from an un-learned ayah (this
  // file's own header), so it needs its own honest sentence, not a silently
  // smaller joint count with nothing on screen to explain it.
  // MUTATION: gate partialNotice on skippedAyahCount alone — this goes RED.
  it("also names an unreached joint even when every ayah is ready", () => {
    const threeSites = sitesForRange(SURAH, 1, 3, COUNT); // ayat 1-3, seams 1-2
    const atoms = atomsFor(threeSites, [1, 2, 3]);
    // Every ayah is encoded; delete one seam's atom so it is genuinely
    // unreached, not merely un-encoded (seams have no `encoded` concept).
    atoms.delete(siteToAtomKey({ kind: "seam", surah: SURAH, ayah: 2 }));

    const p = buildDrillPreview({ sites: threeSites, atoms, mode: "graded" });
    expect(p.skippedAyahCount).toBe(0);
    expect(p.skippedSeamCount).toBe(1);
    expect(p.partialNotice).toBe("1 joint hasn't been reached yet, so it's skipped too.");
  });

  it("pluralizes and combines both clauses when ayat and joints are both partial", () => {
    const span2 = { page: 236, firstAyah: 5, lastAyah: 14, sharedWithOtherSurah: false };
    const pageSites = sitesForPage(SURAH, span2, COUNT);
    const atoms = atomsFor(pageSites, learned); // 7 of 10 ayat, every seam present
    // Two of the seams among the LEARNED ayat are genuinely unreached.
    atoms.delete(siteToAtomKey({ kind: "seam", surah: SURAH, ayah: 5 }));
    atoms.delete(siteToAtomKey({ kind: "seam", surah: SURAH, ayah: 6 }));

    const p = buildDrillPreview({ sites: pageSites, atoms, mode: "graded" });
    expect(p.skippedAyahCount).toBe(3);
    expect(p.skippedSeamCount).toBe(2);
    expect(p.partialNotice).toBe(
      "7 of 10 ayat here are ready. The other 3 haven't been learned yet — " +
        "they'll be skipped, not marked wrong. " +
        "2 joints haven't been reached yet, so they're skipped too.",
    );
  });

  it("keeps the page's boundary seam among the drilled sites", () => {
    const all = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    const p = buildDrillPreview({ sites, atoms: atomsFor(sites, all), mode: "graded" });
    const tail = p.drilledSites[p.drilledSites.length - 1];
    expect(tail?.kind).toBe("seam");
    expect(tail?.ayah).toBe(14);
  });
});

describe("graded vs victory lap", () => {
  it("maps mode to `structured` in exactly one place", () => {
    expect(structuredFor("graded")).toBe(true);
    expect(structuredFor("victory-lap")).toBe(false);
  });

  // MUTATION: swap the two consequence strings, or replace them with the
  // jargon ("graded" / "victory lap"). Confirmed RED.
  it("states the consequence in the learner's terms, not jargon", () => {
    const sites = sitesForRange(SURAH, 1, 3, COUNT);
    const atoms = atomsFor(sites, [1, 2, 3]);
    const graded = buildDrillPreview({ sites, atoms, mode: "graded" });
    const lap = buildDrillPreview({ sites, atoms, mode: "victory-lap" });

    expect(graded.structured).toBe(true);
    expect(graded.consequenceLabel).toBe("Slips will lower your strength.");
    expect(lap.structured).toBe(false);
    expect(lap.consequenceLabel).toBe(
      "Nothing can be damaged; this still counts toward your streak.",
    );
    for (const label of [graded.consequenceLabel, lap.consequenceLabel]) {
      expect(label.toLowerCase()).not.toContain("victory lap");
      expect(label.toLowerCase()).not.toContain("structured");
    }
  });

  // G6 — THE WORST REGRESSION. A victory lap that quietly grades would damage
  // exactly the strongest, most-loved verses during a celebration.
  // MUTATION: make structuredFor return true for "victory-lap". Confirmed RED.
  it("victory lap: a full all-wrong run cannot cost a single point of strength", () => {
    const sites = sitesForRange(SURAH, 1, 6, COUNT);
    const atoms = atomsFor(sites, [1, 2, 3, 4, 5, 6]);
    // Start strong — carry band, the state with the most to lose.
    for (const [key, atom] of atoms) atoms.set(key, { ...atom, strength: 92, stability: 30 });

    const p = buildDrillPreview({ sites, atoms, mode: "victory-lap" });
    expect(p.stepCount).toBe(11);

    for (const site of p.drilledSites) {
      const key = siteToAtomKey(site);
      const before = atoms.get(key) as AtomState;
      const after = update(
        before,
        { correct: false, kind: "review", ts: 1_000_000, structured: p.structured },

      );
      expect(after).toEqual(before);
      expect(after.strength).toBe(92);
      expect(after.lapses).toBe(before.lapses);
    }
  });

  // G7 — guards G6 against passing vacuously through some no-op path. If a
  // graded error did NOT move strength, G6 would prove nothing.
  // MUTATION: make structuredFor return false for "graded". Confirmed RED.
  it("graded: the same all-wrong run DOES cost strength", () => {
    const sites = sitesForRange(SURAH, 1, 6, COUNT);
    const atoms = atomsFor(sites, [1, 2, 3, 4, 5, 6]);
    for (const [key, atom] of atoms) atoms.set(key, { ...atom, strength: 92, stability: 30 });

    const p = buildDrillPreview({ sites, atoms, mode: "graded" });
    for (const site of p.drilledSites) {
      const before = atoms.get(siteToAtomKey(site)) as AtomState;
      const after = update(
        before,
        { correct: false, kind: "review", ts: 1_000_000, structured: p.structured },

      );
      expect(after.strength).toBeLessThan(before.strength);
      expect(after.lapses).toBe(before.lapses + 1);
    }
  });
});
