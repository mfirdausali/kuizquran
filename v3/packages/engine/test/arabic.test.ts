// v3-D12 / DEFECTS.md#B6 / edge case #44: Arabic grading-equivalence
// normalization. NFC + tatweel-strip; harakat kept DISTINCT — two words
// differing only in vowel-marking are different words, and collapsing them
// would grade a wrong vowel-marking as correct. Every fixture here is either
// Latin (the same NFC code path harakat would exercise, without touching
// sacred text) or a codepoint built via String.fromCodePoint at runtime
// (v3/INVARIANTS.md Absolute B — this file's own bytes carry no Arabic-range
// codepoint); the corpus sweep below uses fixture COORDINATES only.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeArabicSurface, surfaceEquals } from "../src/arabic.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(readFileSync(resolve(HERE, "fixtures/12.json"), "utf8")) as Corpus;

describe("normalizeArabicSurface — NFC + tatweel-strip only", () => {
  it("NFC-normalizes (precomposed vs decomposed forms compare equal) — Latin fixture, same code path as harakat would exercise", () => {
    // Built via explicit code points so the two forms are guaranteed
    // distinct, regardless of any editor/tool-level Unicode normalization.
    const precomposed = "caf" + String.fromCodePoint(0xe9); // é precomposed
    const decomposed = "caf" + "e" + String.fromCodePoint(0x0301); // e + combining acute
    expect(precomposed).not.toBe(decomposed);
    expect(precomposed.length).not.toBe(decomposed.length);
    expect(normalizeArabicSurface(precomposed)).toBe(normalizeArabicSurface(decomposed));
  });

  it("strips tatweel (U+0640), a purely typographic elongation mark", () => {
    // Built via String.fromCodePoint rather than a literal character, so this
    // SOURCE FILE's own bytes carry no Arabic-range codepoint — only the
    // runtime string does, which is what normalizeArabicSurface operates on.
    const tatweel = String.fromCodePoint(0x0640);
    const withTatweel = "a" + tatweel + "b";
    const withoutTatweel = "ab";
    expect(normalizeArabicSurface(withTatweel)).toBe(normalizeArabicSurface(withoutTatweel));
  });

  it("keeps harakat (combining diacritics) DISTINCT — never folds them away", () => {
    // A bare consonant vs the same consonant + a combining diacritic mark
    // must NOT normalize to the same surface — harakat changes the word.
    const fatha = String.fromCodePoint(0x064e); // U+064E, a real harakat codepoint
    const bare = "b";
    const withMark = "b" + fatha;
    expect(normalizeArabicSurface(bare)).not.toBe(normalizeArabicSurface(withMark));
  });
});

describe("surfaceEquals — the grading comparison itself", () => {
  it("two NFC-equivalent strings compare equal", () => {
    expect(surfaceEquals("café", "café")).toBe(true);
  });

  it("tatweel-only differences compare equal", () => {
    const tatweel = String.fromCodePoint(0x0640);
    expect(surfaceEquals("a" + tatweel + "b", "ab")).toBe(true);
  });

  it("a harakat difference compares UNEQUAL", () => {
    const fatha = String.fromCodePoint(0x064e);
    expect(surfaceEquals("b", "b" + fatha)).toBe(false);
  });

  it("genuinely different surfaces compare unequal", () => {
    expect(surfaceEquals("PLACEHOLDER_A", "PLACEHOLDER_B")).toBe(false);
  });
});

describe("the 26/111 Yusuf ayat with a repeated normalized surface form (DEFECTS.md#B6's exact count)", () => {
  it("finds exactly 26 ayat with a repeated word, by fixture coordinate only", () => {
    const byAyah = new Map<number, string[]>();
    for (const w of corpus.words) {
      const list = byAyah.get(w.ayah) ?? [];
      list.push(w.text_uthmani);
      byAyah.set(w.ayah, list);
    }
    const repeated: number[] = [];
    for (const [ayah, texts] of byAyah) {
      const normalized = texts.map(normalizeArabicSurface);
      const hasDup = new Set(normalized).size !== normalized.length;
      if (hasDup) repeated.push(ayah);
    }
    repeated.sort((a, b) => a - b);
    expect(repeated).toHaveLength(26);
  });
});
