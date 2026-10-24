// Decay made visible (FR9 P1). "72% → 64% since Thursday" on due items — reuses
// the FSRS-shaped retrievability already modeled (strength.ts), so the numbers are
// honest, not decorative. Pure; `now`/`since` passed in.

import type { AtomState } from "./atom.ts";
import { currentStrength } from "./strength.ts";
import { daysBetween, dayOfWeek, type DayConfig } from "./daybound.ts";

export interface DecaySince {
  /** Strength % now (0–100, decayed to `now`). */
  nowPct: number;
  /** Strength % as it was at `since`. */
  sincePct: number;
  /** Plain-language label for the `since` instant ("today", "Thursday", "3 days ago"). */
  sinceLabel: string;
  /** True when it actually dropped (nowPct < sincePct). */
  declined: boolean;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A plain-language label for how long ago `since` was, relative to `now`. */
export function sinceLabel(since: number, now: number, cfg?: DayConfig): string {
  const d = daysBetween(since, now, cfg);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return WEEKDAYS[dayOfWeek(since, cfg)]!; // "Thursday", in cfg.tz
  return `${d} days ago`;
}

/** The decay-visible figure for an atom: now vs its strength at `since`. */
export function decaySince(
  atom: AtomState,
  since: number,
  now: number,
  cfg?: DayConfig,
): DecaySince {
  const nowPct = Math.round(currentStrength(atom, now, cfg));
  const sincePct = Math.round(currentStrength(atom, since, cfg));
  // A `since` instant that falls BEFORE the atom's own `lastRetrieval` cannot
  // be answered honestly: `currentStrength` has no record of what the atom's
  // strength was before that retrieval happened. Asking it anyway routes
  // through `retrievability`'s now<lastRetrieval guard — built for mild
  // clock skew, never for querying a date before the atom's own history
  // starts — which answers with the atom's full, undecayed `strength`
  // instead of a real historical figure. That makes a genuine retrieval
  // (one that HELPED the atom) read as a decline from that inflated value,
  // which is exactly the "green dashboard... has lied to them" failure §10
  // forbids — manufactured from a retrieval that actually happened, not a
  // measurement of forgetting. So no decline is ever reported across one.
  const sinceBeforeRetrieval = atom.lastRetrieval !== null && since < atom.lastRetrieval;
  return {
    nowPct,
    sincePct,
    sinceLabel: sinceLabel(since, now, cfg),
    declined: !sinceBeforeRetrieval && nowPct < sincePct,
  };
}
