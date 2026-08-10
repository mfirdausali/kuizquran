// Build-plan step 4: geometry merge (mushaf page per verse, line_number per
// word), landing at "step 3-4" per BUILD-PLAN.md line 77. Only page/line
// NUMBERS are asserted — never Arabic text (v3/INVARIANTS.md Absolute B).

import { describe, expect, it } from "vitest";
import { loadInputs, buildFromInputs } from "../src/io.ts";
import { buildCorpus } from "../src/buildCorpus.ts";

describe("geometry merge (build-plan step 4)", () => {
  it("surah 12 (Yusuf) — every verse carries a page number, 12:1 starts page 235", () => {
    const corpus = buildFromInputs(loadInputs(12));
    expect(corpus.meta.hasGeometry).toBe(true);
    const v1 = corpus.verses.find((v) => v.ayah === 1)!;
    expect(v1.page).toBe(235);
    for (const v of corpus.verses) {
      expect(v.page, `ayah ${v.ayah} missing page`).not.toBeNull();
      expect(v.page).toBeGreaterThanOrEqual(235);
    }
  });

  it("surah 12:1 line 11 — the exact edge-case-register fact (#11: 'surah starts mid-page')", () => {
    const corpus = buildFromInputs(loadInputs(12));
    const firstWord = corpus.words.find((w) => w.ayah === 1 && w.position === 1)!;
    expect(firstWord.line).toBe(11);
  });

  it("every word carries a non-null positive line number when geometry is present", () => {
    for (const surah of [12, 103, 112]) {
      const corpus = buildFromInputs(loadInputs(surah));
      for (const w of corpus.words) {
        expect(w.line, `surah ${surah} ${w.ayah}:${w.position} missing line`).not.toBeNull();
        expect(w.line).toBeGreaterThan(0);
      }
    }
  });

  it("surah 103 (Al-Asr) is entirely on page 601; surah 112 (Al-Ikhlas) on page 604", () => {
    const alAsr = buildFromInputs(loadInputs(103));
    const ikhlas = buildFromInputs(loadInputs(112));
    expect(new Set(alAsr.verses.map((v) => v.page))).toEqual(new Set([601]));
    expect(new Set(ikhlas.verses.map((v) => v.page))).toEqual(new Set([604]));
  });

  it("without vendored geometry, verses/words degrade to null page/line and hasGeometry is false", () => {
    const corpus = buildCorpus({
      surah: 999,
      verses: [
        {
          verse_number: 1,
          text_uthmani: "PLACEHOLDER",
          words: [{ position: 1, text_uthmani: "PLACEHOLDER", translation: "placeholder" }],
        },
      ],
      mcqItems: [],
      morph: new Map(),
      generatedFrom: [],
      // geometry intentionally omitted
    });
    expect(corpus.meta.hasGeometry).toBe(false);
    expect(corpus.verses[0].page).toBeNull();
    expect(corpus.words[0].line).toBeNull();
  });

  it("hard-fails loudly on a geometry/word-count mismatch per ayah, rather than silently mis-mapping", () => {
    expect(() =>
      buildCorpus({
        surah: 999,
        verses: [
          {
            verse_number: 1,
            text_uthmani: "PLACEHOLDER",
            words: [
              { position: 1, text_uthmani: "PLACEHOLDER_A", translation: "a" },
              { position: 2, text_uthmani: "PLACEHOLDER_B", translation: "b" },
            ],
          },
        ],
        mcqItems: [],
        morph: new Map(),
        generatedFrom: [],
        geometry: [
          {
            verse_number: 1,
            page_number: 1,
            // only ONE word of geometry for a two-word ayah — must not silently zip-mismatch
            words: [{ position: 1, line_number: 1 }],
          },
        ],
      }),
    ).toThrow(/geometry/i);
  });
});
