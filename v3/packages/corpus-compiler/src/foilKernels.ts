// Foil kernels — derive distractors from corpus data instead of authoring them
// (NIGHTLY.md "Distractors — decided"; closes buildCorpus.ts's deferral and
// unblocks D51: surah 112 compiled with ZERO distractors, so every reconstruct
// blank offered a tile bank containing only the correct answer).
//
// ABSOLUTE RULE 1 (v3/CLAUDE.md): a kernel DERIVES a foil from corpus bytes; it
// NEVER authors one. Every emitted `text` is, byte-for-byte, the `text_uthmani`
// of some real word in the vendored corpus — carried through as a value read at
// build time. This file contains no Arabic literal, and `String.fromCodePoint`
// is used for the one codepoint the grading key needs.
//
// ---------------------------------------------------------------------------
// WHY THE POOL IS THE VENDORED UTHMANI CORPUS, NOT QAC
// ---------------------------------------------------------------------------
// QAC (quran-morphology.txt) covers the whole Quran and is the obvious pool.
// Measured, it is the WRONG one for foil SURFACE TEXT. Across the 1,806 words of
// surahs 12+103+112, reconstructing each word from its QAC segments gives:
//     byte-identical to Uthmani ... 1045
//     normalized-equal only ....... 747   <-- different orthography
//     genuinely different .........  14
// QAC stores morphological orthography; the corpus (and therefore the tile the
// learner taps) is Uthmani, which carries Quranic annotation marks QAC drops.
// Drawing foil text from QAC would render ~41% of foils in a visibly different
// orthographic style from the correct answer — a free visual tell that lets a
// learner pick the answer WITHOUT knowing it, while still passing every
// "is it attested?" check. That is a decorative foil, precisely what §E
// property 4 exists to reject.
//
// So the pool is every distinct word form of the vendored Uthmani corpora. QAC
// is still used, but only for MORPHOLOGY (root), which is what v3-D24 says it
// is for: build-time distractor generation, stripped from the learner artifact.
//
// Measured yield of this pool (1,123 distinct grading keys from 12+103+112):
// every word of 112 and 103 clears 4 admissible foils; the tightest words are
// 112:2 p2 at 12 candidates and 103:2 p4 at 13. D51 is unblocked without
// vendoring any new data source.
//
// ---------------------------------------------------------------------------
// WHY #7 AND #9 ARE STRUCTURALLY IMPOSSIBLE HERE, NOT MERELY CHECKED
// ---------------------------------------------------------------------------
// A kernel cannot reach the output array. It can only offer a candidate to a
// FoilSet accumulator whose sole insertion path is `admit()`, which rejects a
// candidate whose ENGINE GRADING KEY equals the target's or duplicates one
// already admitted. The equality primitive is imported FROM THE ENGINE
// (arabic.ts's normalizeArabicSurface — v3-D12: NFC + tatweel strip), never
// re-derived here and never the compiler's much broader `normalizeArabic`.
//
// That import direction is the whole point. Both live defects arose from two
// notions of equality drifting apart: buildCorpus dropped self-collisions with
// BYTE equality (`d.text === item.correct`) while the engine GRADES with
// normalized equality. Three authored surah-12 rows sit in that gap today —
// 12:21 p15 (rank 2), 12:22 p7 (rank 5) and 12:24 p11 (rank 4) — each the
// target plus exactly one U+0640 TATWEEL, which the engine strips at grading
// time. 12:21 p15 ships a genuine TWO-CORRECT-ANSWER option set at Learn and
// Reinforce. Routing authored rows through this same accumulator removes them.

import type { Distractor, SrcType, Word } from "./types.ts";
import { normalizeArabic, scriptSimilarity } from "./normalize.ts";

// The engine's grading equivalence (v3-D12 / B6). Inlined rather than imported
// across the package boundary because corpus-compiler has no dependency on
// v3/packages/engine and adding one would invert the build order — but it is
// character-for-character the engine's `normalizeArabicSurface`, and
// `test/foilKernels.test.ts` asserts the two agree on real corpus bytes so the
// two can never silently drift (which is exactly how the three live defect rows
// came to exist).
const TATWEEL = String.fromCodePoint(0x0640);

/** Engine grading key — NFC + strip tatweel. MUST match engine/src/arabic.ts. */
export function gradeKey(text: string): string {
  return text.normalize("NFC").split(TATWEEL).join("");
}

