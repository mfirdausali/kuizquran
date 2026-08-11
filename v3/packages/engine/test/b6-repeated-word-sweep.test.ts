// DEFECTS.md#B6's closing criterion: "proven by a sweep over all 26 ayat"
// containing a repeated Arabic surface form. Only structural coordinates
// (ayah/position numbers, repeat counts) are asserted — never Arabic text
// (v3/INVARIANTS.md Absolute B).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initReconstruct, advanceReconstruct } from "../src/reconstruct.ts";
import { normalizeArabicSurface } from "../src/arabic.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(readFileSync(resolve(HERE, "fixtures/12.json"), "utf8")) as Corpus;

// Built via String.fromCodePoint, never a literal, so this file's own bytes
// carry no Arabic-range codepoint (v3/INVARIANTS.md Absolute B) — mirrors
// arabic.ts's own TATWEEL construction exactly.
const TATWEEL = String.fromCodePoint(0x0640);

/**
 * Splice TATWEEL into the middle of a corpus surface form, mechanically —
 * never a literal Arabic character. The result differs from the input at the
 * raw-byte level (so `===` fails on it) but is byte-identical after
 * `normalizeArabicSurface` strips the tatweel back out.
 */
function tatweelInject(surface: string): string {
  const mid = Math.floor(surface.length / 2);
  return surface.slice(0, mid) + TATWEEL + surface.slice(mid);
}

/** Every ayah with at least one normalized-surface repeat among its words. */
function ayatWithRepeatedWords(): number[] {
  const byAyah = new Map<number, string[]>();
  for (const w of corpus.words) {
    const list = byAyah.get(w.ayah) ?? [];
    list.push(w.text_uthmani);
    byAyah.set(w.ayah, list);
  }
  const repeated: number[] = [];
  for (const [ayah, texts] of byAyah) {
    const normalized = texts.map(normalizeArabicSurface);
    if (new Set(normalized).size !== normalized.length) repeated.push(ayah);
  }
  return repeated.sort((a, b) => a - b);
}

describe("DEFECTS.md#B6 — the exact repeated-word ayah count", () => {
  it("is exactly 26 (DEFECTS.md's own number)", () => {
    expect(ayatWithRepeatedWords()).toHaveLength(26);
  });
});

describe("B6 sweep: reconstruct grades every position correctly on every repeated-word ayah", () => {
  const repeated = ayatWithRepeatedWords();

  for (const ayah of repeated) {
    it(`ayah ${ayah}: a full, all-correct reconstruct pass grades every blank correct, in position order (no false negative on a repeated-word position)`, () => {
      // Carry-band strength (>=80) forces whole-ayah blanking — every
      // position in the ayah is graded by this pass, including every
      // repeated-word position this ayah has.
      let state = initReconstruct(corpus, 12, ayah, 100);
      const total = state.blankPositions.length;
      let completed = false;
      for (let i = 0; i < total; i++) {
        const pos = state.blankPositions[state.blankIndex]!;
        const expected = corpus.words.find((w) => w.ayah === ayah && w.position === pos)!;
        const r = advanceReconstruct(state, corpus, expected.text_uthmani);
        expect(r.correct, `ayah ${ayah} position ${pos}`).toBe(true);
        state = r.state;
        if (r.ayahProduced) completed = true;
      }
      expect(completed).toBe(true);
      expect(state.blankIndex).toBe(total);
    });

    it(`ayah ${ayah}: an unrelated wrong surface at a repeated-word position is graded wrong (no false positive)`, () => {
      const words = corpus.words.filter((w) => w.ayah === ayah).sort((a, b) => a.position - b.position);
      const counts = new Map<string, number>();
      for (const w of words) {
        const n = normalizeArabicSurface(w.text_uthmani);
        counts.set(n, (counts.get(n) ?? 0) + 1);
      }
      const dupWord = words.find((w) => counts.get(normalizeArabicSurface(w.text_uthmani))! > 1)!;
      // A genuinely different surface, from elsewhere in the whole corpus,
      // not related to this ayah's own vocabulary.
      const unrelated = corpus.words.find(
        (w) => normalizeArabicSurface(w.text_uthmani) !== normalizeArabicSurface(dupWord.text_uthmani),
      )!.text_uthmani;

      // Drive to dupWord's own position, answering correctly along the way.
      let state = initReconstruct(corpus, 12, ayah, 100);
      while (state.blankPositions[state.blankIndex] !== dupWord.position) {
        const pos = state.blankPositions[state.blankIndex]!;
        const w = corpus.words.find((x) => x.ayah === ayah && x.position === pos)!;
        state = advanceReconstruct(state, corpus, w.text_uthmani).state;
      }
      const r = advanceReconstruct(state, corpus, unrelated);
      expect(r.correct).toBe(false);
    });

    it(`ayah ${ayah}: a tatweel-injected form of the repeated-word answer still grades correct (proves grading NORMALIZES, not byte-compares)`, () => {
      // v3-D12 / arabic.ts's own doc comment: "a tap that differs only in
      // inconsequential Unicode encoding still grades correct". The prior two
      // cases in this sweep both answer with `expected.text_uthmani`
      // verbatim, which trivially satisfies a raw `===` too — neither
      // exercises normalizeArabicSurface at all. This one answers with a
      // form that DIFFERS at the raw-byte level from the corpus text, so a
      // reversion to `choice === item.correct` (DEFECTS.md#B6's literal
      // defect) fails this assertion while `surfaceEquals` passes it.
      const words = corpus.words.filter((w) => w.ayah === ayah).sort((a, b) => a.position - b.position);
      const counts = new Map<string, number>();
      for (const w of words) {
        const n = normalizeArabicSurface(w.text_uthmani);
        counts.set(n, (counts.get(n) ?? 0) + 1);
      }
      const dupWord = words.find((w) => counts.get(normalizeArabicSurface(w.text_uthmani))! > 1)!;

      let state = initReconstruct(corpus, 12, ayah, 100);
      while (state.blankPositions[state.blankIndex] !== dupWord.position) {
        const pos = state.blankPositions[state.blankIndex]!;
        const w = corpus.words.find((x) => x.ayah === ayah && x.position === pos)!;
        state = advanceReconstruct(state, corpus, w.text_uthmani).state;
      }
      const injected = tatweelInject(dupWord.text_uthmani);
      expect(injected).not.toBe(dupWord.text_uthmani); // genuinely different raw bytes
      const r = advanceReconstruct(state, corpus, injected);
      expect(r.correct, `ayah ${ayah} position ${dupWord.position}`).toBe(true);
    });
  }
});
