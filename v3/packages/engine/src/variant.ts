// Build-plan step 12 (WIREFRAME.md §23 Q4): admit(variant, fibre, ctx)'s
// 4-clause admissibility predicate — "no spec contains a bound check, no
// caller contains an `if`, no builder is ever called on an input admit()
// has not cleared."
//
// DECISIONS.md v3-D30: `Variant`/`Lane` here are an explicitly FLAGGED
// PLACEHOLDER shape. M4's real render surface (spec.ts/corpusRef.ts/faces/
// kernels/buildQuestion/render.ts's 4 closed shapes, build-plan step 16)
// owns what a learner actually sees; this module only carries the minimum
// a real admissibility judgment needs — prompt text, option surfaces, and
// which position/site/lane it binds to — grounded in real corpus facts, not
// invented content. Re-verify every field against M4's real Variant once it
// lands (same pattern as v3-D26's gradeClassToWire()).
//
// Scoped to 3 lanes with real, already-shipped single-Site data support:
// s1 (gloss MCQ), cloze (S2 fill), junction (seam "what comes next").
// rc/locate/reorder (WIREFRAME's full 6-lane table) are RANGE-level
// generators (test.ts's locateItem/reorderItem take a pool/range, not one
// Site) — they don't have a single-Site enumerator to build against yet.
// Deferred, not forgotten — same explicit-flag discipline as v3-D27/v3-D28.

import type { Corpus } from "./types.ts";
import type { Site } from "./site.ts";
import { ayahWords, distractorsFor, wordGloss } from "./corpus.ts";
import { isS1Probeable } from "./ladder.ts";
import { normalizeArabicSurface } from "./arabic.ts";

export type Lane = "s1" | "cloze" | "junction";

export const LANES: readonly Lane[] = ["s1", "cloze", "junction"];

/** A placeholder-flagged candidate question — see the module doc comment. */
export interface Variant {
  lane: Lane;
  site: Site;
  /** 1-based word position this variant targets (s1/cloze only; junction
   *  binds to the seam itself, not a word). */
  position?: number;
  /** The text that identifies WHICH item is being asked. For s1 this is the
   *  correct gloss — a naive "which word means X" reverse-MCQ has a real
   *  two-correct-answers defect when two words share a gloss (WIREFRAME's
   *  own 12:6 pos 18/19 "before " example), so this is where clause 3's
   *  collision actually lives. For cloze/junction the position/seam itself
   *  is the visual disambiguator, so prompt is a trivially-unique
   *  positional tag that clause 3 never rejects. */
  prompt: string;
  /** Full option surface set (correct + distractors) in the lane's native
   *  script — clause 2 (option-set distinctness) judges this. */
  optionSurfaces: string[];
  /** Index into optionSurfaces of the correct answer. */
  correctIndex: number;
}

/** Clause 1's supply signals — WIREFRAME.md §23 Q4: "sibling glosses,
 *  distractors at rank ≤4, successorExists, pool size, consecutive run.
 *  Counted on a ResourceLedger built once per site." */
export interface ResourceLedger {
  site: Site;
  /** position -> count of sibling words with a DISTINCT gloss (s1 supply).
   *  Empty for seam sites. */
  s1SiblingCount: Map<number, number>;
  /** position -> count of eligible (rank<=4, text-distinct) distractors
   *  (cloze supply). Empty for seam sites. */
  clozeDistractorCount: Map<number, number>;
  /** Seam sites only: does the FROM ayah have a successor in this corpus?
   *  (WIREFRAME's own "seam's atom key is connection:n" — a seam at the
   *  surah's last ayah is never constructed by site.ts#expand, but this
   *  ledger must still be TOTAL for a seam site that IS asked about.) */
  successorExists: boolean;
}

/** Built once per site (never re-scanned per variant/lane) — the supply
 *  facts clause 1 judges against. */
export function buildResourceLedger(corpus: Corpus, site: Site): ResourceLedger {
  const s1SiblingCount = new Map<number, number>();
  const clozeDistractorCount = new Map<number, number>();
  let successorExists = false;

  if (site.kind === "ayah") {
    const words = ayahWords(corpus, site.ayah);
    for (const w of words) {
      const correctGloss = wordGloss(w, "en");
      const distinctSiblingGlosses = new Set(
        words.filter((o) => o.position !== w.position).map((o) => wordGloss(o, "en")),
      );
      distinctSiblingGlosses.delete(correctGloss);
      s1SiblingCount.set(w.position, distinctSiblingGlosses.size);

      const eligible = distractorsFor(corpus, site.ayah, w.position).filter(
        (d) => d.rank <= 4 && d.text !== w.text_uthmani,
      );
      clozeDistractorCount.set(w.position, eligible.length);
    }
  } else {
    successorExists = site.ayah < corpus.meta.ayahCount;
  }

  return { site, s1SiblingCount, clozeDistractorCount, successorExists };
}

function s1Variants(corpus: Corpus, site: Site): Variant[] {
  const words = ayahWords(corpus, site.ayah).filter(isS1Probeable);
  return words.map((w) => {
    const correct = wordGloss(w, "en");
    const siblings = words
      .filter((o) => o.position !== w.position)
      .map((o) => wordGloss(o, "en"));
    const seen = new Set<string>([correct]);
    const distractors: string[] = [];
    for (const g of siblings) {
      if (seen.has(g)) continue;
      seen.add(g);
      distractors.push(g);
      if (distractors.length === 3) break;
    }
    return {
      lane: "s1" as const,
      site,
      position: w.position,
      prompt: correct,
      optionSurfaces: [correct, ...distractors],
      correctIndex: 0,
    };
  });
}

