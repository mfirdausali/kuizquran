// WIREFRAME.md §14 "Planned absences": "Any future day can be marked away —
// travel, exams, illness. The forecast adjusts honestly instead of scoring it
// a miss." `lib/plan/forecast.ts` has accepted an `awayDays: number[]` input
// since it was built, but nothing ever produced a real value — the write path
// (a new event type, an outbox row) did not exist (DECISIONS.md v3-D190).
//
// This is that missing read side. A `day_marked_away` event is a TOGGLE, read
// straight off the append-only log — `rebuild.ts` has no branch for it
// (invariant #5's structural-absence discipline), so marking a day away can
// never move a strength or a due date.

import { describe, expect, it } from "vitest";
import { awayDayOffsets, dayIndexOf } from "../src/awayDays.ts";
import { rebuild } from "../src/rebuild.ts";
import type { DrillEvent } from "../src/types.ts";

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 8, 12, 9, 0, 0); // 2026-09-12T09:00:00Z
const TODAY = dayIndexOf(NOW);

function away(dayIndex: number, isAway: boolean, ts: number = NOW): DrillEvent {
  return {
    type: "day_marked_away",
    ts,
    surah: 12,
    ayah: 0,
    rung: "S4",
    awayDayIndex: dayIndex,
    away: isAway,
  };
}

describe("dayIndexOf", () => {
  it("is a plain calendar-day count, matching forecast.ts's own offset arithmetic", () => {
    expect(dayIndexOf(NOW + 3 * DAY_MS) - dayIndexOf(NOW)).toBe(3);
    expect(dayIndexOf(NOW - 2 * DAY_MS) - dayIndexOf(NOW)).toBe(-2);
  });
});

describe("awayDayOffsets", () => {
  it("returns the offset of a future day marked away", () => {
    const offsets = awayDayOffsets([away(TODAY + 2, true)], NOW);
    expect(offsets).toEqual([2]);
  });

  it("returns nothing when the log has no day_marked_away events", () => {
    const events: DrillEvent[] = [
      { type: "session_start", ts: NOW, surah: 12, ayah: 1, rung: "RC" },
    ];
    expect(awayDayOffsets(events, NOW)).toEqual([]);
  });

  it("drops a day already in the past by `now` — nothing left to redistribute", () => {
    const offsets = awayDayOffsets(
      [away(TODAY - 1, true), away(TODAY + 1, true)],
      NOW,
    );
    expect(offsets).toEqual([1]);
  });

  it("un-marks a day: a later away:false event wins over an earlier away:true one", () => {
    const offsets = awayDayOffsets(
      [away(TODAY + 5, true, NOW - 1000), away(TODAY + 5, false, NOW)],
      NOW,
    );
    expect(offsets).toEqual([]);
  });

  it("re-marks a day: a later away:true event wins over an earlier away:false one", () => {
    const offsets = awayDayOffsets(
      [away(TODAY + 5, false, NOW - 1000), away(TODAY + 5, true, NOW)],
      NOW,
    );
    expect(offsets).toEqual([5]);
  });

  it("trusts log order for latest-wins, never re-sorting by ts — the same trust testHistory/growthCurve already extend", () => {
    // Deliberately handed OUT of ts order — the LAST entry in the array wins,
    // not the one with the greatest ts, proving this reads log position and
    // does not silently re-sort.
    const offsets = awayDayOffsets(
      [away(TODAY + 5, true, NOW + 9999), away(TODAY + 5, false, NOW)],
      NOW,
    );
    expect(offsets).toEqual([]);
  });

  it("returns multiple away days sorted ascending by offset", () => {
    const offsets = awayDayOffsets(
      [away(TODAY + 9, true), away(TODAY + 2, true), away(TODAY + 5, true)],
      NOW,
    );
    expect(offsets).toEqual([2, 5, 9]);
  });

  it("ignores a malformed toggle (missing awayDayIndex or away)", () => {
    const events: DrillEvent[] = [
      { type: "day_marked_away", ts: NOW, surah: 12, ayah: 0, rung: "S4", away: true },
      { type: "day_marked_away", ts: NOW, surah: 12, ayah: 0, rung: "S4", awayDayIndex: TODAY + 1 },
    ];
    expect(awayDayOffsets(events, NOW)).toEqual([]);
  });
});

describe("invariant #5 — day_marked_away never mutates an atom", () => {
  it("folds to an empty atoms map, exactly like every other evidence-only event", () => {
    const atoms = rebuild([away(TODAY + 2, true)]);
    expect(atoms.size).toBe(0);
  });
});
