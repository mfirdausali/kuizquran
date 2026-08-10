// Strength & decay. FSRS-SHAPED but tuned per-AYAH (not full FSRS-4.5 word
// weights). retrievability(atom, now) = exp(−Δt/stability) with Δt in learning-
// days — so PRD §3's "±10% FSRS calibration" stays meetable while the graded unit
// stays the ayah. Pure; `now` passed in.

import type { AtomState } from "./atom.ts";
import { bandOf, type Stage } from "./atom.ts";
import { daysBetween, type DayConfig } from "./daybound.ts";

/**
 * Probability the atom is still retrievable at `now`, given its stability and the
 * time since its last retrieval. 1.0 if never decayed (just retrieved) or if
 * stability is effectively infinite; approaches 0 as Δt >> stability.
 */
export function retrievability(atom: AtomState, now: number, cfg?: DayConfig): number {
  if (atom.lastRetrieval === null || atom.stability <= 0) return atom.strength / 100;
  const dt = Math.max(0, daysBetween(atom.lastRetrieval, now, cfg));
  return Math.exp(-dt / atom.stability);
}

/** Forgetting risk = 1 − retrievability. Higher = more urgent to review. */
export function forgettingRisk(atom: AtomState, now: number, cfg?: DayConfig): number {
  return 1 - retrievability(atom, now, cfg);
}

/**
 * The atom's CURRENT effective strength at `now` — its stored band strength
 * decayed by retrievability since last retrieval. This is what bands/gates read;
 * the stored `strength` is the value at `lastRetrieval`.
 */
export function currentStrength(atom: AtomState, now: number, cfg?: DayConfig): number {
  if (atom.lastRetrieval === null) return atom.strength;
  return atom.strength * retrievability(atom, now, cfg);
}

/** Band (stage) of the atom as of `now`, after decay. */
export function currentBand(atom: AtomState, now: number, cfg?: DayConfig): Stage {
  return bandOf(currentStrength(atom, now, cfg));
}

/** Clamp helper. */
export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Half-life, in learning-days: how long the atom stays retrievable before a
 * learner would forget half of it without review — retrievability(t) = exp(−t/
 * stability), so retrievability = 0.5 at t = stability·ln(2). Feeds the Progress
 * Report's first `<InfoTip>` (v2-D19). 0 for a never-retrieved atom (stability 0).
 */
export function halfLifeDays(atom: AtomState): number {
  return atom.stability * Math.LN2;
}
