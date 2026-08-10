// Build-plan step 12 (WIREFRAME.md §23 Q4): admit(variant, fibre, ctx)'s
// 4-clause admissibility predicate — "no spec contains a bound check, no
// caller contains an `if`, no builder is ever called on an input admit()
// has not cleared." DECISIONS.md v3-D30: Variant/Lane are an explicitly
// flagged PLACEHOLDER shape (M4's own buildQuestion/kernels/render.ts own
// the real render surface) — this module only needs enough of a Variant to
// let admit() judge real corpus facts, which is what these tests exercise.
//
// Scoped to 3 lanes with real, already-shipped data support: s1, cloze,
// junction. rc/locate/reorder are range-level (not single-Site) generators
// that don't exist as single-Site enumerators yet — deferred, same
// "explicitly flagged, not forgotten" pattern as v3-D27/v3-D28.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  admit,
  admissibleVariants,
  buildResourceLedger,
  variants,
  type Variant,
} from "../src/variant.ts";
import type { Site } from "../src/site.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus: Corpus = JSON.parse(readFileSync(resolve(HERE, "fixtures/12.json"), "utf8"));

const AYAH4: Site = { kind: "ayah", surah: 12, ayah: 4 };
const SEAM4: Site = { kind: "seam", surah: 12, ayah: 4 };

describe("buildResourceLedger — clause 1's supply signals, counted once per site", () => {
  it("counts, per word position, siblings with a DISTINCT gloss (s1 supply) and rank<=4 distractors (cloze supply)", () => {
    const ledger = buildResourceLedger(corpus, AYAH4);
    // 12:4 is a real, multi-word ayah — every position should have at least
    // some sibling/distractor supply (the degenerate one-word case is
    // covered separately below with a synthetic corpus).
    for (const [, count] of ledger.s1SiblingCount) expect(count).toBeGreaterThanOrEqual(0);
    expect(ledger.s1SiblingCount.get(1)).toBeGreaterThan(0);
    expect(ledger.clozeDistractorCount.get(1)).toBeGreaterThan(0);
  });

  it("seam sites report successorExists instead of per-word supply", () => {
    const ledger = buildResourceLedger(corpus, SEAM4);
    expect(ledger.successorExists).toBe(true);
    expect(ledger.s1SiblingCount.size).toBe(0);
  });

  it("the LAST ayah's seam (never constructed by site.ts#expand, but buildResourceLedger must still be TOTAL) reports successorExists = false", () => {
    const lastSeam: Site = { kind: "seam", surah: 12, ayah: corpus.meta.ayahCount };
    const ledger = buildResourceLedger(corpus, lastSeam);
    expect(ledger.successorExists).toBe(false);
  });

  it("the one-word-ayah degenerate case (edge case #39/WIREFRAME's own 103:1 example): zero siblings, zero s1 supply", () => {
    const oneWord: Corpus = {
      meta: { surah: 103, ayahCount: 1, wordCount: 1 },
      verses: [],
      words: [
        {
          ayah: 1,
          position: 1,
          text_uthmani: "w1",
          lemma: null,
          root: null,
          class: null,
          gloss: { en: "Time", ms: null, ja: null },
          act: null,
          sceneImage: null,
        },
      ],
      distractors: [],
    };
    const site: Site = { kind: "ayah", surah: 103, ayah: 1 };
    const ledger = buildResourceLedger(oneWord, site);
    expect(ledger.s1SiblingCount.get(1)).toBe(0);
    expect(ledger.clozeDistractorCount.get(1)).toBe(0);
  });
});

