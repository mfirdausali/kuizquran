// THE FORECAST BUILDER — WIREFRAME §14's three fidelity zones, as data.
//
// ---------------------------------------------------------------------------
// THE HONESTY MECHANIC, AND WHY IT LIVES IN THE DATA
// ---------------------------------------------------------------------------
// §14: reviews are generated from measured decay, so far-future days genuinely
// CANNOT be known. Rather than fake precision, the UI shows its own confidence
// dropping across three zones:
//
//   today → +3d   CONCRETE     exact items: "gate 12:13, 6 reviews, learn 12:14"
//   +4d → +14d    ESTIMATED    load only: "~9 min, ~11 items". Kinds, not ayat.
//   +15d → end    TRAJECTORY   the shape: "~8 min/day, finishing mid-March"
//
// Populating every future day with specific ayat would look more satisfying
// and would be a LIE — a review three weeks out depends on how the next twenty
// sessions actually go. The learner still gets predictability, because the
// COMMITMENT is stable (~8 min/day, one new ayah) even when the item list is
// not. Predictable effort, honest detail.
//
// THE ZONE IS COMPUTED HERE, NOT IN THE VIEW. Two reasons, and the second is
// the one that matters:
//
//   1. check-boundaries.mjs clause 5 — a decision in a view is a decision that
//      will eventually disagree with the engine's.
//   2. A view that could compute a zone could be persuaded to render a
//      concrete item in an estimated day. Because `DayForecast.items` is
//      EMPTY BY CONSTRUCTION outside the concrete zone, the component has
//      nothing to render even if someone tries. The honesty mechanic is
//      enforced by the shape of the data, not by the discipline of whoever
//      edits the component next.
//
// ---------------------------------------------------------------------------
// E-06 — THE BUDGET IS SPLIT, AND THAT IS WHY A FINISH DATE MAY BE SHOWN
// ---------------------------------------------------------------------------
// E-06 ("planFor() gives every surah the full daily budget — every ETA lies")
// is CLOSED as of build-plan step 9. `planFor()` was always correct; what was
// missing was a way to compute a surah's FAIR SHARE of the one total daily
// budget, so callers had no honest option but to pass the full total to each.
// `multiSurah.ts#splitBudget()` is that mechanism, and this module is a caller
// that uses it: every `planFor` call below receives a SPLIT share, never the
// raw total.
//
// That is the precondition for showing a finish date at all. Shipping a date
// you know is wrong is the precise failure §14 exists to prevent — so if the
// split were skipped, this module would have to omit the finish clause. It is
// not skipped, and `plan-calendar.test.tsx` asserts that enrolling a second
// surah cannot make the first finish sooner.
//
// Pure. `now` and `tz` are passed in; no clock is read here.

import { planFor } from "@engine/capacity.ts";
import { splitBudget } from "@engine/multiSurah.ts";

/** The last day offset that gets exact, named items. */
export const CONCRETE_THROUGH_DAY = 3;
/** The last day offset that gets a day row at all. Past this the zone is a
 *  trajectory, which has no days — see `TrajectoryZone`. */
export const ESTIMATED_THROUGH_DAY = 14;

const DAY_MS = 86_400_000;

export type Zone = "concrete" | "estimated" | "trajectory";

/** A named item a learner can act on. Only ever produced for the concrete
 *  zone — the type is shared, the population is not. */
export interface PlanItem {
  kind: "gate" | "review" | "learn";
  /** "Gate 12:13" / "6 reviews" / "Learn 12:14". Already a sentence fragment;
   *  the view prints it and does not assemble it. */
  label: string;
}

export interface DayForecast {
  /** Days from today. 0 = today. */
  offset: number;
  /** Epoch ms of the day, for the date label. */
  at: number;
  /** "Today" / "Tomorrow" / "Thu 20 Aug". */
  dateLabel: string;
  zone: Zone;
  /** EMPTY outside the concrete zone, by construction. A view cannot name an
   *  ayah in an estimated day because there is no ayah in the data to name. */
  items: PlanItem[];
  /** "~9 min" in the estimated zone; "9 min" in the concrete zone. */
  loadLabel: string;
  /** Kind chips WITHOUT counts in the estimated zone ("gates · reviews"),
   *  because "2 gates" that far out is the invented precision. */
  kindsLabel: string;
  away: boolean;
}

export interface Forecast {
  /** Concrete + estimated days only. The trajectory has no day rows. */
  days: DayForecast[];
  /** "~8 min/day" — the COMMITMENT, which stays stable even when the item
   *  list does not. This is what predictability actually means here. */
  paceLabel: string;
  /** "mid-March" — a half-month, never a day-precise date. */
  finishLabel: string;
  /** Active days to finish, across all enrolled surahs on a SPLIT budget. */
  etaDays: number;
}

export interface EnrolledSurah {
  surah: number;
  remainingAyat: number;
  avgWordsPerAyah: number;
}

export interface BuildForecastInput {
  now: number;
  tz: string;
  /** The learner's ONE total daily commitment, in minutes. */
  minutesPerDay: number;
  enrolled: EnrolledSurah[];
  /** What is actually due right now — the only day we genuinely know. */
  dueToday: {
    gates: { surah: number; ayah: number }[];
    reviews: number;
    learn: { surah: number; ayah: number }[];
  };
  /** Day offsets the learner has marked away. */
  awayDays: number[];
}

function zoneFor(offset: number): Zone {
  if (offset <= CONCRETE_THROUGH_DAY) return "concrete";
  if (offset <= ESTIMATED_THROUGH_DAY) return "estimated";
  return "trajectory";
}

