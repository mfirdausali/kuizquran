// Free practice & overflow (FR6). Pure SELECTION helpers for the three doors —
// they choose WHAT to practice; the actual drills are the existing S1–S3/chain.
// Free-play writes evidence only (invariant #5): callers emit events with
// structured:false so update() leaves lifecycle state untouched (weak-spot gym is
// the exception — it's full-weight, structured:true, per FR6).

import type { AtomState } from "./atom.ts";
import type { Corpus } from "./types.ts";
import { forgettingRisk } from "./strength.ts";
import { bandOf } from "./atom.ts";
import { unlockPermitted } from "./gate.ts";

export type Drill = "S1" | "S2" | "S3" | "chain";

// ---- Door 1: extra Learn (scheduler-granted, gate intact, cost disclosed) ----

export interface ExtraLearnGrant {
  granted: boolean;
  /** The next ayah offered for extra Learn (first not-encoded candidate). */
  ayah: number | null;
  /** Disclosed cost in minutes (Appendix A ~0.33·words). */
  costMin: number;
  /** Why not granted (gate intact means: only when no cold gate is pending). */
  reason?: string;
}

/**
 * Grant extra Learn ONLY if the mastery gate is intact (no cold gate due) — FR6
 * "gate intact". Returns the next un-encoded candidate + its disclosed cost.
 */
export function extraLearnGrant(
  atoms: AtomState[],
  candidates: number[],
  now: number,
  wordCounts: Map<number, number>,
): ExtraLearnGrant {
  if (!unlockPermitted(atoms, now)) {
    return { granted: false, ayah: null, costMin: 0, reason: "a cold gate is still due" };
  }
  const encoded = new Set(atoms.filter((a) => a.encoded).map((a) => a.ref));
  const ayah = candidates.find((c) => !encoded.has(c)) ?? null;
  if (ayah === null) return { granted: false, ayah: null, costMin: 0, reason: "nothing left to Learn" };
  const words = wordCounts.get(ayah) ?? 16;
  return { granted: true, ayah, costMin: Math.round(0.33 * words * 10) / 10 };
}

// ---- Door 2: weak-spot gym (full-weight evidence; pre-tasmi' rehearsal) ----

export interface WeakSpot {
  kind: "ayah" | "connection";
  ref: number;
  /** Forgetting risk 0..1 (higher = weaker). */
  risk: number;
  band: string;
}

/** Rank carried atoms by forgetting risk — the weakest first (for the gym). */
export function weakSpots(atoms: AtomState[], now: number, limit = 10): WeakSpot[] {
  return atoms
    .filter((a) => a.encoded)
    .map((a) => ({
      kind: a.kind,
      ref: a.ref,
      risk: forgettingRisk(a, now),
      band: bandOf(a.strength),
    }))
    .sort((x, y) => y.risk - x.risk)
    .slice(0, limit);
}

// ---- Door 3: open practice (any ayah × any drill) ----

export interface OpenPracticePick {
  ayah: number;
  drill: Drill;
  /** Valid = the ayah exists in the corpus. */
  valid: boolean;
}

export function openPracticePick(corpus: Corpus, ayah: number, drill: Drill): OpenPracticePick {
  const valid = corpus.verses.some((v) => v.ayah === ayah);
  return { ayah, drill, valid };
}

// ---- Cold-success adoption: hard drill of an untaught ayah passed cold ----

export interface AdoptionOffer {
  offer: boolean;
  ayah: number;
}

/**
 * A cold success on a hard drill (S3/chain) of an UNTAUGHT ayah → offer to adopt
 * it into Carrying (one-tap). The atom is untaught if it isn't encoded yet.
 */
export function coldSuccessAdoption(
  atoms: AtomState[],
  ayah: number,
  drill: Drill,
  correct: boolean,
): AdoptionOffer {
  const hard = drill === "S3" || drill === "chain";
  const atom = atoms.find((a) => a.kind === "ayah" && a.ref === ayah);
  const untaught = !atom || !atom.encoded;
  return { offer: correct && hard && untaught, ayah };
}

// ---- Diminishing-returns honesty line ----

/**
 * After N massed reps of the same atom the same day, practice yields little —
 * return an honest nudge line (FR6). Threshold ~4 same-day reps.
 */
export function diminishingReturns(sameDayReps: number): string | null {
  if (sameDayReps >= 4) {
    return "You've drilled this a lot today — spacing it to tomorrow will help more than more reps now.";
  }
  return null;
}