describe("variants — the (placeholder, flagged) enumerator, per lane", () => {
  it("s1: one candidate per probeable word position, prompt = the correct gloss", () => {
    const vs = variants(corpus, AYAH4, "s1");
    expect(vs.length).toBeGreaterThan(0);
    for (const v of vs) {
      expect(v.lane).toBe("s1");
      expect(v.optionSurfaces[v.correctIndex]).toBe(v.prompt);
    }
  });

  it("cloze: one candidate per word position, never dropped for grouping (unlike s1)", () => {
    const s1 = variants(corpus, AYAH4, "s1");
    const cloze = variants(corpus, AYAH4, "cloze");
    // cloze enumerates every position; s1 may drop non-anchor group members —
    // so cloze's candidate count is never SMALLER than s1's.
    expect(cloze.length).toBeGreaterThanOrEqual(s1.length);
  });

  it("junction: exactly one candidate at a seam with a successor, none without one", () => {
    const withSuccessor = variants(corpus, SEAM4, "junction");
    expect(withSuccessor.length).toBe(1);
    const lastSeam: Site = { kind: "seam", surah: 12, ayah: corpus.meta.ayahCount };
    expect(variants(corpus, lastSeam, "junction")).toEqual([]);
  });

  it("lanes never enumerate at the wrong site kind (s1/cloze are ayah-only, junction is seam-only)", () => {
    expect(variants(corpus, SEAM4, "s1")).toEqual([]);
    expect(variants(corpus, SEAM4, "cloze")).toEqual([]);
    expect(variants(corpus, AYAH4, "junction")).toEqual([]);
  });
});

describe("admit — clause 1 (supply)", () => {
  it("rejects an s1 variant whose position has zero sibling supply", () => {
    const ledger = buildResourceLedger(corpus, AYAH4);
    const fake: Variant = { lane: "s1", site: AYAH4, position: 1, prompt: "x", optionSurfaces: ["x"], correctIndex: 0 };
    // Force zero supply for this test by asserting against a synthetic
    // ledger entry rather than mutating the real one.
    const starvedLedger = { ...ledger, s1SiblingCount: new Map(ledger.s1SiblingCount).set(1, 0) };
    expect(admit(fake, [fake], starvedLedger)).toBe(false);
  });

  it("admits a real s1 candidate with real supply", () => {
    const ledger = buildResourceLedger(corpus, AYAH4);
    const vs = variants(corpus, AYAH4, "s1");
    const v = vs[0]!;
    expect(admit(v, vs, ledger)).toBe(true);
  });
});

describe("admit — clause 2 (option-set distinctness under normalization)", () => {
  it("rejects a variant whose own option set has a duplicate under the lane's normalization", () => {
    const ledger = buildResourceLedger(corpus, AYAH4);
    // A fixture-coordinate reference (12:4 pos 1's own surface, not
    // hand-typed Arabic — INVARIANTS.md Absolute B) repeated twice IS a
    // duplicate under any normalization; that's the property under test.
    const surface = corpus.words.find((w) => w.ayah === 4 && w.position === 1)!.text_uthmani;
    const dup: Variant = {
      lane: "cloze",
      site: AYAH4,
      position: 1,
      prompt: "p",
      optionSurfaces: [surface, surface],
      correctIndex: 0,
    };
    const bulkLedger = { ...ledger, clozeDistractorCount: new Map(ledger.clozeDistractorCount).set(1, 5) };
    expect(admit(dup, [dup], bulkLedger)).toBe(false);
  });

  it("cloze/junction use Arabic surface normalization (NFC + tatweel-strip, v3-D12's own equivalence) — not byte equality", () => {
    const ledger = buildResourceLedger(corpus, AYAH4);
    // Built via String.fromCodePoint (Absolute B) inserted into a REAL
    // fixture-coordinate surface — never hand-typed Arabic.
    const TATWEEL = String.fromCodePoint(0x0640);
    const withoutTatweel = corpus.words.find((w) => w.ayah === 4 && w.position === 1)!.text_uthmani;
    const withTatweel = withoutTatweel.slice(0, 1) + TATWEEL + withoutTatweel.slice(1);
    const v: Variant = {
      lane: "cloze",
      site: AYAH4,
      position: 1,
      prompt: "p",
      optionSurfaces: [withTatweel, withoutTatweel],
      correctIndex: 0,
    };
    const bulkLedger = { ...ledger, clozeDistractorCount: new Map(ledger.clozeDistractorCount).set(1, 5) };
    // Under NFC+tatweel-strip normalization these ARE the same surface — clause 2 must catch it.
    expect(admit(v, [v], bulkLedger)).toBe(false);
  });
});

