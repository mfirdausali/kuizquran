// Pace modes (v2-D09, ROADMAP Phase 2) — the fix for v2-BUG-1 (the pace dial was
// decorative: v1's useSession.ts hardcoded budgetMin:8, so Steady and Sprint
// collapsed to the same drip). Three named, persisted, mid-surah-editable modes,
// each a real ScheduleConfig fragment consumed directly by assembleQueue.
// Pure — no IO, no clock; persistence is the caller's (session hook) concern.

export type PaceMode = "steady" | "sprint" | "maintain";

export interface PaceConfig {
  mode: PaceMode;
  /** Session time cap in minutes, fed straight to assembleQueue's budgetMin. */
  budgetMin: number;
  /** Max NEW ayat this session may unlock (0 = reviews/chains only — Maintain). */
  newAyahCeiling: number;
  /** v2-D07 unlock tolerance: how many pending (due, unpassed) cold gates are
   *  still tolerated when deciding whether to interleave new Learn. Steady stays
   *  strict (0 — no unlock while anything is owed); Sprint is looser (1, with
   *  the gate-wall disclosed in the UI); Maintain doesn't unlock at all so the
   *  tolerance is moot but kept at 0 for clarity. */
  gateTolerance: number;
}

const STEADY: PaceConfig = { mode: "steady", budgetMin: 8, newAyahCeiling: 1, gateTolerance: 0 };
const SPRINT: PaceConfig = { mode: "sprint", budgetMin: 16, newAyahCeiling: 3, gateTolerance: 1 };
const MAINTAIN: PaceConfig = { mode: "maintain", budgetMin: 8, newAyahCeiling: 0, gateTolerance: 0 };

const CONFIGS: Record<PaceMode, PaceConfig> = { steady: STEADY, sprint: SPRINT, maintain: MAINTAIN };

export const DEFAULT_PACE_MODE: PaceMode = "steady";

/** The fixed config for a pace mode (pure lookup, no defaults guessing). */
export function paceConfig(mode: PaceMode): PaceConfig {
  return CONFIGS[mode];
}

/** Clip a Learn-candidate window down to a mode's new-ayah ceiling (Maintain → []). */
export function candidatesForPace(candidates: number[], mode: PaceMode): number[] {
  return candidates.slice(0, paceConfig(mode).newAyahCeiling);
}
