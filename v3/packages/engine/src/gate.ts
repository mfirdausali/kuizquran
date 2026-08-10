// Mastery gate — the day-1 COLD whole-bank check (PRD invariant #9, FR3).
// When an ayah is encoded (S3 completed), a cold gate is scheduled for the NEXT
// learning-day. A new ayah unlocks only when the prior day's encodings pass their
// cold gate. "Cold" = first attempt of a fresh learning-day, no warm-up.

import type { AtomState } from "./atom.ts";
import { dayStart, type DayConfig } from "./daybound.ts";

/**
 * Schedule the day-1 cold gate for a just-encoded atom: due at the start of the
 * NEXT learning-day. Returns a new atom (pure).
 */
export function scheduleGate(atom: AtomState, encodedAt: number, cfg?: DayConfig): AtomState {
  const nextDayStart = dayStart(encodedAt, cfg) + 86_400_000;
  return { ...atom, gateDueAt: nextDayStart, gatePassed: false };
}

/** Is this atom's cold gate due (and not yet passed) as of `now`? */
export function gateDue(atom: AtomState, now: number): boolean {
  return (
    atom.encoded && !atom.gatePassed && atom.gateDueAt !== null && now >= atom.gateDueAt
  );
}

/**
 * Record a cold-gate attempt result. A pass marks gatePassed (and resets the
 * forgiveness counter — v2-D08); a fail re-arms the gate for the next
 * learning-day (no zero-reset — that's update()'s job on the failing
 * retrieval) and increments `gateFails`, the forgiveness ladder's counter. Pure.
 */
export function applyGateResult(
  atom: AtomState,
  passed: boolean,
  attemptedAt: number,
  cfg?: DayConfig,
): AtomState {
  if (passed) return { ...atom, gatePassed: true, gateFails: 0 };
  // Failed cold gate: retry next learning-day.
  return {
    ...atom,
    gateDueAt: dayStart(attemptedAt, cfg) + 86_400_000,
    gatePassed: false,
    gateFails: atom.gateFails + 1,
  };
}

/** All atoms whose cold gate is due now (the gate queue). */
export function dueGates(atoms: AtomState[], now: number): AtomState[] {
  return atoms.filter((a) => gateDue(a, now));
}

/**
 * Whether new-ayah unlock is permitted (v2-D07 unlock tolerance): normally every
 * encoded atom from a prior learning-day must have passed its cold gate, but a
 * mode-scoped tolerance band allows up to `maxPendingGates` gates to still be
 * outstanding without blocking new Learn (Sprint = 1, Steady/Maintain = 0 —
 * strict). Default 0 preserves the original all-gates-clear behavior.
 */
export function unlockPermitted(atoms: AtomState[], now: number, maxPendingGates = 0): boolean {
  const pending = atoms.filter((a) => gateDue(a, now)).length;
  return pending <= maxPendingGates;
}

// ---- Gate forgiveness (v2-D08): re-scaffold, then demote — never silently drop ----

export type GateForgiveness = "cold" | "rescaffold" | "demote";

/** After this many consecutive cold-gate fails, drop to a lighter S2 re-teach
 *  pass before the next cold attempt (still graded, still moves strength). */
export const RESCAFFOLD_AFTER_FAILS = 2;
/** After this many, offer "send this verse back to Learn" (re-learned, not
 *  abandoned — the learner must tap to accept; never auto-demoted). */
export const DEMOTE_OFFER_AFTER_FAILS = 4;

/**
 * Where an atom sits on the gate-forgiveness ladder, purely from its fail count.
 * "cold" = the normal day-1 whole-bank check, no warm-up. "rescaffold" = offer a
 * lighter S2 re-teach pass first. "demote" = offer sending the verse back to Learn.
 */
export function gateForgiveness(atom: AtomState): GateForgiveness {
  if (atom.gateFails >= DEMOTE_OFFER_AFTER_FAILS) return "demote";
  if (atom.gateFails >= RESCAFFOLD_AFTER_FAILS) return "rescaffold";
  return "cold";
}

/**
 * Send a verse back to Learn (accepted "demote" offer only — never automatic).
 * Clears encoding + gate state so it re-earns encoding and a fresh gate through
 * the normal Learn path; strength/stability/history are left as evidence (not
 * zeroed — sabr jameel, the same anti-SM2-reset spirit as update()'s lapse path).
 */
export function demoteToLearn(atom: AtomState): AtomState {
  return { ...atom, encoded: false, gateDueAt: null, gatePassed: false, gateFails: 0 };
}
