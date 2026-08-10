// v2-D27: bilingual glosses. `wordGloss` is the single fallback chain every
// gloss-based question must go through — `gloss[lang] ?? gloss.en ?? text_uthmani`
// — and s1Options/bridgeItems must actually use it (never a hardcoded `.en`).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wordGloss } from "../src/corpus.ts";
import { initLadder, s1Options } from "../src/ladder.ts";
import type { Corpus, CorpusWord } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "fixtures/12.json"), "utf8"),
) as Corpus;

function word(gloss: { en: string | null; ms: string | null }): CorpusWord {
  return {
    ayah: 1,
    position: 1,
    // Synthetic placeholder — never real Quranic Arabic (v3/INVARIANTS.md
    // Absolute B). This test only checks that wordGloss() falls back to
    // WHATEVER text_uthmani holds; the content is never inspected as Arabic.
    text_uthmani: "PLACEHOLDER_SURFACE",
    lemma: null,
    root: null,
    class: null,
    gloss: { ...gloss, ja: null },
    act: null,
    sceneImage: null,
  };
}

describe("wordGloss — the v2-D27 fallback chain", () => {
  it("uses the requested language when present", () => {
    const w = word({ en: "said", ms: "berkata" });
    expect(wordGloss(w, "en")).toBe("said");
    expect(wordGloss(w, "ms")).toBe("berkata");
  });

  it("falls back to EN when the requested language is null", () => {
    const w = word({ en: "said", ms: null });
    expect(wordGloss(w, "ms")).toBe("said");
  });

  it("falls back to the Arabic surface when both EN and the requested language are null", () => {
    const w = word({ en: null, ms: null });
    expect(wordGloss(w, "ms")).toBe(w.text_uthmani);
    expect(wordGloss(w, "en")).toBe(w.text_uthmani);
  });

  it("defaults to EN when no lang is passed", () => {
    const w = word({ en: "said", ms: "berkata" });
    expect(wordGloss(w)).toBe("said");
  });
});

describe("s1Options honors the chosen gloss language (real corpus — MS is unsourced today)", () => {
  it("MS falls through to EN for every word (no ms gloss sourced yet, v2-D27)", () => {
    // v3-D25: rewritten to call s1Options directly rather than routing
    // through the retired nextItem — the retired call was incidental
    // plumbing to reach an S1 item, not itself under test here.
    const state = initLadder(corpus, 12, 1);
    const position = state.words[0]!.position;
    const en = s1Options(state, position, "en");
    const ms = s1Options(state, position, "ms");
    expect(ms.correct).toBe(en.correct);
    expect(ms.options).toEqual(en.options);
  });

  it("s1Options is lang-parameterized and defaults to en", () => {
    const state = initLadder(corpus, 12, 1);
    const defaulted = s1Options(state, 1);
    const explicit = s1Options(state, 1, "en");
    expect(defaulted).toEqual(explicit);
  });
});
