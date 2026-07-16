import { describe, expect, it } from "vitest";
import { paceConfig, candidatesForPace, DEFAULT_PACE_MODE } from "../src/pace.ts";

describe("pace modes (v2-D09)", () => {
  it("Steady: 1/day ceiling, a modest budget, strict gate tolerance", () => {
    const c = paceConfig("steady");
    expect(c.newAyahCeiling).toBe(1);
    expect(c.gateTolerance).toBe(0);
    expect(c.budgetMin).toBeGreaterThan(0);
  });

  it("Sprint: a raised budget, a wider Learn window, and gate-wall tolerance", () => {
    const steady = paceConfig("steady");
    const sprint = paceConfig("sprint");
    expect(sprint.budgetMin).toBeGreaterThan(steady.budgetMin);
    expect(sprint.newAyahCeiling).toBeGreaterThan(steady.newAyahCeiling);
    expect(sprint.gateTolerance).toBeGreaterThan(steady.gateTolerance);
  });

  it("Maintain: zero new ayat — reviews/chains only", () => {
    const c = paceConfig("maintain");
    expect(c.newAyahCeiling).toBe(0);
  });

  it("the three modes are genuinely distinct (v2-BUG-1: Steady/Sprint must not collapse)", () => {
    const configs = (["steady", "sprint", "maintain"] as const).map(paceConfig);
    const budgets = configs.map((c) => c.budgetMin);
    const ceilings = configs.map((c) => c.newAyahCeiling);
    expect(new Set(budgets).size).toBeGreaterThan(1);
    expect(new Set(ceilings).size).toBe(3);
  });

  it("candidatesForPace clips the Learn window to the mode's ceiling", () => {
    const window = [4, 5, 6, 7, 8];
    expect(candidatesForPace(window, "maintain")).toEqual([]);
    expect(candidatesForPace(window, "steady")).toEqual([4]);
    expect(candidatesForPace(window, "sprint").length).toBe(paceConfig("sprint").newAyahCeiling);
  });

  it("has a sane default mode", () => {
    expect(["steady", "sprint", "maintain"]).toContain(DEFAULT_PACE_MODE);
  });
});
