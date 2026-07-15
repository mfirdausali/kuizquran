import { beforeEach, describe, expect, it } from "vitest";
import { loadAnchor, saveAnchor } from "./Anchor.tsx";
import { computeStreak, floorQueue, learningDayIndex, initAtom, type AtomState } from "engine";

beforeEach(() => localStorage.clear());

describe("anchor persistence (local)", () => {
  it("round-trips the anchor hour", () => {
    expect(loadAnchor()).toBeNull();
    saveAnchor(8);
    expect(loadAnchor()).toBe(8);
  });
});

describe("streak from event days (client mapping)", () => {
  it("computes a streak from completed-session learning-days", () => {
    const now = Date.now();
    const today = learningDayIndex(now);
    const s = computeStreak([today, today - 1], now);
    expect(s.length).toBe(2);
  });
});

describe("floor session is never empty (client uses engine floorQueue)", () => {
  it("returns a warm-up when nothing is due", () => {
    const atom: AtomState = { ...initAtom("ayah", 4), encoded: true, strength: 90, stability: 999, lastRetrieval: Date.now() };
    const q = floorQueue([atom], Date.now());
    expect(q.length).toBe(1);
  });
});
