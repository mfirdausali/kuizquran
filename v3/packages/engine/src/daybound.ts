// Day boundary — a GENERAL, secular local rollover (human direction 2026-07-14:
// "no Fajr-specific notification; general, secular but Islamically appreciable").
// No prayer-time calc, no location, no dependency. The learning-day rolls over at
// a configurable early-morning hour ("a new day" / "your daily anchor" in UI copy;
// no prayer names). Real prayer-anchored UX is deferred to v0.8 (FR9).
//
// Pure: `now` is passed in as an epoch-ms; the engine never calls Date.now().

export interface DayConfig {
  /** Local hour (0–24, may be fractional) at which a new learning-day begins. */
  rolloverHour: number;
  /** Optional session anchor hour the user picks; defaults to the rollover. */
  anchorHour?: number;
}

export const DEFAULT_DAY_CONFIG: DayConfig = { rolloverHour: 4.5 }; // ~04:30 local, dawn-ish

/** Epoch-ms of the instant the current learning-day began (local wall clock). */
export function dayStart(now: number, cfg: DayConfig = DEFAULT_DAY_CONFIG): number {
  const d = new Date(now);
  const rollMs = Math.round(cfg.rolloverHour * 3600_000);
  // Midnight (local) of `now`'s calendar day.
  const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  const todayRollover = localMidnight + rollMs;
  // If we're before today's rollover, the learning-day began at yesterday's.
  return now >= todayRollover ? todayRollover : todayRollover - 86_400_000;
}

/** Integer learning-day index (days since epoch, boundary-shifted) — for "same day". */
export function learningDayIndex(now: number, cfg: DayConfig = DEFAULT_DAY_CONFIG): number {
  return Math.floor(dayStart(now, cfg) / 86_400_000);
}

/** Whether two instants fall in the same learning-day. */
export function isSameLearningDay(a: number, b: number, cfg: DayConfig = DEFAULT_DAY_CONFIG): boolean {
  return learningDayIndex(a, cfg) === learningDayIndex(b, cfg);
}

/** Whole learning-days elapsed between two instants (b − a), can be fractional-floored. */
export function daysBetween(a: number, b: number, cfg: DayConfig = DEFAULT_DAY_CONFIG): number {
  return learningDayIndex(b, cfg) - learningDayIndex(a, cfg);
}

/** Epoch-ms of today's session anchor (defaults to the rollover). */
export function anchorTime(now: number, cfg: DayConfig = DEFAULT_DAY_CONFIG): number {
  const hour = cfg.anchorHour ?? cfg.rolloverHour;
  const start = dayStart(now, cfg);
  const startDate = new Date(start);
  const localMidnight = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();
  return localMidnight + Math.round(hour * 3600_000);
}