function clozeVariants(corpus: Corpus, site: Site): Variant[] {
  // Unlike s1, every position gets a candidate — blanking any word,
  // including non-anchor group members, is a distinct, valid question
  // (matching WIREFRAME's own measured "cloze 31" — no drops for grouping).
  const words = ayahWords(corpus, site.ayah);
  return words.map((w) => {
    const eligible = distractorsFor(corpus, site.ayah, w.position)
      .filter((d) => d.rank <= 4 && d.text !== w.text_uthmani)
      .slice(0, 3)
      .map((d) => d.text);
    return {
      lane: "cloze" as const,
      site,
      position: w.position,
      prompt: `blank@${w.position}`,
      optionSurfaces: [w.text_uthmani, ...eligible],
      correctIndex: 0,
    };
  });
}

const JUNCTION_WIDTHS = [1, 3, 5, 8];

function openingSnippet(corpus: Corpus, ayah: number, width: number): string {
  return ayahWords(corpus, ayah)
    .slice(0, width)
    .map((w) => w.text_uthmani)
    .join(" ");
}

function optionsDistinct(lane: Lane, options: string[]): boolean {
  const normalize = lane === "s1" ? (s: string) => s : normalizeArabicSurface;
  const seen = new Set<string>();
  for (const o of options) {
    const n = normalize(o);
    if (seen.has(n)) return false;
    seen.add(n);
  }
  return true;
}

/**
 * Clause 4 (fallback ladder): "escalate answer width (3 → 5 → 8 words)
 * rather than drop the question." Tries increasing next-ayah opening widths
 * until the resulting option set is internally distinct; if even the
 * widest attempt collides (a maximally degenerate corpus), still returns
 * that widest attempt rather than dropping the seam — clause 4's own rule
 * is "never drop," and clause 2 remains the final, independent gate.
 */
function junctionVariants(corpus: Corpus, site: Site): Variant[] {
  const from = site.ayah;
  const to = from + 1;
  if (to > corpus.meta.ayahCount) return [];

  let best: Variant | null = null;
  for (const width of JUNCTION_WIDTHS) {
    const correct = openingSnippet(corpus, to, width);
    if (!correct) return best ? [best] : [];
    const seen = new Set<string>([normalizeArabicSurface(correct)]);
    const distractors: string[] = [];
    for (let delta = 1; delta <= corpus.meta.ayahCount && distractors.length < 3; delta++) {
      for (const cand of [to + delta, to - delta]) {
        if (cand === to || cand < 1 || cand > corpus.meta.ayahCount) continue;
        const snippet = openingSnippet(corpus, cand, width);
        if (!snippet) continue;
        const n = normalizeArabicSurface(snippet);
        if (seen.has(n)) continue;
        seen.add(n);
        distractors.push(snippet);
        if (distractors.length === 3) break;
      }
    }
    const optionSurfaces = [correct, ...distractors];
    best = { lane: "junction", site, prompt: `seam@${from}`, optionSurfaces, correctIndex: 0 };
    if (optionsDistinct("junction", optionSurfaces)) return [best];
  }
  return best ? [best] : [];
}

/** `variants()` enumerates CANDIDATES for a lane at a site (pre-admit). */
export function variants(corpus: Corpus, site: Site, lane: Lane): Variant[] {
  if (lane === "s1") return site.kind === "ayah" ? s1Variants(corpus, site) : [];
  if (lane === "cloze") return site.kind === "ayah" ? clozeVariants(corpus, site) : [];
  return site.kind === "seam" ? junctionVariants(corpus, site) : [];
}

function hasSupply(variant: Variant, ledger: ResourceLedger): boolean {
  if (variant.lane === "junction") return ledger.successorExists;
  const counts = variant.lane === "s1" ? ledger.s1SiblingCount : ledger.clozeDistractorCount;
  return (counts.get(variant.position ?? -1) ?? 0) > 0;
}

/**
 * admit(variant, fibre, ctx) — WIREFRAME.md §23 Q4's 4 clauses:
 *   1. Supply (ledger-counted)
 *   2. Option-set distinctness under normalization
 *   3. Prompt uniqueness across the fibre — a collision keeps the FIRST
 *      (lowest position / first-enumerated) occurrence and drops the rest,
 *      never drops all colliding items (that would starve the site).
 *   4. Fallback ladder — junction's own escalation, already applied inside
 *      variants(); clause 2 remains the independent final check here.
 *
 * `fibre` is every candidate variant for the SAME site+lane (including
 * `variant` itself) — clause 3 cannot be judged on `variant` in isolation.
 */
export function admit(variant: Variant, fibre: Variant[], ledger: ResourceLedger): boolean {
  if (!hasSupply(variant, ledger)) return false;
  if (!optionsDistinct(variant.lane, variant.optionSurfaces)) return false;

  const canonical = [...fibre].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const firstWithPrompt = canonical.find((v) => v.prompt === variant.prompt);
  if (firstWithPrompt && firstWithPrompt.position !== variant.position) return false;

  return true;
}

/** `variants()` filtered by `admit()`, preserving enumeration order. */
export function admissibleVariants(
  corpus: Corpus,
  site: Site,
  lane: Lane,
  ledger: ResourceLedger,
): Variant[] {
  const candidates = variants(corpus, site, lane);
  return candidates.filter((v) => admit(v, candidates, ledger));
}
