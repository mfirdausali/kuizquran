import { describe, expect, it } from "vitest";
import { lastActiveDayMs } from "../src/activity.ts";
import type { DrillEvent } from "../src/types.ts";

function ev(ts: number): DrillEvent {
  return { type: "rung_complete", ts, surah: 12, ayah: 4, rung: "S1" };
}

describe("lastActiveDayMs (v2-BUG-2 fix)", () => {
  it("null on an empty log (a brand-new learner)", () => {
    expect(lastActiveDayMs([])).toBeNull();
  });

  it("the max ts across the log, regardless of insertion order", () => {
    const events = [ev(1_000), ev(5_000), ev(3_000)];
    expect(lastActiveDayMs(events)).toBe(5_000);
  });

  it("a single-event log returns that event's ts", () => {
    expect(lastActiveDayMs([ev(42)])).toBe(42);
  });
});
