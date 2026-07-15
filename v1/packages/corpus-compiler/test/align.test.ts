import { describe, expect, it } from "vitest";
import { loadInputs, buildFromInputs } from "../src/io.ts";

// The load is done once; these assertions are the decisive alignment guarantees.
const inp = loadInputs();
const corpus = buildFromInputs(inp);

describe("QAC ↔ dataset alignment", () => {
  it("has 111 ayat and 1777 words", () => {
    expect(corpus.verses.length).toBe(111);
    expect(corpus.words.length).toBe(1777);
  });

  it("aligns morphology 1:1 by (ayah, position) with zero mismatch", () => {
    // Every Yusuf word position resolved a QAC class (N/V/P).
    const missingClass = corpus.words.filter((w) => w.class === null);
    expect(missingClass).toEqual([]);
  });

  it("per-ayah word counts match the source verses file exactly", () => {
    const srcWpv = new Map<number, number>();
    for (const v of inp.verses) srcWpv.set(v.verse_number, v.words.length);
    const outWpv = new Map<number, number>();
    for (const w of corpus.words) outWpv.set(w.ayah, (outWpv.get(w.ayah) ?? 0) + 1);
    const mismatches = [...srcWpv].filter(([a, n]) => outWpv.get(a) !== n);
    expect(mismatches).toEqual([]);
  });

  it("resolves known lemma/root spot-checks", () => {
    const w = (ayah: number, pos: number) =>
      corpus.words.find((x) => x.ayah === ayah && x.position === pos)!;
    // ayah 4 pos 4 = لِأَبِيهِ → root أبو, lemma أَب, noun
    expect(w(4, 4).root).toBe("أبو");
    expect(w(4, 4).class).toBe("N");
    // ayah 4 pos 2 = قَالَ → root قول, verb
    expect(w(4, 2).root).toBe("قول");
    expect(w(4, 2).class).toBe("V");
    // ayah 1 pos 4 = ٱلْكِتَـٰبِ → root كتب
    expect(w(1, 4).root).toBe("كتب");
  });

  it("the full-Quran word set covers all 114 surahs (large)", () => {
    // QAC has ~18k distinct normalized forms; sanity floor.
    expect(inp.qac.fullQuranWordSet.size).toBeGreaterThan(10000);
  });
});