/** One candidate word form available to the kernels, keyed by grading key. */
export interface PoolEntry {
  /** Grading key (engine equivalence) — the accumulator's identity. */
  key: string;
  /** Compiler-normalized skeleton, for similarity/rhyme comparison. */
  norm: string;
  /** The EXACT corpus bytes to emit. Never synthesized. */
  surface: string;
  /** Roots this form carries anywhere in the vendored corpora (build-time only). */
  roots: Set<string>;
  /** Surah this form was first seen in (for the contextual kernel). */
  surah: number;
}

/** Build the shared candidate pool from already-compiled corpus words. */
export function buildPool(wordsBySurah: Map<number, Word[]>): Map<string, PoolEntry> {
  const pool = new Map<string, PoolEntry>();
  // Deterministic: ascending surah, then the surah's own reading order.
  for (const surah of [...wordsBySurah.keys()].sort((a, b) => a - b)) {
    for (const w of wordsBySurah.get(surah)!) {
      const key = gradeKey(w.text_uthmani);
      let e = pool.get(key);
      if (!e) {
        e = { key, norm: normalizeArabic(w.text_uthmani), surface: w.text_uthmani, roots: new Set(), surah };
        pool.set(key, e);
      }
      if (w.root) e.roots.add(w.root);
    }
  }
  return pool;
}

/**
 * The ONLY path from a kernel to the output. Constructed with the target's
 * grading key; holds the keys already admitted. A kernel never sees the array.
 *
 * #7 impossible: a candidate grade-equal to the target is rejected.
 * #9 impossible: a candidate grade-equal to an admitted sibling is rejected.
 */
export class FoilSet {
  private readonly targetKey: string;
  private readonly seen = new Set<string>();
  private readonly rows: ScoredCandidate[] = [];

  constructor(targetSurface: string) {
    this.targetKey = gradeKey(targetSurface);
  }

  /** Offer a candidate. Returns true iff it was admitted. */
  admit(c: ScoredCandidate): boolean {
    const key = gradeKey(c.surface);
    if (key === this.targetKey) return false; // #7
    if (this.seen.has(key)) return false; // #9
    this.seen.add(key);
    this.rows.push(c);
    return true;
  }

  /** Admitted candidates, in admission order. */
  admitted(): readonly ScoredCandidate[] {
    return this.rows;
  }

  get size(): number {
    return this.rows.length;
  }
}

/** A candidate offered by a kernel, with the closeness score used to merge. */
export interface ScoredCandidate {
  surface: string;
  /** Kernel that produced it — becomes `src_type`, so `mapPrdRank` still works. */
  srcType: SrcType;
  /** Normalized closeness in [0,1]; higher = harder foil = better. */
  score: number;
  /** Human-readable derivation, mirroring the authored rows' `why`. */
  why: string;
}

/** Fixed kernel priority, mirroring prdRank.ts's taxonomy order. Lower = wins ties. */
const KERNEL_PRIORITY: Record<SrcType, number> = {
  visual: 0,
  phonetic: 1,
  semantic: 2,
  contextual: 3,
};

/** Shared final-character run length between two normalized skeletons. */
function sharedSuffix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

export interface KernelContext {
  /** Every candidate form available, keyed by grading key. */
  pool: Map<string, PoolEntry>;
  /** The words of the target's own surah, in reading order (contextual kernel). */
  surahWords: Word[];
}

/**
 * VISUAL — orthographic neighbour. Same first letter, length within +-1, and
 * bigram-Dice similarity in [0.6, 1.0). Score is the similarity itself.
 */
function visualKernel(target: Word, ctx: KernelContext): ScoredCandidate[] {
  const t = normalizeArabic(target.text_uthmani);
  const out: ScoredCandidate[] = [];
  for (const e of ctx.pool.values()) {
    if (e.norm === t) continue;
    if (Math.abs(e.norm.length - t.length) > 1) continue;
    if (e.norm[0] !== t[0]) continue;
    const sim = scriptSimilarity(e.norm, t);
    if (sim < 0.6 || sim >= 1.0) continue;
    out.push({ surface: e.surface, srcType: "visual", score: sim, why: "orthographic neighbour (derived)" });
  }
  // descending similarity, then ascending length delta, then codepoint order
  out.sort(
    (a, b) =>
      b.score - a.score ||
      Math.abs(normalizeArabic(a.surface).length - t.length) - Math.abs(normalizeArabic(b.surface).length - t.length) ||
      compareKeys(a.surface, b.surface),
  );
  return out;
}

