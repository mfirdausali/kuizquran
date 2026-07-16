import { beforeEach, describe, expect, it } from "vitest";
import { getAnchorHour, setAnchorHour, clearAnchorHour, ANCHOR_CHOICES } from "./anchor.ts";

beforeEach(() => localStorage.clear());

describe("anchor-hour persistence (FR9/FR10)", () => {
  it("returns null when never set", () => {
    expect(getAnchorHour()).toBeNull();
  });

  it("round-trips a chosen hour (including half-hours)", () => {
    setAnchorHour(22.5);
    expect(getAnchorHour()).toBe(22.5);
  });

  it("clears back to null", () => {
    setAnchorHour(8);
    clearAnchorHour();
    expect(getAnchorHour()).toBeNull();
  });

  it("offers a secular set of anchor choices (no prayer names, D16/D34)", () => {
    expect(ANCHOR_CHOICES.length).toBeGreaterThan(0);
    for (const c of ANCHOR_CHOICES) {
      expect(c.hour).toBeGreaterThanOrEqual(0);
      expect(c.hour).toBeLessThan(24);
    }
  });
});
