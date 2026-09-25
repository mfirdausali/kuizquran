// WIREFRAME §14's own instruction, verbatim: "planFor() returns habitProtocol:
// { underloaded: true, secondThreadFromDay: 3 }. The forecast must reflect
// that deliberate ramp, or week 1 will always look 'behind.'" `buildForecast`
// had never read `habitProtocol` at all — this file did not exist before this
// fix, so nothing exercised the finish-date/ETA projection's own honesty rule.

import { describe, expect, it } from "vitest";
import { buildForecast } from "./forecast.ts";

const NOW = 1_700_000_000_000;
const TZ = "UTC";

describe("buildForecast — the first-week habit-protocol ramp (WIREFRAME §14)", () => {
  it("does not inflate the ETA for a learner whose capacity is already one ayah/day", () => {
    // avgWordsPerAyah=16, minutesPerDay=8 -> ayahPerDay=1 (the common Steady
    // case) — the ramp caps at 1 too, so nothing should change here.
    const f = buildForecast({
      now: NOW,
      tz: TZ,
      minutesPerDay: 8,
      enrolled: [{ surah: 12, remainingAyat: 107, avgWordsPerAyah: 16 }],
      dueToday: { gates: [], reviews: 0, learn: [] },
      awayDays: [],
    });
    expect(f.etaDays).toBe(Math.ceil(107 / 1));
  });

  it("projects a LATER, ramp-honest finish for a learner whose capacity would otherwise run more than one new-ayah thread from day 1", () => {
    // avgWordsPerAyah=5, minutesPerDay=20 -> ayahPerDay=7 (capacity.test.ts's
    // own fixture for this exact case).
    const f = buildForecast({
      now: NOW,
      tz: TZ,
      minutesPerDay: 20,
      enrolled: [{ surah: 112, remainingAyat: 20, avgWordsPerAyah: 5 }],
      dueToday: { gates: [], reviews: 0, learn: [] },
      awayDays: [],
    });
    // The un-ramped (wrong) answer would be ceil(20/7) = 3 — the exact
    // "week 1 always looks behind" lie WIREFRAME §14 names.
    expect(f.etaDays).not.toBe(3);
    expect(f.etaDays).toBe(5);
  });

  it("the ramped ETA still drives the half-month finish label, never a day-precise date", () => {
    const f = buildForecast({
      now: NOW,
      tz: TZ,
      minutesPerDay: 20,
      enrolled: [{ surah: 112, remainingAyat: 20, avgWordsPerAyah: 5 }],
      dueToday: { gates: [], reviews: 0, learn: [] },
      awayDays: [],
    });
    expect(f.finishLabel).toMatch(/^(early|mid|late)-/);
  });
});