/**
 * PHONETIC — rhyme / skeleton match. Shares its final 2 normalized characters
 * (112's whole drill is its rhyme) with length within +-1. Score rewards a
 * longer shared tail, normalized by the target's length.
 */
function phoneticKernel(target: Word, ctx: KernelContext): ScoredCandidate[] {
  const t = normalizeArabic(target.text_uthmani);
  if (t.length < 2) return [];
  const out: ScoredCandidate[] = [];
  for (const e of ctx.pool.values()) {
    if (e.norm === t) continue;
    if (e.norm.length < 2) continue;
    if (Math.abs(e.norm.length - t.length) > 1) continue;
    const shared = sharedSuffix(e.norm, t);
    if (shared < 2) continue;
    out.push({
      surface: e.surface,
      srcType: "phonetic",
      score: Math.min(1, shared / t.length),
      why: "rhyme / skeleton match (derived)",
    });
  }
  out.sort((a, b) => b.score - a.score || compareKeys(a.surface, b.surface));
  return out;
}

/**
 * SEMANTIC — same root (v3-D24: morphology is a BUILD-TIME input, stripped from
 * the shipped artifact). A same-root word that LOOKS DIFFERENT is the better
 * semantic trap, so intra-kernel order is ASCENDING script similarity; the
 * merge score is inverted to match.
 */
function semanticKernel(target: Word, ctx: KernelContext): ScoredCandidate[] {
  if (!target.root) return []; // rootless (particles/PNs) — honest zero, never padded
  const t = normalizeArabic(target.text_uthmani);
  const out: ScoredCandidate[] = [];
  for (const e of ctx.pool.values()) {
    if (e.norm === t) continue;
    if (!e.roots.has(target.root)) continue;
    const sim = scriptSimilarity(e.norm, t);
    out.push({ surface: e.surface, srcType: "semantic", score: 1 - sim, why: "same root (derived)" });
  }
  out.sort((a, b) => b.score - a.score || compareKeys(a.surface, b.surface));
  return out;
}

/**
 * CONTEXTUAL — another word of the SAME surah. `proximity` (decaying with ayah
 * then position distance) is the INTRA-kernel order: a same-ayah neighbour is a
 * better contextual trap than a distant one. It is deliberately NOT the merge
 * score — see `mergeScore`.
 */
function contextualKernel(target: Word, ctx: KernelContext): ScoredCandidate[] {
  const t = normalizeArabic(target.text_uthmani);
  const out: ScoredCandidate[] = [];
  for (const o of ctx.surahWords) {
    if (o.ayah === target.ayah && o.position === target.position) continue;
    if (normalizeArabic(o.text_uthmani) === t) continue;
    const ayahDist = Math.abs(o.ayah - target.ayah);
    const posDist = Math.abs(o.position - target.position);
    out.push({
      surface: o.text_uthmani,
      srcType: "contextual",
      score: 1 / (1 + ayahDist * 2 + posDist * 0.1),
      why: "same-surah word (derived)",
    });
  }
  out.sort((a, b) => b.score - a.score || compareKeys(a.surface, b.surface));
  return out;
}

/**
 * The MERGE axis: how hard this foil is to tell apart from the target, measured
 * as orthographic closeness on the SAME quantity for every kernel.
 *
 * Why not each kernel's own `score`: those are incommensurable. The contextual
 * kernel's proximity term reaches ~0.91 for an adjacent word while a strong
 * VISUAL near-twin scores its Dice similarity of ~0.7 — so merging on raw score
 * sorted mere neighbours above look-alikes. Measured on the first build of this
 * file, that inverted the difficulty gradient: surah 112 came out with rank-1
 * median similarity 0.2857 but rank-4 median 0.5000, and rank 1 was 93%
 * `class-neighbor`, whereas the authored control (surah 12) runs 0.80 -> 0.29
 * with `look-alike-verse` decaying 44.6% -> 15.5%. A foil set can be fully
 * present, attested, and collision-free and still be WRONGLY ORDERED; §E
 * property 4 is the check that catches it, and this function is the fix.
 *
 * Ordering by script similarity reproduces the authored shape because that IS
 * what the authored gradient encodes: visually-confusable foils first, loose
 * semantic/class neighbours last.
 */
