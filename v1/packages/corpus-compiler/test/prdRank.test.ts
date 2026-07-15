import { describe, expect, it } from "vitest";
import { mapPrdRank } from "../src/prdRank.ts";
import type { PrdRank, SrcType } from "../src/types.ts";
import { loadInputs, buildFromInputs } from "../src/io.ts";

const VALID: PrdRank[] = [
  "suffix-variant",
  "look-alike-verse",
  "same-root",
  "synonym",
  "class-neighbor",
];

describe("prd_rank mapping is total and stable", () => {
  it("always returns a valid rank for every src type", () => {
    const types: SrcType[] = ["visual", "semantic", "contextual", "phonetic"];
    for (const t of types) {
      const r = mapPrdRank({
        targetText: "ٱلْجَـٰهِلِينَ",
        targetRoot: "جهل",
        distractorText: "ٱلظَّـٰلِمِينَ",
        distractorRoot: "ظلم",
        srcType: t,
      });
      expect(VALID).toContain(r);
    }
  });

  it("detects suffix variants (nominative vs genitive plural)", () => {
    const r = mapPrdRank({
      targetText: "ٱلْجَـٰهِلِينَ",
      targetRoot: "جهل",
      distractorText: "ٱلْجَـٰهِلُونَ", // same stem, -oon vs -een
      distractorRoot: "جهل",
      srcType: "visual",
    });
    expect(r).toBe("suffix-variant");
  });

  it("labels shared-root distractors as same-root when not a suffix/visual case", () => {
    const r = mapPrdRank({
      targetText: "قَالَ",
      targetRoot: "قول",
      distractorText: "يَقُولُ",
      distractorRoot: "قول",
      srcType: "contextual",
    });
    expect(r).toBe("same-root");
  });

  it("maps semantic to synonym and unknown to class-neighbor", () => {
    expect(
      mapPrdRank({
        targetText: "ٱلْجَـٰهِلِينَ",
        targetRoot: "جهل",
        distractorText: "ٱلسَّـٰفِهِينَ",
        distractorRoot: "سفه",
        srcType: "semantic",
      }),
    ).toBe("synonym");
    expect(
      mapPrdRank({
        targetText: "حَيْثُ",
        targetRoot: null,
        distractorText: "مَتَىٰ",
        distractorRoot: null,
        srcType: "contextual",
      }),
    ).toBe("class-neighbor");
  });

  it("assigns a valid prd_rank to every distractor in the compiled corpus", () => {
    const inp = loadInputs();
    const corpus = buildFromInputs(inp);
    const bad = corpus.distractors.filter((d) => !VALID.includes(d.prd_rank));
    expect(bad).toEqual([]);
    // ranks are 1-based and contiguous per word
    const byWord = new Map<string, number[]>();
    for (const d of corpus.distractors) {
      const k = `${d.ayah}:${d.position}`;
      (byWord.get(k) ?? byWord.set(k, []).get(k)!).push(d.rank);
    }
    for (const [, ranks] of byWord) {
      const sorted = ranks.slice().sort((a, b) => a - b);
      expect(sorted[0]).toBe(1);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i]).toBe(sorted[i - 1]! + 1);
    }
  });
});
