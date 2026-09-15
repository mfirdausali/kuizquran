import { describe, expect, it } from "vitest";
import { resumePolicy, resumeNotice, TWO_MIN, ONE_HOUR } from "../src/resume.ts";
import { DEFAULT_DAY_CONFIG } from "../src/daybound.ts";

// UTC wall clock — matches DEFAULT_DAY_CONFIG.tz, which the boundary tests pass.
// A machine-local constructor would make these assertions offset-dependent: the
// 04:29→04:31 pair below only straddles the 04:30 rollover when built in UTC.
function atUtc(y: number, mo: number, d: number, h: number, mi = 0): number {
  return Date.UTC(y, mo - 1, d, h, mi, 0, 0);
}

describe("resumePolicy (FR5)", () => {
  const base = atUtc(2026, 7, 14, 10, 0);

  it("<2 min → resume in place, latency kept", () => {
    const d = resumePolicy(base, base + TWO_MIN - 1000);
    expect(d.action).toBe("resume");
    expect(d.discardLatency).toBe(false);
  });

  it("<1 hr → restart drill, latency discarded, weighted massed", () => {
    const d = resumePolicy(base, base + 30 * 60_000);
    expect(d.action).toBe("restart");
    expect(d.discardLatency).toBe(true);
    expect(d.massed).toBe(true);
  });

  it(">1 hr same day → re-plan with warm-up", () => {
    const d = resumePolicy(base, base + ONE_HOUR + 60_000);
    expect(d.action).toBe("replan");
    expect(d.discardLatency).toBe(true);
    expect(d.massed).toBe(false);
  });

  it("past the day boundary → make-up merge, regardless of gap", () => {
    // 10:00 today → 06:00 next day crosses the 04:30 rollover.
    const next = atUtc(2026, 7, 15, 6, 0);
    const d = resumePolicy(base, next, DEFAULT_DAY_CONFIG);
    expect(d.action).toBe("makeup");
  });

  it("a short gap that still crosses the boundary is a make-up (boundary wins)", () => {
    // 04:20 → 04:40 next... use 04:29 → 04:31 to cross 04:30 with a 2-min gap.
    const before = atUtc(2026, 7, 14, 4, 29);
    const after = atUtc(2026, 7, 14, 4, 31);
    const d = resumePolicy(before, after, DEFAULT_DAY_CONFIG);
    expect(d.action).toBe("makeup");
  });
});

describe("resumeNotice (FR5) — the one-line notice for a real re-entry", () => {
  it("says nothing for the ordinary 'resume' case", () => {
    expect(resumeNotice("resume")).toBeNull();
  });

  it("names the time-on-task consequence for restart and replan, distinctly from makeup", () => {
    const restart = resumeNotice("restart");
    const replan = resumeNotice("replan");
    const makeup = resumeNotice("makeup");
    expect(restart).not.toBeNull();
    expect(replan).not.toBeNull();
    expect(makeup).not.toBeNull();
    // restart/replan share the honest "won't count" framing; makeup is a
    // materially different fact (a new day, not a discarded latency) and must
    // not be conflated with the other two under one shared sentence.
    expect(restart).toBe(replan);
    expect(makeup).not.toBe(restart);
  });
});
