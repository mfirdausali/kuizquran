// WIREFRAME.md §14 "Planned absences": "Any future day can be marked away —
// travel, exams, illness. The forecast adjusts honestly instead of scoring it
// a miss." `lib/plan/forecast.ts` (build-plan step 19) has taken an
// `awayDays: number[]` input since it was written, but nothing ever produced
// a real value for it — the write path (a new event type, an outbox row)
// did not exist yet (DECISIONS.md v3-D190/v3-D207). This module is that
// missing read side.
//
// A `day_marked_away` event is a TOGGLE, not a fact — read straight off the
// append-only log, the same "component never computes, it only prints"
// split `heatmap.ts#testHistory`/`growthCurve` already establish. It is
// evidence-only: `rebuild.ts` has no branch for it at all (invariant #5's
// structural-absence discipline), so marking a day away can never move a
// strength or a due date.

import type { DrillEvent } from "./types.ts";

const DAY_MS = 86_400_000;

/**
 * Absolute calendar-day index (days since the Unix epoch) for an epoch-ms
 * instant. Deliberately the SAME plain arithmetic `lib/plan/forecast.ts`
 * already uses for its own day offsets (`now + offset * DAY_MS`) — not
 * `daybound.ts`'s tz-explicit learning-day boundary, which this module does
 * not use. The plan calendar's "day" is already a plain calendar-day count;
 * mixing two different definitions of "day" across one feature is exactly
 * the confusion GLOSSARY.md's own 'day' entry exists to prevent.
 */
export function dayIndexOf(epochMs: number): number {
  return Math.floor(epochMs / DAY_MS);
}

/**
 * Currently-marked-away FUTURE day offsets (0 = today), read straight off
 * the log. The latest `day_marked_away` event for a given `awayDayIndex`
 * wins, by LOG POSITION — callers hand this canonically ordered events, the
 * same trust `testHistory`/`growthCurve` already extend, never re-sorted
 * here. A day already in the past by `now` is dropped: the forecast has
 * nothing left to redistribute for a day that has already happened.
 */
export function awayDayOffsets(events: DrillEvent[], now: number): number[] {
  const today = dayIndexOf(now);
  const latest = new Map<number, boolean>();
  for (const e of events) {
    if (e.type !== "day_marked_away") continue;
    if (e.awayDayIndex === undefined || e.away === undefined) continue;
    latest.set(e.awayDayIndex, e.away);
  }
  const offsets: number[] = [];
  for (const [dayIndex, away] of latest) {
    if (away && dayIndex >= today) offsets.push(dayIndex - today);
  }
  return offsets.sort((a, b) => a - b);
}
