// FR2 options(strength) → (count, max_rank). The difficulty knob for S2 fill:
// stronger words get fewer options drawn from harder (lower-rank) distractors.
//
// v0.2 always calls with strength = 0 (Learn band). The Reinforce/Carry rows
// exist so v0.3's scheduler can feed real strength without changing this API.
// Pure and deterministic — no RNG here (option ORDER for display is the UI's
// concern; the engine returns a stable, rank-sorted set).

import type { Corpus } from "./types.ts";
import { distractorsFor } from "./corpus.ts";

export interface OptionSpec {
  /** Total options shown, including the correct answer. */
  count: number;
  /** Only distractors with rank ≤ maxRank are eligible. */
  maxRank: number;
}

/** Band thresholds match the PRD stage bands (Learn 0–40 / Reinforce 40–80 / Carry 80+). */
export function options(strength: number): OptionSpec {
  if (strength < 40) return { count: 4, maxRank: 4 }; // Learn
  if (strength < 80) return { count: 3, maxRank: 3 }; // Reinforce
  return { count: 2, maxRank: 2 }; // Carry
}

export interface PickedOptions {
  correct: string;
  /** Distractor surface forms (Arabic), highest-priority (lowest rank) first. */
  distractors: string[];
}

/**
 * Pick the S2 option set for one word at a given strength: the correct form plus
 * the top (count-1) distractors with rank ≤ maxRank. Deterministic (rank order).
 */
export function pickOptions(
  corpus: Corpus,
  ayah: number,
  position: number,
  correct: string,
  strength: number,
): PickedOptions {
  const spec = options(strength);
  const eligible = distractorsFor(corpus, ayah, position)
    .filter((d) => d.rank <= spec.maxRank && d.text !== correct)
    .slice(0, spec.count - 1)
    .map((d) => d.text);
  return { correct, distractors: eligible };
}
