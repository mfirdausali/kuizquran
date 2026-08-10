// Build-plan step 16: WIREFRAME.md §22's "hard problem 2, solved at the
// type level" — CorpusRef is a FIVE-variant closed union of pure
// coordinates (word, verse, gloss, distractor, ayahNumber). "There is no
// `{ literal: string }` member." Every answer/option slot in the question
// compiler is a CorpusRef resolved by the single function
// `resolveRef(corpus, ref)`, which can only return bytes ALREADY PRESENT
// in the compiled corpus — this is what makes hand-typed Arabic
// structurally unreachable from the compiler, not merely disciplined-away.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRef, type CorpusRef } from "../src/corpusRef.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus: Corpus = JSON.parse(readFileSync(resolve(HERE, "fixtures/12.json"), "utf8"));

describe("resolveRef — TOTAL, returns only bytes already present in the compiled corpus", () => {
  it("word: resolves to the exact text_uthmani at (ayah, position)", () => {
    const w = corpus.words.find((w) => w.ayah === 4 && w.position === 1)!;
    const ref: CorpusRef = { kind: "word", ayah: 4, position: 1 };
    expect(resolveRef(corpus, ref)).toBe(w.text_uthmani);
  });

  it("word: an out-of-range position resolves to null, never throws", () => {
    const ref: CorpusRef = { kind: "word", ayah: 4, position: 9999 };
    expect(resolveRef(corpus, ref)).toBeNull();
  });

  it("verse: resolves to the exact text_uthmani of the whole ayah", () => {
    const v = corpus.verses.find((v) => v.ayah === 4)!;
    const ref: CorpusRef = { kind: "verse", ayah: 4 };
    expect(resolveRef(corpus, ref)).toBe(v.text_uthmani);
  });

  it("verse: a nonexistent ayah resolves to null", () => {
    const ref: CorpusRef = { kind: "verse", ayah: 99999 };
    expect(resolveRef(corpus, ref)).toBeNull();
  });

  it("gloss: resolves via the same gloss[lang] ?? gloss.en ?? text_uthmani chain every other generator uses (v2-D27)", () => {
    const w = corpus.words.find((w) => w.ayah === 4 && w.position === 1)!;
    const ref: CorpusRef = { kind: "gloss", ayah: 4, position: 1, lang: "en" };
    expect(resolveRef(corpus, ref)).toBe(w.gloss.en ?? w.text_uthmani);
  });

  it("gloss: ms falls through to en when unsourced (v2-D27's own fallback, real for 1777/1777 words today)", () => {
    const ref: CorpusRef = { kind: "gloss", ayah: 4, position: 1, lang: "ms" };
    const w = corpus.words.find((w) => w.ayah === 4 && w.position === 1)!;
    expect(resolveRef(corpus, ref)).toBe(w.gloss.ms ?? w.gloss.en ?? w.text_uthmani);
  });

  it("distractor: resolves to the exact text at (ayah, position, rank)", () => {
    const d = corpus.distractors.find((d) => d.ayah === 4 && d.position === 1 && d.rank === 1)!;
    const ref: CorpusRef = { kind: "distractor", ayah: 4, position: 1, rank: 1 };
    expect(resolveRef(corpus, ref)).toBe(d.text);
  });

  it("distractor: a rank with no row resolves to null", () => {
    const ref: CorpusRef = { kind: "distractor", ayah: 4, position: 1, rank: 999 };
    expect(resolveRef(corpus, ref)).toBeNull();
  });

  it("ayahNumber: resolves to the ayah number itself, only when that ayah exists in this corpus", () => {
    expect(resolveRef(corpus, { kind: "ayahNumber", ayah: 4 })).toBe(4);
    expect(resolveRef(corpus, { kind: "ayahNumber", ayah: 99999 })).toBeNull();
  });

  it("never crashes on any of the 5 variants for a garbage coordinate", () => {
    const refs: CorpusRef[] = [
      { kind: "word", ayah: -1, position: -1 },
      { kind: "verse", ayah: 0 },
      { kind: "gloss", ayah: -5, position: -5, lang: "en" },
      { kind: "distractor", ayah: 0, position: 0, rank: -1 },
      { kind: "ayahNumber", ayah: -1 },
    ];
    for (const ref of refs) expect(() => resolveRef(corpus, ref)).not.toThrow();
  });
});