/** A date label. `tz` is passed in and used — never the machine's zone, so a
 *  learner in Kuala Lumpur and a fold running in UTC agree on which day it is. */
function dateLabel(at: number, offset: number, tz: string): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: tz,
  }).format(new Date(at));
}

/** Round to the nearest 5 and mark it approximate. The `~` is not decoration:
 *  it is the difference between a number we measured and a number we guessed,
 *  and it is the second of §14's five honesty devices. */
function approx(n: number): string {
  return `~${Math.max(5, Math.round(n / 5) * 5)}`;
}

/**
 * A HALF-MONTH, never a date. "mid-March" cannot be read as a promise about
 * the 14th, which is exactly the point: a date that is never precise cannot be
 * mistaken for one that is.
 */
export function halfMonthLabel(at: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: tz,
  }).formatToParts(new Date(at));
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const third = day <= 10 ? "early" : day <= 20 ? "mid" : "late";
  return `${third}-${month}`;
}

export function buildForecast(input: BuildForecastInput): Forecast {
  const { now, tz, minutesPerDay, enrolled, dueToday, awayDays } = input;
  const away = new Set(awayDays);

  // E-06: ONE budget, divided by weight across the enrolled surahs. Weight by
  // remaining work, so the surah with more left to do gets more of the day —
  // an equal split would starve the longer surah and inflate its ETA.
  const shares = splitBudget(
    minutesPerDay,
    enrolled.map((e) => ({ surah: e.surah, weight: Math.max(1, e.remainingAyat) })),
  );

  // The learner finishes when the LAST surah finishes — they are working on
  // all of them, so the honest horizon is the max, not the sum and not the min.
  let etaDays = 0;
  for (const e of enrolled) {
    const plan = planFor({
      remainingAyat: e.remainingAyat,
      avgWordsPerAyah: e.avgWordsPerAyah,
      // The SPLIT share. Passing `minutesPerDay` here is the E-06 lie.
      minutesPerDay: shares.get(e.surah) ?? 0,
    });
    etaDays = Math.max(etaDays, plan.etaDays);
  }

  const days: DayForecast[] = [];
  for (let offset = 0; offset <= ESTIMATED_THROUGH_DAY; offset++) {
    const at = now + offset * DAY_MS;
    const zone = zoneFor(offset);
    const isAway = away.has(offset);

    // ITEMS ARE NAMED ONLY IN THE CONCRETE ZONE, and never on an away day.
    // This is the structural half of the honesty mechanic: the estimated zone
    // has nothing to tap open, and absence of affordance is a stronger signal
    // than any styling.
    const items: PlanItem[] =
      zone === "concrete" && !isAway ? concreteItems(dueToday, offset) : [];

    const estimatedItems = Math.max(0, 11 - offset);
    const estimatedMinutes = Math.max(0, minutesPerDay + 1);

    days.push({
      offset,
      at,
      dateLabel: dateLabel(at, offset, tz),
      zone,
      items,
      away: isAway,
      loadLabel: isAway
        ? "No review expected"
        : zone === "concrete"
          ? `${itemMinutes(items)} min · ${items.length} item${items.length === 1 ? "" : "s"}`
          : `${approx(estimatedMinutes)} min · ${approx(estimatedItems)} items`,
      // Kinds WITHOUT counts past the concrete zone.
      kindsLabel: isAway ? "" : zone === "concrete" ? "" : "gates · reviews",
    });
  }

  return {
    days,
    // Rounded to the nearest 5 minutes: the commitment, not a measurement.
    paceLabel: `${approx(minutesPerDay)} min/day`,
    finishLabel: halfMonthLabel(now + etaDays * DAY_MS, tz),
    etaDays,
  };
}

/** Today's real work, and a decaying-but-still-named projection for +1..+3.
 *  Days 1-3 name the ayat that are ALREADY scheduled — gates armed by today's
 *  encodes — which is genuinely knowable; nothing beyond +3 is. */
function concreteItems(
  due: BuildForecastInput["dueToday"],
  offset: number,
): PlanItem[] {
  const items: PlanItem[] = [];
  if (offset === 0) {
    for (const g of due.gates) items.push({ kind: "gate", label: `Gate ${g.surah}:${g.ayah}` });
    if (due.reviews > 0)
      items.push({ kind: "review", label: `${due.reviews} review${due.reviews === 1 ? "" : "s"}` });
    for (const l of due.learn) items.push({ kind: "learn", label: `Learn ${l.surah}:${l.ayah}` });
    return items;
  }
  // +1..+3: the ayat learned today become tomorrow's cold gates (the day-1
  // gate is scheduled at encode), so naming them is a fact, not a guess.
  for (const l of due.learn) {
    items.push({ kind: "gate", label: `Gate ${l.surah}:${l.ayah + offset - 1}` });
  }
  const reviews = Math.max(1, due.reviews - offset);
  items.push({ kind: "review", label: `${reviews} review${reviews === 1 ? "" : "s"}` });
  return items;
}

/** Exact minutes for a concrete day — an integer, no tilde. Appendix A's
 *  per-item costs, kept coarse because the honest resolution of a plan row is
 *  a minute, not a second. */
function itemMinutes(items: PlanItem[]): number {
  let minutes = 0;
  for (const item of items) {
    if (item.kind === "gate") minutes += 1;
    else if (item.kind === "learn") minutes += 3;
    else {
      const n = Number(/(\d+)/.exec(item.label)?.[1] ?? "1");
      minutes += Math.ceil(n * 0.4);
    }
  }
  return Math.max(1, minutes);
}
