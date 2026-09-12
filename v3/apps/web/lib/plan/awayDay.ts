"use client";

// WIREFRAME §14 "Planned absences" — the write half. `lib/plan/forecast.ts`
// has read an `awayDays: number[]` input since it was built; this is the
// write path DECISIONS.md v3-D190 named as missing (a new event type, an
// outbox row).

import type { DrillEvent } from "@engine/types.ts";
import { gradeClassToWire } from "@engine/gradeClass.ts";
import { append, type AppendContext } from "@/lib/idb/append";

/**
 * Toggle a future day away/back on `surah`'s plan calendar. Commits through
 * the SAME commit-before-paint `append()` every other event uses — a tab
 * killed mid-toggle loses nothing (edge case #76). Never touches an atom:
 * `rebuild.ts` has no branch for `day_marked_away` (invariant #5).
 *
 * `dayIndex` is the ABSOLUTE calendar-day index
 * (`@engine/awayDays.ts#dayIndexOf`), not an offset — the caller resolves
 * the offset it is showing against its own `now` before calling this, so a
 * toggle written today still resolves to the correct day once `now` has
 * moved on.
 */
export async function setDayAway(
  surah: number,
  dayIndex: number,
  away: boolean,
  ctx: AppendContext,
): Promise<void> {
  const event: DrillEvent = {
    type: "day_marked_away",
    ts: ctx.now,
    surah,
    ayah: 0,
    rung: gradeClassToWire("ungraded"),
    awayDayIndex: dayIndex,
    away,
  };
  await append(event, ctx);
}
