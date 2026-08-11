// v3-D21 classification tests (build-plan step 19, design §E.4).
//
// The one that matters most is "first match wins, in order" and the census.
// A classifier with no ruku/rhyme input DEGENERATES TO ALWAYS-ARC: it passes
// every per-surah ARC test while silently misclassifying the exact five
// surahs (3 RING + 2 LITANY) that motivated v3-D21. The census test is what
// catches that, which is why it is written here rather than left implicit.
//
// No Arabic literal appears in this file. Rhyme classes are transliterated
// class ids and verse texts are opaque comparison keys — v3/INVARIANTS.md
// Absolute B.

import { describe, expect, it } from "vitest";
import {
  ATOMIC_MAX_AYAT,
  STRIP_MAX_AYAT,
  classify,
  derivedBeats,
  dominantRhyme,
  evenSegments,
  verbatimRefrain,
  type MacroArchetype,
} from "../src/macro.ts";

describe("v3-D21 archetype classification", () => {
  it("ATOMIC at or below 8 ayat", () => {
    for (const n of [3, 5, 8]) {
      expect(classify({ ayahCount: n }).archetype).toBe("ATOMIC");
    }
  });

  it("ATOMIC reports no panel content and needs no honesty label", () => {
    const f = classify({ ayahCount: 3 });
    expect(f.ring).toBeUndefined();
    expect(f.litany).toBeUndefined();
    expect(f.arc).toBeUndefined();
    // Nothing is withheld on ATOMIC, so nothing is labelled derived.
    expect(f.authored).toBe(true);
  });

  it("RING when ruku >= 4 and the surah is not ATOMIC", () => {
    const f = classify({ ayahCount: 30, rukuCount: 4 });
    expect(f.archetype).toBe("RING");
    expect(f.ring?.rukuCount).toBe(4);
    expect(f.reason).toBe("ruku=4");
  });

  // ---- §E.4 #18. THE ORDER IS THE TEST. -----------------------------------
  it("FIRST MATCH WINS: a 6-ayah surah with ruku >= 4 is ATOMIC, not RING", () => {
    const f = classify({ ayahCount: 6, rukuCount: 5 });
    expect(f.archetype).toBe("ATOMIC");
    expect(f.ring).toBeUndefined();
  });

  it("FIRST MATCH WINS: RING beats LITANY when both would match", () => {
    const f = classify({
      ayahCount: 30,
      rukuCount: 4,
      rhymeClasses: Array.from({ length: 30 }, () => "uun"),
    });
    expect(f.archetype).toBe("RING");
  });

  it("LITANY on a dominant rhyme >= 70%", () => {
    // 24 of 30 = 80%.
    const rhymeClasses = Array.from({ length: 30 }, (_, i) => (i < 24 ? "uun" : "iim"));
    const f = classify({ ayahCount: 30, rukuCount: 1, rhymeClasses });
    expect(f.archetype).toBe("LITANY");
    expect(f.litany?.rhymeShare).toBeGreaterThanOrEqual(0.7);
    expect(f.litany?.rhymeLabel).toBe("uun");
  });

  it("a rhyme share just under 70% is NOT litany", () => {
    // 20 of 30 = 66.7%.
    const rhymeClasses = Array.from({ length: 30 }, (_, i) => (i < 20 ? "uun" : "iim"));
    expect(classify({ ayahCount: 30, rukuCount: 1, rhymeClasses }).archetype).toBe("ARC");
  });

  it("LITANY on a verbatim refrain even when no rhyme dominates", () => {
    const verseTexts = Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? "R" : `v${i}`));
    const f = classify({ ayahCount: 30, rukuCount: 1, verseTexts });
    expect(f.archetype).toBe("LITANY");
    expect(f.litany!.refrainAyat.length).toBeGreaterThanOrEqual(3);
    expect(f.reason).toMatch(/^refrain x\d+$/);
  });

  it("ARC is the default and is marked NOT authored (edge case #22)", () => {
    const f = classify({ ayahCount: 40, rukuCount: 1 });
    expect(f.archetype).toBe("ARC");
    expect(f.reason).toBe("default");
    // ARC's real beats are budgeted to M9. Until then the panel MUST be able
    // to say its structure is derived.
    expect(f.authored).toBe(false);
    expect(f.arc!.beats.every((b) => b.derived)).toBe(true);
  });

  it("an UNKNOWN ruku count never manufactures a RING", () => {
    // The blocker this whole module exists to close: with no ruku data, a
    // classifier must fall through, never guess.
    expect(classify({ ayahCount: 40 }).archetype).toBe("ARC");
    expect(classify({ ayahCount: 40, rukuCount: 0 }).archetype).toBe("ARC");
  });
});

