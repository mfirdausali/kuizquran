import { describe, expect, it } from "vitest";
import {
  dayStart,
  isSameLearningDay,
  daysBetween,
  learningDayIndex,
  DEFAULT_DAY_CONFIG,
} from "../src/daybound.ts";

// Build an instant from a wall clock read in UTC — the same zone the configs
// below pass (DEFAULT_DAY_CONFIG.tz === "UTC"). Deliberately NOT
// `new Date(y, mo, d, ...)`: that constructor reads the MACHINE's zone, so the
// test would build one instant and assert against an engine reasoning in
// another, differing by the runner's offset. Construction frame must match the
// tz the test itself hands the engine.
function atUtc(y: number, mo: number, d: number, h: number, mi = 0): number {
  return Date.UTC(y, mo - 1, d, h, mi, 0, 0);
}

describe("secular day boundary (rollover, no Fajr calc)", () => {
  const cfg = DEFAULT_DAY_CONFIG; // 04:30

  it("before the rollover belongs to the previous learning-day", () => {
    const at3am = atUtc(2026, 7, 14, 3, 0);
    const at6am = atUtc(2026, 7, 14, 6, 0);
    // 3am is before 04:30 → its day started at yesterday's 04:30.
    expect(dayStart(at3am, cfg)).toBe(atUtc(2026, 7, 13, 4, 30));
    // 6am is after → today's 04:30.
    expect(dayStart(at6am, cfg)).toBe(atUtc(2026, 7, 14, 4, 30));
  });

  it("a session before vs after the boundary are different learning-days", () => {
    const at3am = atUtc(2026, 7, 14, 3, 0);
    const at6am = atUtc(2026, 7, 14, 6, 0);
    expect(isSameLearningDay(at3am, at6am, cfg)).toBe(false);
  });

  it("two evening sessions on the same date are the same learning-day", () => {
    const at8pm = atUtc(2026, 7, 14, 20, 0);
    const at11pm = atUtc(2026, 7, 14, 23, 0);
    expect(isSameLearningDay(at8pm, at11pm, cfg)).toBe(true);
  });

  it("daysBetween counts learning-day rollovers", () => {
    const d0 = atUtc(2026, 7, 14, 10, 0);
    const d1 = atUtc(2026, 7, 15, 10, 0);
    const d3 = atUtc(2026, 7, 17, 10, 0);
    expect(daysBetween(d0, d1, cfg)).toBe(1);
    expect(daysBetween(d0, d3, cfg)).toBe(3);
    expect(daysBetween(d0, d0, cfg)).toBe(0);
  });

  it("rollover hour is configurable", () => {
    const at5am = atUtc(2026, 7, 14, 5, 0);
    // With rollover 6.0, 5am is still yesterday.
    expect(learningDayIndex(at5am, { rolloverHour: 6, tz: "UTC" })).toBe(
      learningDayIndex(atUtc(2026, 7, 13, 12, 0), { rolloverHour: 6, tz: "UTC" }),
    );
  });
});
