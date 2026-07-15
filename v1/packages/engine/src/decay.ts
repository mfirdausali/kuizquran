// Decay made visible (FR9 P1). "72% → 64% since Thursday" on due items — reuses
// the FSRS-shaped retrievability already modeled (strength.ts), so the numbers are
// honest, not decorative. Pure; `now`/`since` passed in.

import type { AtomState } from "./atom.ts";
import { currentStrength } from "./strength.ts";
import { daysBetween, type DayConfig } from "./daybound.ts";

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
  if (d < 7) return WEEKDAYS[new Date(since).getDay()]!; // "Thursday"
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
  return {
    nowPct,
    sincePct,
    sinceLabel: sinceLabel(since, now, cfg),
    declined: nowPct < sincePct,
  };
}
