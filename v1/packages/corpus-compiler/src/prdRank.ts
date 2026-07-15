// Map each authored distractor onto the FR1 rank taxonomy:
//   suffix-variant > look-alike-verse > same-root > synonym > class-neighbor
//
// The authored `rank` (1..5 order) is preserved elsewhere; this only assigns the
// `prd_rank` label. The mapping is a best-effort heuristic — the source data
// carries a 4-way type (visual/semantic/contextual/phonetic) plus a rationale,
// not the PRD's 5 categories, and same-root/class need morphology we join in.

import type { PrdRank, SrcType } from "./types.ts";
import { normalizeArabic } from "./normalize.ts";

/** Longest common prefix length over normalized skeletons. */
function commonPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * True when distractor differs from target only in a trailing chunk while
 * sharing a substantial common prefix (a plausible suffix inflection, e.g.
 * -ُونَ vs -ِينَ). Operates on normalized skeletons.
 */
function isSuffixVariant(targetNorm: string, distNorm: string): boolean {
  if (targetNorm === distNorm) return false; // identical isn't a variant
  const lcp = commonPrefix(targetNorm, distNorm);
  const shorter = Math.min(targetNorm.length, distNorm.length);
  if (shorter < 3) return false;
  // At least 2/3 of the shorter word shared as a prefix, and the divergence is
  // confined to the tail (each remainder ≤ 3 chars).
  const remA = targetNorm.length - lcp;
  const remB = distNorm.length - lcp;
  return lcp >= Math.ceil((2 * shorter) / 3) && remA <= 3 && remB <= 3;
}

export interface RankInput {
  targetText: string;
  targetRoot: string | null;
  distractorText: string;
  distractorRoot: string | null; // may be null (only known if the distractor is a Yusuf word)
  srcType: SrcType;
}

export function mapPrdRank(inp: RankInput): PrdRank {
  const t = normalizeArabic(inp.targetText);
  const d = normalizeArabic(inp.distractorText);

  // 1. suffix-variant — same stem, differs only in the tail.
  if (isSuffixVariant(t, d)) return "suffix-variant";

  // 2. look-alike-verse — visually near-identical script (authored as `visual`,
  //    or high normalized-prefix overlap even across types).
  if (inp.srcType === "visual") return "look-alike-verse";

  // 3. same-root — morphology says the roots match.
  if (inp.targetRoot && inp.distractorRoot && inp.targetRoot === inp.distractorRoot) {
    return "same-root";
  }

  // 4. synonym — authored as semantically related.
  if (inp.srcType === "semantic") return "synonym";

  // 5. class-neighbor — everything else (contextual / phonetic / unresolved).
  return "class-neighbor";
}
