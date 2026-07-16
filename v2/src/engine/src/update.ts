// update(atom, outcome, ctx) — THE core scheduling function. Pure.
//
// Enforces the locked invariants:
//  #3 first-pass meaning errors are PRETEST → excluded from strength/confusions.
//  #4 evidence asymmetry: errors full weight; massed same-day successes damped;
//     spacing measured between RETRIEVALS, never app-opens.
//  #5 only the STRUCTURED session mutates lifecycle → free-play outcomes are
//     recorded as evidence but do not move strength (ctx.structured guard).
//  post-lapse stability is DAMPED, never reset to zero (sabr jameel; the SRS
//  doc's anti-pattern list forbids SM-2 zero-reset).
//
// The graded unit is the ayah atom (invariant #1). A `RetrievalOutcome` is the
// rolled-up result of a graded retrieval — e.g. an S3 whole-bank pass (strong),
// an S2 fill (lighter), or a slip. Word taps are aggregated into these upstream.

import type { AtomState } from "./atom.ts";
import { bandOf } from "./atom.ts";
import { isSameLearningDay, type DayConfig } from "./daybound.ts";
import { clamp } from "./strength.ts";

/** The kind of graded retrieval, in ascending evidential weight. */
export type RetrievalKind =
  | "s1" // meaning pass (light)
  | "s2" // word-by-word fill (medium)
  | "s3" // whole-bank / full-ayah production (strong — the accomplishment)
  | "gate" // cold whole-bank gate (strongest positive when passed)
  | "review"; // spaced review (S2/chain form)

export interface RetrievalOutcome {
  kind: RetrievalKind;
  correct: boolean;
  /** ms timestamp of the retrieval. */
  ts: number;
  /** True for a first-pass S1 meaning error — pretest, excluded (invariant #3). */
  pretest?: boolean;
  /** True when this outcome came from the structured session (invariant #5). */
  structured: boolean;
  /** True if the retrieval's latency was discarded (interruption) — see FR5. */
  interrupted?: boolean;
}

export interface UpdateContext {
  cfg?: DayConfig;
}

// Positive strength deltas by retrieval kind (before same-day damping).
const GAIN: Record<RetrievalKind, number> = {
  s1: 6,
  s2: 12,
  s3: 30,
  gate: 34,
  review: 18,
};
// Stability growth (learning-days) by kind, before damping.
const STAB_GAIN: Record<RetrievalKind, number> = {
  s1: 0.5,
  s2: 1.2,
  s3: 3.0,
  gate: 4.0,
  review: 2.5,
};

/**
 * Apply one graded retrieval outcome to an atom, returning a NEW atom.
 * Pure — no Date.now, no mutation of the input.
 */
export function update(atom: AtomState, outcome: RetrievalOutcome, ctx: UpdateContext = {}): AtomState {
  // Invariant #3: pretest first-pass meaning errors are excluded entirely.
  if (outcome.pretest) return atom;
  // Invariant #5: only the structured session moves lifecycle state.
  if (!outcome.structured) return atom;

  const next: AtomState = { ...atom };

  if (!outcome.correct) {
    // Invariant #4: errors carry full weight.
    next.reps += 1;
    if (bandOf(atom.strength) === "reinforce" || bandOf(atom.strength) === "carry") {
      // A lapse from an established band → RELEARNING: damp stability, bump
      // difficulty, drop strength hard — but do NOT reset to zero.
      next.lapses += 1;
      next.stability = Math.max(0.5, atom.stability * 0.4); // damped, not zeroed
      next.difficulty = clamp(atom.difficulty + 0.15, 0, 1);
      next.strength = clamp(atom.strength - 45, 0, 100);
    } else {
      // Error while still in Learn: strong negative, no lapse counter.
      next.stability = Math.max(0, atom.stability - 0.5);
      next.difficulty = clamp(atom.difficulty + 0.05, 0, 1);
      next.strength = clamp(atom.strength - 15, 0, 100);
    }
    next.lastRetrieval = outcome.ts;
    return next;
  }

  // Correct retrieval.
  next.reps += 1;

  // Invariant #4: massed successes damped. Count same-learning-day prior reps via
  // lastRetrieval; a same-day repeat gets diminishing gain.
  const massed =
    atom.lastRetrieval !== null && isSameLearningDay(atom.lastRetrieval, outcome.ts, ctx.cfg);
  const dampFactor = massed ? 0.35 : 1.0; // spaced success is worth ~3x a massed one

  // Difficulty modulates gain: harder atoms gain a bit less.
  const diffFactor = 1 - 0.4 * atom.difficulty;

  const strengthGain = GAIN[outcome.kind] * dampFactor * diffFactor;
  next.strength = clamp(atom.strength + strengthGain, 0, 100);

  // Stability grows; massed successes plateau (bounded, diminishing).
  const stabGain = STAB_GAIN[outcome.kind] * dampFactor * diffFactor;
  next.stability = atom.stability + stabGain;

  // Easy/clean success nudges difficulty down slightly.
  next.difficulty = clamp(atom.difficulty - 0.03 * dampFactor, 0, 1);

  // S3 or gate success = the ayah has been produced whole → encoded.
  if (outcome.kind === "s3" || outcome.kind === "gate") next.encoded = true;

  next.lastRetrieval = outcome.ts;
  return next;
}
