import { describe, expect, it } from "vitest";
import { resumePolicy, TWO_MIN, ONE_HOUR } from "../src/resume.ts";
import { DEFAULT_DAY_CONFIG } from "../src/daybound.ts";

function local(y: number, mo: number, d: number, h: number, mi = 0): number {
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}

describe("resumePolicy (FR5)", () => {
  const base = local(2026, 7, 14, 10, 0);

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
    const next = local(2026, 7, 15, 6, 0);
    const d = resumePolicy(base, next, DEFAULT_DAY_CONFIG);
    expect(d.action).toBe("makeup");
  });

  it("a short gap that still crosses the boundary is a make-up (boundary wins)", () => {
    // 04:20 → 04:40 next... use 04:29 → 04:31 to cross 04:30 with a 2-min gap.
    const before = local(2026, 7, 14, 4, 29);
    const after = local(2026, 7, 14, 4, 31);
    const d = resumePolicy(before, after, DEFAULT_DAY_CONFIG);
    expect(d.action).toBe("makeup");
  });
});
