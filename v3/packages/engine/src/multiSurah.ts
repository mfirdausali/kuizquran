// DEFECTS.md#E-02/#E-06 (build-plan step 9): "one budget, N decay curves"
// and "planFor() gives every surah the full daily budget — every ETA
// lies." Neither `assembleQueue` nor `planFor` previously had any
// mechanism to divide a learner's ONE total daily-minutes budget across
// MULTIPLE active surahs — callers had no honest option but to hand each
// surah the full total, which is exactly the lie both defects name.
// `splitBudget` is that missing mechanism: callers compute each surah's
// fair share here, then pass THAT (never the raw total) into
// `assembleQueue`'s `budgetMin` / `planFor`'s `minutesPerDay`.
//
// This is deliberately minimal — proportional-by-weight division, no
// awareness of a "Site" (build-plan step 11 hasn't landed yet). Once
// Site/admit exists, edge case #66's fuller design ("per-surah
// risk-weighted assembly + merge; AssembleInput = Site[] + per-surah
// budgets") may supersede this; this function is the honest interim fix,
// not a claim to be that final design.

export interface SurahShare {
  surah: number;
  /** Relative weight — a surah with weight 2 gets twice another's share.
   *  Defaults to 1 (equal split) when omitted. */
  weight?: number;
}

/** Divide `totalMinutes` across `surahs` proportionally by weight. Empty
 * input returns an empty map (never divides by zero). */
export function splitBudget(totalMinutes: number, surahs: SurahShare[]): Map<number, number> {
  const shares = new Map<number, number>();
  if (surahs.length === 0) return shares;
  const totalWeight = surahs.reduce((sum, s) => sum + (s.weight ?? 1), 0);
  for (const s of surahs) {
    const weight = s.weight ?? 1;
    shares.set(s.surah, totalWeight > 0 ? (totalMinutes * weight) / totalWeight : 0);
  }
  return shares;
}