function mergeScore(candidateSurface: string, targetSurface: string): number {
  return scriptSimilarity(normalizeArabic(candidateSurface), normalizeArabic(targetSurface));
}

/**
 * The merge comparator, exported so its TOTALITY can be tested directly.
 *
 * Testing determinism only end-to-end is not enough, and this was caught by a
 * SURVIVING mutation: deleting the final `compareKeys` tiebreak left the whole
 * suite green, because every kernel already sorts its own output with
 * `compareKeys` and `Array.prototype.sort` is required to be stable — so the
 * merge never actually observed a tie it had to break. That makes the ordering
 * guarantee depend on an upstream invariant nothing asserts. `test/
 * foilKernels.test.ts` therefore asserts directly that this comparator returns
 * 0 ONLY for candidates with the same grading key.
 */
export function compareCandidates(
  x: { c: ScoredCandidate; m: number },
  y: { c: ScoredCandidate; m: number },
): number {
  return (
    y.m - x.m ||
    KERNEL_PRIORITY[x.c.srcType] - KERNEL_PRIORITY[y.c.srcType] ||
    compareKeys(x.c.surface, y.c.surface)
  );
}

/** Total order fallback: codepoint comparison of grading keys. Never ambiguous. */
function compareKeys(a: string, b: string): number {
  const ka = gradeKey(a);
  const kb = gradeKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/**
 * Generate up to `limit` ranked foils for one word.
 *
 * Ranking is a MERGE, not a concatenation: each kernel emits its own ordered
 * list, then all candidates are merged on the COMMON orthographic-closeness
 * axis (`mergeScore`), ties broken by fixed kernel priority (visual > phonetic
 * > semantic > contextual) and finally by grading-key codepoint order. `rank`
 * is then 1..N by merged position — reproducing the authored data's
 * DIFFICULTY GRADIENT (measured:
 * look-alike-verse 793 at rank 1 decaying to 277 at rank 4, class-neighbor 278
 * rising to 565), not merely emitting four rows.
 *
 * Determinism: every tie ends in an explicit codepoint comparison. No
 * Math.random, and no reliance on Map/Set iteration order for OUTPUT ordering.
 */
export function generateFoils(target: Word, ctx: KernelContext, limit = 5): ScoredCandidate[] {
  const all: ScoredCandidate[] = [
    ...visualKernel(target, ctx),
    ...phoneticKernel(target, ctx),
    ...semanticKernel(target, ctx),
    ...contextualKernel(target, ctx),
  ];

  // Merge on the common orthographic-closeness axis (NOT each kernel's own
  // score — see mergeScore), tie-broken by fixed kernel priority and finally by
  // grading-key codepoint order so every tie has an explicit total order.
  const scored = all.map((c) => ({ c, m: mergeScore(c.surface, target.text_uthmani) }));
  scored.sort(compareCandidates);
  const ordered = scored.map((s) => s.c);

  // The accumulator is the ONLY way a candidate becomes output.
  const set = new FoilSet(target.text_uthmani);
  for (const c of ordered) {
    if (set.size >= limit) break;
    set.admit(c);
  }
  // Degenerate input degrades HONESTLY: fewer foils, never padded. Padding
  // would mean inventing Arabic (rule 1) or duplicating a sibling (#9).
  return [...set.admitted()];
}

/**
 * Route AUTHORED rows through the SAME accumulator. This is the defect fix:
 * the three surah-12 tatweel rows are grade-equal to their target and are
 * therefore rejected here, where byte equality let them through before.
 */
export function admitAuthored(
  targetSurface: string,
  rows: Array<{ surface: string; srcType: SrcType; why: string }>,
): Array<{ surface: string; srcType: SrcType; why: string }> {
  const set = new FoilSet(targetSurface);
  const kept: Array<{ surface: string; srcType: SrcType; why: string }> = [];
  for (const r of rows) {
    if (set.admit({ surface: r.surface, srcType: r.srcType, score: 0, why: r.why })) {
      kept.push(r);
    }
  }
  return kept;
}

/** Provenance of a distractor row — compile-time fact about the FOIL, not QAC
 *  morphology, so v3-D24's stripping rule does not apply. Carries no root/lemma. */
export type FoilOrigin = Distractor["origin"];
