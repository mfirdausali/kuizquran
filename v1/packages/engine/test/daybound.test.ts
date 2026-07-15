import { describe, expect, it } from "vitest";
import {
  dayStart,
  isSameLearningDay,
  daysBetween,
  learningDayIndex,
  DEFAULT_DAY_CONFIG,
} from "../src/daybound.ts";

// Build a local-time instant deterministically (tests run in the machine's tz;
// the boundary math is on local wall clock by design).
function local(y: number, mo: number, d: number, h: number, mi = 0): number {
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}

describe("secular day boundary (rollover, no Fajr calc)", () => {
  const cfg = DEFAULT_DAY_CONFIG; // 04:30

  it("before the rollover belongs to the previous learning-day", () => {
    const at3am = local(2026, 7, 14, 3, 0);
    const at6am = local(2026, 7, 14, 6, 0);
    // 3am is before 04:30 → its day started at yesterday's 04:30.
    expect(dayStart(at3am, cfg)).toBe(local(2026, 7, 13, 4, 30));
    // 6am is after → today's 04:30.
    expect(dayStart(at6am, cfg)).toBe(local(2026, 7, 14, 4, 30));
  });

  it("a session before vs after the boundary are different learning-days", () => {
    const at3am = local(2026, 7, 14, 3, 0);
    const at6am = local(2026, 7, 14, 6, 0);
    expect(isSameLearningDay(at3am, at6am, cfg)).toBe(false);
  });

  it("two evening sessions on the same date are the same learning-day", () => {
    const at8pm = local(2026, 7, 14, 20, 0);
    const at11pm = local(2026, 7, 14, 23, 0);
    expect(isSameLearningDay(at8pm, at11pm, cfg)).toBe(true);
  });

  it("daysBetween counts learning-day rollovers", () => {
    const d0 = local(2026, 7, 14, 10, 0);
    const d1 = local(2026, 7, 15, 10, 0);
    const d3 = local(2026, 7, 17, 10, 0);
    expect(daysBetween(d0, d1, cfg)).toBe(1);
    expect(daysBetween(d0, d3, cfg)).toBe(3);
    expect(daysBetween(d0, d0, cfg)).toBe(0);
  });

  it("rollover hour is configurable", () => {
    const at5am = local(2026, 7, 14, 5, 0);
    // With rollover 6.0, 5am is still yesterday.
    expect(learningDayIndex(at5am, { rolloverHour: 6 })).toBe(
      learningDayIndex(local(2026, 7, 13, 12, 0), { rolloverHour: 6 }),
    );
  });
});
