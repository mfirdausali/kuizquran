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

describe("buildForecast — the estimated zone's load figures are derived, not decayed", () => {
  // Before this fix, `estimatedItems`/`estimatedMinutes` (forecast.ts) were
  // the header's own illustrative example ("~9 min, ~11 items") turned into
  // a formula (`11 - offset`, `minutesPerDay + 1`) — identical for every
  // learner regardless of pace, and decaying with distance for no reason
  // anything actually knows less the farther out it is (the header's own
  // point is that items/ayat cannot be named that far out, not that the
  // ROUGH LOAD shrinks day by day).
  it("scales the estimated ITEM count with the learner's real commitment", () => {
    // The old formula (`11 - offset`) never read `minutesPerDay` at all — a
    // Maintain-paced learner (barely any minutes) and a Sprint-paced one
    // (many) saw the identical item estimate on the same day offset.
    const low = buildForecast({
      now: NOW,
      tz: TZ,
      minutesPerDay: 4,
      enrolled: [{ surah: 112, remainingAyat: 10, avgWordsPerAyah: 5 }],
      dueToday: { gates: [], reviews: 0, learn: [] },
      awayDays: [],
    });
    const high = buildForecast({
      now: NOW,
      tz: TZ,
      minutesPerDay: 40,
      enrolled: [{ surah: 112, remainingAyat: 10, avgWordsPerAyah: 5 }],
      dueToday: { gates: [], reviews: 0, learn: [] },
      awayDays: [],
    });
    const lowDay = low.days.find((d) => d.offset === 7);
    const highDay = high.days.find((d) => d.offset === 7);
    const lowItems = Number(/~(\d+)\s*items/.exec(lowDay?.loadLabel ?? "")?.[1] ?? NaN);
    const highItems = Number(/~(\d+)\s*items/.exec(highDay?.loadLabel ?? "")?.[1] ?? NaN);
    expect(highItems).toBeGreaterThan(lowItems);
  });

  it("estimates minutes from the real commitment, not commitment-plus-one", () => {
    // Old: `minutesPerDay + 1` — an unexplained fudge with no source. For
    // minutesPerDay=12 that rounds to "~15"; the real commitment rounds to
    // "~10". Picked so the two round to DIFFERENT nearest-5 buckets, so a
    // regression to the old `+1` is caught rather than absorbed by rounding.
    const f = buildForecast({
      now: NOW,
      tz: TZ,
      minutesPerDay: 12,
      enrolled: [{ surah: 112, remainingAyat: 10, avgWordsPerAyah: 5 }],
      dueToday: { gates: [], reviews: 0, learn: [] },
      awayDays: [],
    });
    const day = f.days.find((d) => d.offset === 7);
    expect(day?.loadLabel).toMatch(/~10 min/);
    expect(day?.loadLabel).not.toMatch(/~15 min/);
  });
});

describe("buildForecast — the concrete zone may only name what is actually scheduled", () => {
  // `gate.ts#scheduleGate` arms a cold gate for the NEXT learning-day the
  // moment an ayah encodes — so "tomorrow's gate is today's learn item" is a
  // real, already-scheduled fact once today's encode happens. Nothing
  // schedules a gate two or three days out: that would require guessing
  // which ayah a FUTURE day's Learn pass will pick, whether that pass
  // completes, and whether it reaches S3/encode — none of which `dueToday`
  // knows. §14's own rule: "a review three weeks out depends on how the next
  // twenty sessions actually go" — the identical reasoning applies one day
  // earlier than +4, to day +2 and +3 inside the concrete zone itself.
  it("names tomorrow's gate as the SAME ayah learned today, never a shifted one", () => {
    const f = buildForecast({
      now: NOW,
      tz: TZ,
      minutesPerDay: 8,
      enrolled: [{ surah: 112, remainingAyat: 10, avgWordsPerAyah: 5 }],
      dueToday: { gates: [], reviews: 0, learn: [{ surah: 112, ayah: 5 }] },
      awayDays: [],
    });
    const tomorrow = f.days.find((d) => d.offset === 1);
    expect(tomorrow?.items).toContainEqual({ kind: "gate", label: "Gate 112:5" });
  });

  it("never fabricates a gate for a day +2 or +3 — nothing schedules one that far out", () => {
    const f = buildForecast({
      now: NOW,
      tz: TZ,
      minutesPerDay: 8,
      enrolled: [{ surah: 112, remainingAyat: 10, avgWordsPerAyah: 5 }],
      dueToday: { gates: [], reviews: 0, learn: [{ surah: 112, ayah: 5 }] },
      awayDays: [],
    });
    const dayAfterTomorrow = f.days.find((d) => d.offset === 2);
    const inThreeDays = f.days.find((d) => d.offset === 3);
    expect(dayAfterTomorrow?.items.filter((i) => i.kind === "gate")).toHaveLength(0);
    expect(inThreeDays?.items.filter((i) => i.kind === "gate")).toHaveLength(0);
    // Not merely absent — specifically never the shifted-ayah guess the old
    // code produced ("Gate 112:6" at +2, "Gate 112:7" at +3).
    const allLabels = f.days.flatMap((d) => d.items.map((i) => i.label));
    expect(allLabels).not.toContain("Gate 112:6");
    expect(allLabels).not.toContain("Gate 112:7");
  });

  it("holds for a Sprint-pace learner with several learn candidates today, not only a single one", () => {
    const f = buildForecast({
      now: NOW,
      tz: TZ,
      minutesPerDay: 16,
      enrolled: [{ surah: 112, remainingAyat: 10, avgWordsPerAyah: 5 }],
      dueToday: {
        gates: [],
        reviews: 0,
        learn: [
          { surah: 112, ayah: 5 },
          { surah: 112, ayah: 6 },
          { surah: 112, ayah: 7 },
        ],
      },
      awayDays: [],
    });
    const tomorrow = f.days.find((d) => d.offset === 1);
    // Tomorrow's gates are exactly today's three learn candidates, unshifted.
    expect(tomorrow?.items.filter((i) => i.kind === "gate")).toEqual([
      { kind: "gate", label: "Gate 112:5" },
      { kind: "gate", label: "Gate 112:6" },
      { kind: "gate", label: "Gate 112:7" },
    ]);
    const dayAfterTomorrow = f.days.find((d) => d.offset === 2);
    const inThreeDays = f.days.find((d) => d.offset === 3);
    expect(dayAfterTomorrow?.items.filter((i) => i.kind === "gate")).toHaveLength(0);
    expect(inThreeDays?.items.filter((i) => i.kind === "gate")).toHaveLength(0);
  });
});
