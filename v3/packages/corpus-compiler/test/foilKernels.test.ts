// Foil kernels — NIGHTLY.md "Distractors — decided", closing D51.
//
// v3/INVARIANTS.md Absolute B: no Quranic Arabic literal appears here. Tests
// reference fixture COORDINATES and synthetic ASCII placeholders; every real
// Arabic value is READ from compiled corpus bytes at test time and asserted on
// only as counts, medians, booleans and coordinates.
//
// The bar these tests are written against (§E): a foil must be GOOD, not merely
// PRESENT. Asserting "four rows exist" is satisfied by four arbitrary attested
// words — so the similarity-gradient tests below compare kernel output against
// surah 12's AUTHORED baseline rather than a number chosen by hand.

import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { buildCorpus } from "../src/buildCorpus.ts";
import { buildPool, compareCandidates, FoilSet, gradeKey, generateFoils } from "../src/foilKernels.ts";
import { buildFromInputs, buildFoilPool, loadInputs } from "../src/io.ts";
import { normalizeArabic, scriptSimilarity } from "../src/normalize.ts";
import { normalizeArabicSurface, surfaceEquals } from "../../engine/src/arabic.ts";
import type { CorpusJson, RawVerse, Word } from "../src/types.ts";

// ---------------------------------------------------------------------------
// helpers (synthetic, ASCII only)
// ---------------------------------------------------------------------------

function fixtureVerses(ayahCount: number, wordsPerAyah: number): RawVerse[] {
  const out: RawVerse[] = [];
  for (let ayah = 1; ayah <= ayahCount; ayah++) {
    const words = [];
    for (let position = 1; position <= wordsPerAyah; position++) {
      words.push({
        position,
        text_uthmani: `placeholder-${ayah}-${position}`,
        translation: `gloss-${ayah}-${position}`,
      });
    }
    out.push({ verse_number: ayah, text_uthmani: `placeholder-verse-${ayah}`, words });
  }
  return out;
}