describe("edge case #89 — the strip threshold", () => {
  it("N=9 is strip, N=10 is arc, read from DATA not from a component", () => {
    expect(classify({ ayahCount: 9, rukuCount: 4 }).layout).toBe("strip");
    expect(classify({ ayahCount: 10, rukuCount: 4 }).layout).toBe("arc");
  });

  it("the two adjacent thresholds are deliberately different", () => {
    // If someone "reconciles" these, this test says so out loud. v3-D21's
    // ATOMIC bound and #89's strip bound were independently ratified.
    expect(ATOMIC_MAX_AYAT).toBe(8);
    expect(STRIP_MAX_AYAT).toBe(9);
    expect(STRIP_MAX_AYAT).toBeGreaterThan(ATOMIC_MAX_AYAT);
  });

  it("a 9-ayah RING surah is ring-classified but strip-rendered", () => {
    const f = classify({ ayahCount: 9, rukuCount: 5 });
    expect(f.archetype).toBe("RING");
    expect(f.layout).toBe("strip");
  });
});

// ---- §E.4 #19. THE CENSUS. ------------------------------------------------
// v3-D21 measured its library: "ARC 21, ATOMIC 17, RING 3, LITANY 2" over 43
// surahs. A classifier that always returns ARC passes every single test above
// except this one.
describe("v3-D21 library census", () => {
  /** A synthetic 43-surah library whose SHAPE matches v3-D21's measurement.
   *  Values are structural facts (ayah counts, ruku counts, rhyme profiles),
   *  never text. */
  function library(): { ayahCount: number; rukuCount: number; rhymeClasses?: string[] }[] {
    const out: { ayahCount: number; rukuCount: number; rhymeClasses?: string[] }[] = [];
    // 17 ATOMIC: 3..8 ayat.
    for (let i = 0; i < 17; i++) out.push({ ayahCount: 3 + (i % 6), rukuCount: 1 });
    // 3 RING: long, ruku >= 4.
    for (let i = 0; i < 3; i++) out.push({ ayahCount: 60 + i, rukuCount: 4 + i });
    // 2 LITANY: long, one rhyme dominates.
    for (let i = 0; i < 2; i++) {
      const n = 30 + i;
      out.push({
        ayahCount: n,
        rukuCount: 1,
        rhymeClasses: Array.from({ length: n }, () => "uun"),
      });
    }
    // 21 ARC: long, low ruku, mixed rhyme.
    for (let i = 0; i < 21; i++) {
      const n = 20 + i;
      out.push({
        ayahCount: n,
        rukuCount: 1,
        rhymeClasses: Array.from({ length: n }, (_, k) => `r${k % 5}`),
      });
    }
    return out;
  }

  it("yields ARC 21 · ATOMIC 17 · RING 3 · LITANY 2", () => {
    const lib = library();
    expect(lib.length).toBe(43);
    const census: Record<MacroArchetype, number> = { ATOMIC: 0, RING: 0, LITANY: 0, ARC: 0 };
    for (const s of lib) census[classify(s).archetype] += 1;
    expect(census).toEqual({ ARC: 21, ATOMIC: 17, RING: 3, LITANY: 2 });
  });

  it("the classifier does not degenerate to a single archetype", () => {
    // The blocker, stated as an assertion: at least three distinct archetypes
    // must actually occur. A stub returning "ARC" for everything fails here.
    const kinds = new Set(library().map((s) => classify(s).archetype));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });
});

describe("helpers", () => {
  it("evenSegments partitions completely and contiguously", () => {
    const segs = evenSegments(10, 3);
    expect(segs[0]!.from).toBe(1);
    expect(segs[segs.length - 1]!.to).toBe(10);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i]!.from).toBe(segs[i - 1]!.to + 1);
    }
  });

  it("derivedBeats are all flagged derived", () => {
    expect(derivedBeats(30).every((b) => b.derived)).toBe(true);
  });

  it("dominantRhyme is null on empty input, never 0%", () => {
    expect(dominantRhyme([])).toBeNull();
  });

  it("verbatimRefrain returns [] when nothing repeats", () => {
    expect(verbatimRefrain(["a", "b", "c"])).toEqual([]);
  });

  it("verbatimRefrain finds the repeated ayah numbers", () => {
    expect(verbatimRefrain(["R", "x", "R", "y", "R"])).toEqual([1, 3, 5]);
  });
});
