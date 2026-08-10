// Capacity / daily-plan math (FR10 output + FR3 P1 planner). From Appendix A:
//   T(min) ≈ 0.33·W_new + 0.4·R_due + 1.25·chains + 0.17·junctions
//   Learn ≈ 20 s × word count; interruption overhead ~10–15%.
// Pure — no clock, no IO.

// Per-unit minute costs (Appendix A).
export const COST_PER_NEW_WORD = 0.33;
export const COST_PER_DUE_REVIEW = 0.4;
export const COST_PER_CHAIN = 1.25;
export const COST_PER_JUNCTION = 0.17;

export interface SessionLoad {
  newWords: number;
  dueReviews: number;
  chains: number;
  junctions: number;
}

/** Estimated minutes for a session load (Appendix A). */
export function estMinutes(load: SessionLoad): number {
  return (
    COST_PER_NEW_WORD * load.newWords +
    COST_PER_DUE_REVIEW * load.dueReviews +
    COST_PER_CHAIN * load.chains +
    COST_PER_JUNCTION * load.junctions
  );
}

export interface DailyPlan {
  /** New ayat to Learn per active day (≥1 when there's work left, capacity permitting). */
  ayahPerDay: number;
  /** Honest ETA in active days to finish the not-yet-carried ayat. */
  etaDays: number;
  /** Total ayat remaining to carry. */
  remaining: number;
  /** First-week habit protocol: underloaded, no 2nd thread before day 3 (FR10). */
  habitProtocol: { underloaded: true; secondThreadFromDay: 3 };
}

export interface PlanInputs {
  /** Ayat not yet carried (to be Learned). */
  remainingAyat: number;
  /** Avg words per remaining ayah (Yusuf ≈ 16). */
  avgWordsPerAyah: number;
  /** Minutes the user commits per day (session cap; PRD default ~6–8). */
  minutesPerDay: number;
}

/**
 * Compute the daily plan from the carried map. Fits new-ayah Learn into the daily
 * minute budget (leaving room for due reviews as the carried set grows), and
 * reports an honest ETA. First week is deliberately underloaded (FR10 habit
 * protocol) — the scheduler reads `habitProtocol` to soften early days.
 */
export function planFor(inp: PlanInputs): DailyPlan {
  const minutesForNew = Math.max(0, inp.minutesPerDay * 0.6); // ~60% to new Learn
  const minutesPerAyah = COST_PER_NEW_WORD * inp.avgWordsPerAyah; // Appendix A
  const ayahPerDay = Math.max(1, Math.floor(minutesForNew / Math.max(0.5, minutesPerAyah)));
  const remaining = Math.max(0, inp.remainingAyat);
  const etaDays = remaining === 0 ? 0 : Math.ceil(remaining / ayahPerDay);
  return {
    ayahPerDay,
    etaDays,
    remaining,
    habitProtocol: { underloaded: true, secondThreadFromDay: 3 },
  };
}
