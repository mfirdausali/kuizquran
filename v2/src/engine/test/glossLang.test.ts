// v2-D27: bilingual glosses. `wordGloss` is the single fallback chain every
// gloss-based question must go through — `gloss[lang] ?? gloss.en ?? text_uthmani`
// — and s1Options/bridgeItems must actually use it (never a hardcoded `.en`).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wordGloss } from "../src/corpus.ts";
import { initLadder, nextItem, s1Options } from "../src/ladder.ts";
import { bridgeItems } from "../src/bridge.ts";
import type { Corpus, CorpusWord } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../public/corpus/12.json"), "utf8"),
) as Corpus;

function word(gloss: { en: string | null; ms: string | null }): CorpusWord {
  return {
    ayah: 1,
    position: 1,
    text_uthmani: "قَالَ",
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
    let state = initLadder(corpus, 12, 1);
    const en = nextItem(state, corpus, "en");
    const ms = nextItem(state, corpus, "ms");
    expect("done" in en || "done" in ms).toBe(false);
    if ("rung" in en && en.rung === "S1" && "rung" in ms && ms.rung === "S1") {
      expect(ms.correct).toBe(en.correct);
      expect(ms.options).toEqual(en.options);
    } else {
      throw new Error("expected S1 items");
    }
  });

  it("s1Options is lang-parameterized and defaults to en", () => {
    const state = initLadder(corpus, 12, 1);
    const defaulted = s1Options(state, 1);
    const explicit = s1Options(state, 1, "en");
    expect(defaulted).toEqual(explicit);
  });
});

describe("bridgeItems honors the chosen gloss language", () => {
  it("MS falls through to EN for every opening word (no ms gloss sourced yet)", () => {
    const en = bridgeItems(corpus, 4, "en");
    const ms = bridgeItems(corpus, 4, "ms");
    expect(ms.map((i) => i.correct)).toEqual(en.map((i) => i.correct));
    expect(ms.map((i) => i.options)).toEqual(en.map((i) => i.options));
  });

  it("defaults to en when no lang is passed", () => {
    expect(bridgeItems(corpus, 4)).toEqual(bridgeItems(corpus, 4, "en"));
  });
});