function poolFromWords(words: Word[]): Map<string, ReturnType<typeof buildPool> extends Map<string, infer V> ? V : never> {
  return buildPool(new Map([[words[0]!.surah, words]]));
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Compiled corpora, built once — compiling surah 12 is the expensive part. */
const compiled = new Map<number, CorpusJson>();
function corpusOf(surah: number): CorpusJson {
  let c = compiled.get(surah);
  if (!c) {
    c = buildFromInputs(loadInputs(surah));
    compiled.set(surah, c);
  }
  return c;
}

function targetTextMap(c: CorpusJson): Map<string, string> {
  const m = new Map<string, string>();
  for (const w of c.words) m.set(`${w.ayah}:${w.position}`, w.text_uthmani);
  return m;
}

// ---------------------------------------------------------------------------
// The grading-key contract — the reason #7/#9 cannot drift back
// ---------------------------------------------------------------------------

describe("grading key is the ENGINE's, not the compiler's broader fold", () => {
  it("agrees with engine/src/arabic.ts on every word of every compiled surah", () => {
    for (const surah of [12, 103, 112]) {
      for (const w of corpusOf(surah).words) {
        expect(gradeKey(w.text_uthmani)).toBe(normalizeArabicSurface(w.text_uthmani));
      }
    }
  });

  it("is NARROWER than normalizeArabic — the compiler fold would delete legitimate foils", () => {
    // 304 rank<=4 sibling pairs in surah 12 collide under normalizeArabic but are
    // genuinely different words under the engine's grading key. Deduping with the
    // wrong normalization would delete ~275 legitimate option sets.
    const c = corpusOf(12);
    const byCoord = new Map<string, string[]>();
    for (const d of c.distractors) {
      if (d.rank > 4) continue;
      const k = `${d.ayah}:${d.position}`;
      if (!byCoord.has(k)) byCoord.set(k, []);
      byCoord.get(k)!.push(d.text);
    }
    let broadCollisions = 0;
    let gradeCollisions = 0;
    for (const texts of byCoord.values()) {
      if (new Set(texts.map(normalizeArabic)).size !== texts.length) broadCollisions++;
      if (new Set(texts.map(gradeKey)).size !== texts.length) gradeCollisions++;
    }
    expect(gradeCollisions).toBe(0);
    expect(broadCollisions).toBeGreaterThan(0); // the broad fold really is broader
  });
});

// ---------------------------------------------------------------------------
// §B — #7 and #9 are structurally impossible
// ---------------------------------------------------------------------------

describe("FoilSet accumulator — the only path from a kernel to the output", () => {
  it("#7: rejects a candidate grade-equal to the target (ASCII + tatweel fixture)", () => {
    const TATWEEL = String.fromCodePoint(0x0640);
    const set = new FoilSet("target-form");
    expect(set.admit({ surface: "target-form", srcType: "visual", score: 1, why: "x" })).toBe(false);
    // byte-DIFFERENT but grade-IDENTICAL — the exact shape of the three live
    // surah-12 rows. Byte equality would let this through.
    expect(set.admit({ surface: `target${TATWEEL}-form`, srcType: "visual", score: 1, why: "x" })).toBe(false);
    expect(set.size).toBe(0);
  });

  it("#9: rejects a second candidate grade-equal to an admitted sibling", () => {
    const TATWEEL = String.fromCodePoint(0x0640);
    const set = new FoilSet("target-form");
    expect(set.admit({ surface: "foil-a", srcType: "visual", score: 1, why: "x" })).toBe(true);
    expect(set.admit({ surface: `foil${TATWEEL}-a`, srcType: "phonetic", score: 1, why: "x" })).toBe(false);
    expect(set.size).toBe(1);
  });
});

describe("no compiled surah ships a foil that grades correct (#7) or a duplicate sibling (#9)", () => {
  for (const surah of [12, 103, 112]) {
    it(`surah ${surah}: 0 grade-correct foils and 0 sibling collisions, all ranks`, () => {
      const c = corpusOf(surah);
      const target = targetTextMap(c);
      const byCoord = new Map<string, string[]>();
      let gradeCorrect = 0;
      for (const d of c.distractors) {
        const t = target.get(`${d.ayah}:${d.position}`);
        expect(t).toBeDefined();
        if (surfaceEquals(d.text, t!)) gradeCorrect++;
        const k = `${d.ayah}:${d.position}`;
        if (!byCoord.has(k)) byCoord.set(k, []);
        byCoord.get(k)!.push(d.text);
      }
      expect(gradeCorrect).toBe(0);
      let dupSiblings = 0;
      for (const texts of byCoord.values()) {
        if (new Set(texts.map(gradeKey)).size !== texts.length) dupSiblings++;
      }
      expect(dupSiblings).toBe(0);
    });
  }

  it("surah 12's three live tatweel rows are gone (12:21 p15, 12:22 p7, 12:24 p11)", () => {
    const c = corpusOf(12);
    const target = targetTextMap(c);
    for (const [ayah, position] of [[21, 15], [22, 7], [24, 11]] as const) {
      const t = target.get(`${ayah}:${position}`)!;
      const rows = c.distractors.filter((d) => d.ayah === ayah && d.position === position);
      expect(rows.length).toBeGreaterThan(0);
      for (const d of rows) expect(surfaceEquals(d.text, t)).toBe(false);
      // and the coordinate is recorded as having had a collision dropped
      expect(c.meta.droppedCollisions).toContainEqual({ ayah, position });
    }
  });
});

// ---------------------------------------------------------------------------
// §A/§C — D51: the headline. Every blank offers a real option set.
// ---------------------------------------------------------------------------

describe("D51 — kernels fill the surahs that shipped zero distractors", () => {
  for (const surah of [103, 112]) {
    it(`surah ${surah}: every word gets >=4 foils at rank<=4, all kernel-origin`, () => {
      const c = corpusOf(surah);
      expect(c.distractors.length).toBeGreaterThan(0);
      for (const w of c.words) {
        const atRank4 = c.distractors.filter(
          (d) => d.ayah === w.ayah && d.position === w.position && d.rank <= 4,
        );
        // >=1 is the hard release bar (a one-option "quiz" is D51's slot machine);
        // >=4 is what the measured pool actually delivers for these surahs.
        expect(atRank4.length).toBeGreaterThanOrEqual(4);
      }
      expect(c.distractors.every((d) => d.origin === "kernel")).toBe(true);
    });
  }

  it("every kernel foil is real corpus bytes — never authored Arabic (rule 1)", () => {
    // Structural: a kernel can only emit a `surface` that came from the pool,
    // and the pool is built from compiled corpus words. Assert the invariant
    // directly against the union of all vendored surahs' word forms.
    // The pool is EVERY compiled surah, read from the manifest — not a
    // hardcoded list. When Al-Mulk (67) was added as the Q3 launch surah, a
    // hardcoded [12, 103, 112] made this test fail on 18 foils that were
    // perfectly legitimate Al-Mulk word forms: the kernel had correctly widened
    // its pool and the test had not. A sacred-text assertion that cries wolf on
    // real corpus bytes is worse than none — the next person to see it red will
    // assume the pool is stale again and wave it through, on the one test in
    // this repo that must never be waved through.
    // Derived from the VENDORED raw inputs, which are the real source of the
    // pool — not from output/, which is gitignored (v3-D52) and absent on a
    // clean checkout.
    const rawDir = new URL("../data/raw/", import.meta.url);
    const vendoredSurahs = readdirSync(rawDir)
      .map((f) => /^(\d+)-verses\.json$/.exec(f)?.[1])
      .filter((s): s is string => Boolean(s))
      .map(Number)
      .sort((a, b) => a - b);
    expect(vendoredSurahs.length).toBeGreaterThanOrEqual(3);

    const poolKeys = new Set<string>();
    for (const surah of vendoredSurahs) {
      for (const w of corpusOf(surah).words) poolKeys.add(gradeKey(w.text_uthmani));
    }
    for (const surah of [103, 112]) {
      for (const d of corpusOf(surah).distractors) {
        expect(poolKeys.has(gradeKey(d.text))).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// §D — override precedence, per COORDINATE
// ---------------------------------------------------------------------------

describe("override layer — authored wins per coordinate, kernels fill the rest", () => {
  it("authored wins where present: surah 12 emits ZERO kernel rows", () => {
    const c = corpusOf(12);
    expect(c.distractors.length).toBeGreaterThan(0);
    expect(c.meta.distractorOrigin.kernel).toBe(0);
    expect(c.distractors.every((d) => d.origin === "authored")).toBe(true);
  });

  it("kernels fill where absent: 112 is wholly kernel-origin", () => {
    const c = corpusOf(112);
    expect(c.meta.distractorOrigin.authored).toBe(0);
    expect(c.meta.distractorOrigin.kernel).toBe(c.distractors.length);
  });

  it("precedence is per-COORDINATE, not per-surah (the plausible-but-wrong impl)", () => {
    // A fixture surah with authored rows on SOME coordinates and none on others.
    // A per-surah guard would leave the unauthored coordinates empty.
    const verses = fixtureVerses(2, 3); // 6 coordinates
    const words: Word[] = [];
    for (const v of verses) {
      for (const w of v.words) {
        words.push({
          surah: 999, ayah: v.verse_number, position: w.position,
          text_uthmani: w.text_uthmani, lemma: null, root: null, class: null,
          gloss: { en: w.translation, ms: null, ja: null },
          act: null, sceneImage: null, line: null,
        });
      }
    }
    const corpus = buildCorpus({
      surah: 999,
      verses,
      mcqItems: [
        {
          verse: 1, position: 1, word: "placeholder-1-1", translation: "g",
          clozeStem: "___", correct: "placeholder-1-1",
          distractors: [
            { text: "authored-foil-a", type: "visual", why: "fixture" },
            { text: "authored-foil-b", type: "semantic", why: "fixture" },
          ],
        },
      ],
      morph: new Map(),
      foilPool: poolFromWords(words),
      generatedFrom: ["fixture"],
    });

    const at = (ayah: number, position: number) =>
      corpus.distractors.filter((d) => d.ayah === ayah && d.position === position);

    // the authored coordinate is authored-ONLY and byte-identical to input
    const authored = at(1, 1);
    expect(authored.length).toBe(2);
    expect(authored.every((d) => d.origin === "authored")).toBe(true);
    expect(authored.map((d) => d.text)).toEqual(["authored-foil-a", "authored-foil-b"]);

    // every OTHER coordinate is kernel-filled and non-empty — this is what a
    // per-surah guard would break
    for (const [ayah, position] of [[1, 2], [1, 3], [2, 1], [2, 2], [2, 3]] as const) {
      const rows = at(ayah, position);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((d) => d.origin === "kernel")).toBe(true);
    }

    // and no coordinate mixes origins
    for (const w of words) {
      const rows = at(w.ayah, w.position);
      expect(new Set(rows.map((d) => d.origin)).size).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// §E property 4/5 — DISCRIMINATING, not decorative. The test that separates
// "a foil" from "a good foil", with surah 12's authored data as the control.
// ---------------------------------------------------------------------------

describe("foils are discriminating, not decorative (§E property 4)", () => {
  function medianSimByRank(c: CorpusJson, rank: number): number {
    const target = targetTextMap(c);
    const sims: number[] = [];
    for (const d of c.distractors) {
      if (d.rank !== rank) continue;
      const t = target.get(`${d.ayah}:${d.position}`);
      if (t) sims.push(scriptSimilarity(d.text, t));
    }
    return median(sims);
  }

  it("authored control (surah 12): rank-1 foils are more confusable than rank-4", () => {
    const c = corpusOf(12);
    expect(medianSimByRank(c, 1)).toBeGreaterThanOrEqual(medianSimByRank(c, 4));
  });

  for (const surah of [103, 112]) {
    it(`kernel output (surah ${surah}) reproduces that gradient — rank1 STRICTLY > rank4`, () => {
      const c = corpusOf(surah);
      const r1 = medianSimByRank(c, 1);
      const r4 = medianSimByRank(c, 4);
      // STRICT, deliberately. A `>=` here is satisfied by a DEGENERATE TIE:
      // reversing the merge comparator collapses both medians to 0.0000, and
      // `0 >= 0` passes while the gradient is in fact destroyed. That is the
      // D45/D49 vacuous-verification pattern — an assertion that does not
      // distinguish the states it claims to guard. Verified by mutation: with
      // the comparator reversed this line goes RED.
      expect(r1).toBeGreaterThan(r4);
      // and the gradient must be real, not two near-identical numbers
      expect(r1 - r4).toBeGreaterThan(0.05);
    });

    it(`kernel output (surah ${surah}) overlaps the authored similarity range`, () => {
      // Not merely internally ordered — rank-1 foils must be genuinely confusable,
      // comparable to the authored baseline rather than arbitrary words.
      const kernel = medianSimByRank(corpusOf(surah), 1);
      expect(kernel).toBeGreaterThan(0.3);
    });
  }
});

describe("rank gradient matches the authored SHAPE (§E property 5)", () => {
  function share(c: CorpusJson, rank: number, prd: string): number {
    const rows = c.distractors.filter((d) => d.rank === rank);
    return rows.length ? rows.filter((d) => d.prd_rank === prd).length / rows.length : 0;
  }

  for (const surah of [12, 103, 112]) {
    it(`surah ${surah}: look-alike-verse share decreases and class-neighbor rises, rank 1 -> 4`, () => {
      const c = corpusOf(surah);
      expect(share(c, 1, "look-alike-verse")).toBeGreaterThanOrEqual(share(c, 4, "look-alike-verse"));
      expect(share(c, 4, "class-neighbor")).toBeGreaterThanOrEqual(share(c, 1, "class-neighbor"));
    });
  }
});

// ---------------------------------------------------------------------------
// §C — degenerate inputs degrade HONESTLY, never padded
// ---------------------------------------------------------------------------

describe("degenerate inputs degrade honestly (§C)", () => {
  it("a one-word surah with an empty pool yields ZERO foils — never padded", () => {
    const verses = fixtureVerses(1, 1);
    const corpus = buildCorpus({
      surah: 999, verses, mcqItems: [], morph: new Map(),
      foilPool: new Map(), generatedFrom: ["fixture"],
    });
    expect(corpus.distractors).toEqual([]);
    expect(corpus.meta.kernelYield[0]).toBe(1);
  });

  it("kernels never invent a form absent from the pool", () => {
    const verses = fixtureVerses(1, 2);
    const words: Word[] = verses[0]!.words.map((w) => ({
      surah: 999, ayah: 1, position: w.position, text_uthmani: w.text_uthmani,
      lemma: null, root: null, class: null,
      gloss: { en: w.translation, ms: null, ja: null },
      act: null, sceneImage: null, line: null,
    }));
    const pool = poolFromWords(words);
    const foils = generateFoils(words[0]!, { pool, surahWords: words }, 5);
    const poolSurfaces = new Set([...pool.values()].map((e) => gradeKey(e.surface)));
    for (const f of foils) expect(poolSurfaces.has(gradeKey(f.surface))).toBe(true);
    // only one other word exists, so at most one foil is possible
    expect(foils.length).toBeLessThanOrEqual(1);
  });

  it("kernelYield reports the real distribution, and every word is accounted for", () => {
    for (const surah of [12, 103, 112]) {
      const c = corpusOf(surah);
      const total = Object.values(c.meta.kernelYield).reduce((a, b) => a + b, 0);
      expect(total).toBe(c.words.length);
    }
  });
});

// ---------------------------------------------------------------------------
// §E property 6 — determinism
// ---------------------------------------------------------------------------

describe("deterministic (§E property 6)", () => {
  it("compiling the same surah twice is byte-identical", () => {
    for (const surah of [103, 112]) {
      const a = JSON.stringify(buildFromInputs(loadInputs(surah)));
      const b = JSON.stringify(buildFromInputs(loadInputs(surah)));
      expect(a).toBe(b);
    }
  });

  it("the merge comparator is a TOTAL order — ties only for identical grading keys", () => {
    // Regression for a SURVIVING mutation. Deleting the comparator's final
    // `compareKeys` tiebreak left the whole suite green: every kernel already
    // sorts its own output with compareKeys and Array.prototype.sort is stable,
    // so the merge never observed a tie it had to break, and the guarantee
    // silently rested on an upstream invariant nothing asserted. Asserting the
    // comparator directly does not depend on that invariant.
    const mk = (surface: string, srcType: "visual" | "phonetic" | "semantic" | "contextual", m: number) => ({
      c: { surface, srcType, score: 0, why: "fixture" },
      m,
    });

    // same score, same kernel, DIFFERENT text -> must NOT tie
    expect(compareCandidates(mk("foil-a", "visual", 0.5), mk("foil-b", "visual", 0.5))).not.toBe(0);
    // and must be antisymmetric
    expect(
      Math.sign(compareCandidates(mk("foil-a", "visual", 0.5), mk("foil-b", "visual", 0.5))) +
        Math.sign(compareCandidates(mk("foil-b", "visual", 0.5), mk("foil-a", "visual", 0.5))),
    ).toBe(0);
    // same score, different kernel -> priority decides (visual before contextual)
    expect(compareCandidates(mk("x", "visual", 0.5), mk("y", "contextual", 0.5))).toBeLessThan(0);
    // higher merge score always wins
    expect(compareCandidates(mk("x", "contextual", 0.9), mk("y", "visual", 0.4))).toBeLessThan(0);
    // ONLY an identical grading key ties
    expect(compareCandidates(mk("same", "visual", 0.5), mk("same", "visual", 0.5))).toBe(0);

    // exhaustively: over real pool candidates for a real target, no two distinct
    // grading keys compare equal
    const c = corpusOf(112);
    const pool = buildFoilPool(loadInputs(112).qac);
    const entries = [...pool.values()].slice(0, 200);
    const items = entries.map((e, i) =>
      mk(e.surface, (["visual", "phonetic", "semantic", "contextual"] as const)[i % 4]!, Math.round(i / 7) / 10),
    );
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (gradeKey(items[i]!.c.surface) === gradeKey(items[j]!.c.surface)) continue;
        expect(compareCandidates(items[i]!, items[j]!)).not.toBe(0);
      }
    }
    expect(c.words.length).toBeGreaterThan(0);
  });

  it("generateFoils is stable across repeated calls and pool insertion order", () => {
    const c = corpusOf(112);
    const qac = loadInputs(112).qac;
    const pool = buildFoilPool(qac);
    const w = c.words[0]!;
    const first = generateFoils(w, { pool, surahWords: c.words }, 5).map((f) => f.surface);
    const second = generateFoils(w, { pool, surahWords: c.words }, 5).map((f) => f.surface);
    expect(second).toEqual(first);

    // reversed pool insertion order must not change the OUTPUT order
    const reversed = new Map([...pool.entries()].reverse());
    const third = generateFoils(w, { pool: reversed, surahWords: c.words }, 5).map((f) => f.surface);
    expect(third).toEqual(first);
  });
});

// ---------------------------------------------------------------------------
// v3-D24 — morphology is build-time only
// ---------------------------------------------------------------------------

describe("v3-D24 — no morphology leaks onto a distractor row", () => {
  it("distractor rows carry no root/lemma/class, on any surah", () => {
    for (const surah of [12, 103, 112]) {
      for (const d of corpusOf(surah).distractors) {
        expect("root" in d).toBe(false);
        expect("lemma" in d).toBe(false);
        expect("class" in d).toBe(false);
      }
    }
  });
});