describe("admit — clause 3 (prompt uniqueness across the fibre — the decisive clause)", () => {
  it("the 12:6 pos 18/19 shape: two s1 variants sharing a prompt — the SECOND (by position) is dropped, the FIRST survives (never both dropped, never starved)", () => {
    const ledger = buildResourceLedger(corpus, AYAH4);
    const first: Variant = { lane: "s1", site: AYAH4, position: 3, prompt: "before ", optionSurfaces: ["before ", "x", "y"], correctIndex: 0 };
    const second: Variant = { lane: "s1", site: AYAH4, position: 5, prompt: "before ", optionSurfaces: ["before ", "x", "y"], correctIndex: 0 };
    const bulkLedger = {
      ...ledger,
      s1SiblingCount: new Map(ledger.s1SiblingCount).set(3, 5).set(5, 5),
    };
    const fibre = [first, second];
    expect(admit(first, fibre, bulkLedger)).toBe(true);
    expect(admit(second, fibre, bulkLedger)).toBe(false);
  });

  it("does not reject variants with distinct prompts", () => {
    const ledger = buildResourceLedger(corpus, AYAH4);
    const vs = variants(corpus, AYAH4, "s1");
    const admitted = admissibleVariants(corpus, AYAH4, "s1", ledger);
    // At least the real 12:4 fixture should not starve entirely — some s1
    // candidates must survive both clause 1 and clause 3.
    expect(admitted.length).toBeGreaterThan(0);
    expect(admitted.length).toBeLessThanOrEqual(vs.length);
  });

  it("cloze/junction prompts are positionally unique by construction and never collide", () => {
    const ledger = buildResourceLedger(corpus, AYAH4);
    const cloze = variants(corpus, AYAH4, "cloze");
    const prompts = new Set(cloze.map((v) => v.prompt));
    expect(prompts.size).toBe(cloze.length);
    expect(admissibleVariants(corpus, AYAH4, "cloze", ledger).length).toBe(cloze.length);
  });
});

describe("admit — clause 4 (fallback ladder, junction lane): escalate width rather than drop", () => {
  it("a junction variant is admissible whenever a successor exists, even in a tiny surah where 1-word openings might collide", () => {
    // Al-Asr-shaped: 3 short ayat whose openings could plausibly collide at
    // width 1 — clause 4 (escalating width) must still find a servable
    // variant rather than dropping the seam.
    const tiny: Corpus = {
      meta: { surah: 999, ayahCount: 3, wordCount: 6 },
      verses: [],
      words: [
        { ayah: 1, position: 1, text_uthmani: "A", lemma: null, root: null, class: null, gloss: { en: "a", ms: null, ja: null }, act: null, sceneImage: null },
        { ayah: 1, position: 2, text_uthmani: "B", lemma: null, root: null, class: null, gloss: { en: "b", ms: null, ja: null }, act: null, sceneImage: null },
        { ayah: 2, position: 1, text_uthmani: "A", lemma: null, root: null, class: null, gloss: { en: "a", ms: null, ja: null }, act: null, sceneImage: null },
        { ayah: 2, position: 2, text_uthmani: "C", lemma: null, root: null, class: null, gloss: { en: "c", ms: null, ja: null }, act: null, sceneImage: null },
        { ayah: 3, position: 1, text_uthmani: "A", lemma: null, root: null, class: null, gloss: { en: "a", ms: null, ja: null }, act: null, sceneImage: null },
        { ayah: 3, position: 2, text_uthmani: "D", lemma: null, root: null, class: null, gloss: { en: "d", ms: null, ja: null }, act: null, sceneImage: null },
      ],
      distractors: [],
    };
    const seam: Site = { kind: "seam", surah: 999, ayah: 1 };
    const vs = variants(tiny, seam, "junction");
    expect(vs.length).toBe(1);
    // At width 1 all three openings are literally "A" — a naive 1-word
    // junction item would be indistinct. The escalated variant's own
    // option set must still be internally distinct (clause 2's own check).
    expect(new Set(vs[0]!.optionSurfaces).size).toBe(vs[0]!.optionSurfaces.length);
  });
});
