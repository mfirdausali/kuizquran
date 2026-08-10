// DEFECTS.md#B4: override ties are unordered. `applyOverrides` sorted on
// `createdAt` alone; two rows sharing a millisecond (the seeder bulk-inserts
// this way) fell back to array/DB row order — nondeterministic. Fix:
// order by `(createdAt, id)`. Must land before the first B3 verification
// hash row (H3): a hash computed under nondeterministic tie ordering is a
// nondeterministic hash.
//
// PLACEHOLDER text throughout — never real Quranic Arabic (v3/INVARIANTS.md
// Absolute B); this is synthetic engine-level fixture data, not corpus
// content.

import { describe, expect, it } from "vitest";
import { applyOverrides, type QuestionOverride } from "../src/overrides.ts";
import type { Corpus } from "../src/types.ts";

function corpusWithOneWord(): Corpus {
  return {
    meta: { surah: 12, ayahCount: 1, wordCount: 1 },
    verses: [{ ayah: 1, text_uthmani: "PLACEHOLDER", page: null, line: null }],
    words: [
      {
        ayah: 1,
        position: 1,
        text_uthmani: "PLACEHOLDER",
        lemma: null,
        root: null,
        class: null,
        gloss: { en: "original", ms: null, ja: null },
        act: null,
        sceneImage: null,
      },
    ],
    distractors: [],
  };
}

function gloss(id: number, createdAt: number, text: string): QuestionOverride {
  return {
    id,
    surah: 12,
    ayah: 1,
    position: 1,
    questionType: "S1",
    field: "gloss",
    payload: { lang: "en", text },
    createdAt,
  };
}

describe("applyOverrides — same-millisecond ties order by (createdAt, id)", () => {
  it("two rows sharing createdAt: the HIGHER id wins, regardless of array order", () => {
    const lowIdFirst = applyOverrides(corpusWithOneWord(), [gloss(5, 1000, "first"), gloss(9, 1000, "second")]);
    const highIdFirst = applyOverrides(corpusWithOneWord(), [gloss(9, 1000, "second"), gloss(5, 1000, "first")]);
    // Same logical outcome regardless of the array's own order — id 9 always
    // wins over id 5 when createdAt ties, because 9 is the later DB row.
    expect(lowIdFirst.corpus.words[0]!.gloss.en).toBe("second");
    expect(highIdFirst.corpus.words[0]!.gloss.en).toBe("second");
  });

  it("a same-millisecond fixture is stable across repeated runs (determinism)", () => {
    const overrides = [gloss(3, 2000, "a"), gloss(7, 2000, "b"), gloss(1, 2000, "c")];
    const runs = Array.from({ length: 5 }, () => applyOverrides(corpusWithOneWord(), overrides).corpus.words[0]!.gloss.en);
    expect(new Set(runs).size).toBe(1); // every run agrees
    expect(runs[0]).toBe("b"); // id 7 is the highest of {3,7,1}
  });

  it("createdAt still takes precedence when it actually differs (id is only a tie-break)", () => {
    // id 9 < id 1's numeric value is false (9 > 1), so if id alone decided
    // this, id 9's row would win — but its createdAt (1000) is EARLIER, so
    // the later createdAt (2000, id 1) must still win.
    const result = applyOverrides(corpusWithOneWord(), [gloss(9, 1000, "earlier"), gloss(1, 2000, "later")]);
    expect(result.corpus.words[0]!.gloss.en).toBe("later");
  });
});
