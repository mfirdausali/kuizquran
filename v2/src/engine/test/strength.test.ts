import { describe, expect, it } from "vitest";
import { halfLifeDays } from "../src/strength.ts";
import { initAtom } from "../src/atom.ts";

describe("halfLifeDays (v2-D19 first InfoTip target)", () => {
  it("stability·ln(2) — the point retrievability crosses 0.5", () => {
    const atom = { ...initAtom("ayah", 4), stability: 10 };
    expect(halfLifeDays(atom)).toBeCloseTo(10 * Math.LN2, 5);
  });

  it("zero for a never-retrieved atom (stability 0)", () => {
    expect(halfLifeDays(initAtom("ayah", 4))).toBe(0);
  });

  it("grows with stability", () => {
    const weak = { ...initAtom("ayah", 4), stability: 2 };
    const strong = { ...initAtom("ayah", 4), stability: 20 };
    expect(halfLifeDays(strong)).toBeGreaterThan(halfLifeDays(weak));
  });
});
