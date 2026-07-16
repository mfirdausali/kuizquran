// Atom = the graded/scheduled unit. Per invariant #1 and PRD §9 ("atoms ≤221/
// user" = 111 ayat + 110 connections), atoms are per-AYAH and per-CONNECTION —
// never per-word. Word taps are evidence that rolls up to the ayah atom.
//
// `atoms` is a rebuildable cache; the append-only event log is the truth
// (invariant #2 / PRD §9). See rebuild.ts.

/** Lifecycle stage = the strength band (invariant #2: the stage IS the band). */
export type Stage = "learn" | "reinforce" | "carry" | "lapsed";

export type AtomKind = "ayah" | "connection";

export interface AtomState {
  kind: AtomKind;
  /** For an ayah atom: the ayah number. For a connection: the `from` ayah (n→n+1). */
  ref: number;
  /** 0–100 band strength. <40 learn · <80 reinforce · ≥80 carry. */
  strength: number;
  /** FSRS-shaped stability, in learning-days; larger = slower decay. */
  stability: number;
  /** Difficulty knob (0–1); nudged up on lapse, down on easy success. */
  difficulty: number;
  /** ms timestamp of the last graded retrieval, or null if never retrieved. */
  lastRetrieval: number | null;
  /** Total graded retrievals applied. */
  reps: number;
  /** Times it lapsed (a Review/Carry error). */
  lapses: number;
  /** True once encoded (S3 whole-bank completed at least once) — gate eligibility. */
  encoded: boolean;
  /** ms timestamp the day-1 cold gate is due, or null if none scheduled. */
  gateDueAt: number | null;
  /** Whether the day-1 cold gate has been passed. */
  gatePassed: boolean;
}

export const BAND_REINFORCE = 40;
export const BAND_CARRY = 80;

export function bandOf(strength: number): Stage {
  if (strength < 0) return "lapsed";
  if (strength < BAND_REINFORCE) return "learn";
  if (strength < BAND_CARRY) return "reinforce";
  return "carry";
}

/** A fresh, never-retrieved atom. */
export function initAtom(kind: AtomKind, ref: number): AtomState {
  return {
    kind,
    ref,
    strength: 0,
    stability: 0,
    difficulty: 0.3,
    lastRetrieval: null,
    reps: 0,
    lapses: 0,
    encoded: false,
    gateDueAt: null,
    gatePassed: false,
  };
}

/** Stable key for an atom (used to index the atoms cache). */
export function atomKey(kind: AtomKind, ref: number): string {
  return `${kind}:${ref}`;
}
