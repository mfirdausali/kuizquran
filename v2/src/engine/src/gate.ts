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
 * Record a cold-gate attempt result. A pass marks gatePassed; a fail re-arms the
 * gate for the next learning-day (no zero-reset — that's update()'s job on the
 * failing retrieval). Pure.
 */
export function applyGateResult(
  atom: AtomState,
  passed: boolean,
  attemptedAt: number,
  cfg?: DayConfig,
): AtomState {
  if (passed) return { ...atom, gatePassed: true };
  // Failed cold gate: retry next learning-day.
  return { ...atom, gateDueAt: dayStart(attemptedAt, cfg) + 86_400_000, gatePassed: false };
}

/** All atoms whose cold gate is due now (the gate queue). */
export function dueGates(atoms: AtomState[], now: number): AtomState[] {
  return atoms.filter((a) => gateDue(a, now));
}

/**
 * Whether new-ayah unlock is permitted: every encoded atom from a PRIOR learning-
 * day must have passed its cold gate (no unpassed gate hanging). Mastery gate.
 */
export function unlockPermitted(atoms: AtomState[], now: number): boolean {
  return !atoms.some((a) => gateDue(a, now));
}
