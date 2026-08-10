// Day boundary — a GENERAL, secular local rollover (human direction 2026-07-14:
// "no Fajr-specific notification; general, secular but Islamically appreciable").
// No prayer-time calc, no location, no dependency. The learning-day rolls over at
// a configurable early-morning hour ("a new day" / "your daily anchor" in UI copy;
// no prayer names). Real prayer-anchored UX is deferred to v0.8 (FR9).
//
// Pure: `now` is passed in as an epoch-ms; `tz` is passed in as an IANA zone
// name. Build-plan step 8's tz-explicit rewrite (INVARIANTS.md Absolute A's
// named leak: "v2/daybound.ts:23,49 uses machine-local dates, so the same
// event folds differently in UTC than in Kuala Lumpur"). No
// `getFullYear`/`getMonth`/`getDate`/`getDay` anywhere in this file — those
// read the MACHINE's local zone; `Intl.DateTimeFormat` with an explicit
// `timeZone` option reads the CONFIGURED zone instead, deterministically,
// regardless of where this code runs.

export interface DayConfig {
  /** Local hour (0–24, may be fractional) at which a new learning-day begins. */
  rolloverHour: number;
  /** Optional session anchor hour the user picks; defaults to the rollover. */
  anchorHour?: number;
  /** IANA timezone (e.g. "Asia/Kuala_Lumpur") the rollover is computed in.
   *  REQUIRED — no silent machine-local fallback (Absolute A: "tz is always
   *  passed in"). */
  tz: string;
}

export const DEFAULT_DAY_CONFIG: DayConfig = { rolloverHour: 4.5, tz: "UTC" }; // ~04:30, dawn-ish

interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Cache one Intl.DateTimeFormat per tz — construction is the expensive part;
 *  formatting is cheap. Purity is about determinism, not about avoiding a
 *  memoization cache keyed purely on the (pure) `tz` string argument. */
const formatterCache = new Map<string, Intl.DateTimeFormat>();
function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    formatterCache.set(tz, f);
  }
  return f;
}

/** The wall-clock date/time `epochMs` displays as, when observed in `tz`. */
function partsInTz(epochMs: number, tz: string): DateParts {
  const parts = formatterFor(tz).formatToParts(new Date(epochMs));
  const get = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    if (!p) throw new Error(`Intl.DateTimeFormat produced no "${type}" part for tz "${tz}"`);
    // formatToParts's "hour" can read "24" for midnight under hour12:false
    // in some engines; normalize that one case to 0.
    const n = Number(p.value);
    return type === "hour" && n === 24 ? 0 : n;
  };
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Epoch-ms of the UTC instant corresponding to a WALL-CLOCK date/time as
 * observed in `tz` (e.g. "2026-01-05 04:30:00 in Asia/Kuala_Lumpur" ->
 * a UTC epoch-ms). Standard offset-guess-then-correct technique (no
 * Temporal API dependency): guess the offset is 0 (treat the wall-clock
 * numbers as if they were already UTC), see what that guess actually
 * displays as when read back through `tz`, and correct by the discrepancy.
 * Single-pass — exact for every zone at every instant except the (rare,
 * hours-wide) moment inside a DST transition, the same accepted limitation
 * every non-Temporal tz library carries.
 */
function zonedWallClockToUtc(parts: DateParts, tz: string): number {
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const shown = partsInTz(guess, tz);
  const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
  const offsetMs = shownAsUtc - guess;
  return guess - offsetMs;
}

/** Epoch-ms of local midnight (00:00:00 in `tz`) of the calendar day `now` falls on, as observed in `tz`. */
function localMidnightOf(now: number, tz: string): number {
  const p = partsInTz(now, tz);
  return zonedWallClockToUtc({ ...p, hour: 0, minute: 0, second: 0 }, tz);
}

/** Epoch-ms of the instant the current learning-day began (wall clock in `cfg.tz`). */
export function dayStart(now: number, cfg: DayConfig = DEFAULT_DAY_CONFIG): number {
  const rollMs = Math.round(cfg.rolloverHour * 3600_000);
  const todayMidnight = localMidnightOf(now, cfg.tz);
  const todayRollover = todayMidnight + rollMs;
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
  const startOfThatDay = localMidnightOf(start, cfg.tz);
  return startOfThatDay + Math.round(hour * 3600_000);
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/** Day-of-week index (0=Sunday..6=Saturday, matching Date.getDay()'s own
 *  convention) for `now`, AS OBSERVED IN `cfg.tz` — never the machine's own
 *  zone. Callers that need a weekday LABEL (decay.ts's "since Thursday")
 *  index their own name table with this. */
export function dayOfWeek(now: number, cfg: DayConfig = DEFAULT_DAY_CONFIG): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: cfg.tz, weekday: "long" }).format(new Date(now));
  const idx = WEEKDAY_INDEX[weekday];
  if (idx === undefined) throw new Error(`unrecognized weekday "${weekday}" for tz "${cfg.tz}"`);
  return idx;
}
