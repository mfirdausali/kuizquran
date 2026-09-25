import { describe, expect, it } from "vitest";
import { estMinutes, etaDaysWithRamp, planFor } from "../src/capacity.ts";

describe("estMinutes (Appendix A: 0.33·W + 0.4·R + 1.25·chains + 0.17·junctions)", () => {
  it("computes the weighted sum", () => {
    expect(estMinutes({ newWords: 15, dueReviews: 5, chains: 2, junctions: 3 })).toBeCloseTo(
      0.33 * 15 + 0.4 * 5 + 1.25 * 2 + 0.17 * 3,
      5,
    );
  });
  it("zero load = zero minutes", () => {
    expect(estMinutes({ newWords: 0, dueReviews: 0, chains: 0, junctions: 0 })).toBe(0);
  });
});

describe("planFor", () => {
  it("fits new-ayah Learn into the daily budget and reports an honest ETA", () => {
    // 16 words/ayah → ~5.3 min/ayah; 8 min/day → 60% = 4.8 min → floor(4.8/5.3)=0 → min 1
    const p = planFor({ remainingAyat: 107, avgWordsPerAyah: 16, minutesPerDay: 8 });
    expect(p.ayahPerDay).toBeGreaterThanOrEqual(1);
    expect(p.etaDays).toBe(Math.ceil(107 / p.ayahPerDay));
    expect(p.remaining).toBe(107);
  });

  it("more minutes/day → more ayah/day", () => {
    const slow = planFor({ remainingAyat: 100, avgWordsPerAyah: 16, minutesPerDay: 8 });
    const fast = planFor({ remainingAyat: 100, avgWordsPerAyah: 16, minutesPerDay: 30 });
    expect(fast.ayahPerDay).toBeGreaterThanOrEqual(slow.ayahPerDay);
  });

  it("nothing remaining → 0 days", () => {
    const p = planFor({ remainingAyat: 0, avgWordsPerAyah: 16, minutesPerDay: 8 });
    expect(p.etaDays).toBe(0);
  });

  it("always carries the first-week habit protocol", () => {
    const p = planFor({ remainingAyat: 50, avgWordsPerAyah: 16, minutesPerDay: 8 });
    expect(p.habitProtocol.underloaded).toBe(true);
    expect(p.habitProtocol.secondThreadFromDay).toBe(3);
  });
});

// WIREFRAME §14: "planFor() returns habitProtocol... The forecast must
// reflect that deliberate ramp, or week 1 will always look 'behind.'"
// `planFor()`'s own `etaDays` stays the plain steady-state figure (every
// existing test above reads it that way); this is the separate, ramp-aware
// projection a forecast caller needs.
describe("etaDaysWithRamp (FR10 first-week ramp)", () => {
  it("matches planFor's own etaDays when capacity is already a single thread", () => {
    const p = planFor({ remainingAyat: 107, avgWordsPerAyah: 16, minutesPerDay: 8 });
    expect(p.ayahPerDay).toBe(1);
    expect(etaDaysWithRamp(p)).toBe(p.etaDays);
  });

  it("caps the first two days at one ayah even when steady-state capacity is higher", () => {
    const p = planFor({ remainingAyat: 20, avgWordsPerAyah: 5, minutesPerDay: 20 });
    expect(p.ayahPerDay).toBe(7);
    // unramped: ceil(20/7) = 3 — the exact "week 1 looks ahead of itself" lie.
    expect(p.etaDays).toBe(3);
    // ramped: day1=1 (left 19), day2=1 (left 18), day3=7 (left 11), day4=7
    // (left 4), day5=7 (left -3) -> 5 days.
    expect(etaDaysWithRamp(p)).toBe(5);
  });

  it("lifts the cap exactly at secondThreadFromDay, never a day early or late", () => {
    const p = planFor({ remainingAyat: 20, avgWordsPerAyah: 5, minutesPerDay: 20 });
    expect(etaDaysWithRamp({ ...p, remaining: 2 })).toBe(2); // still ramped: 1 + 1
    expect(etaDaysWithRamp({ ...p, remaining: 1 })).toBe(1);
  });

  it("nothing remaining -> 0 days, ramp or not", () => {
    const p = planFor({ remainingAyat: 0, avgWordsPerAyah: 16, minutesPerDay: 8 });
    expect(etaDaysWithRamp(p)).toBe(0);
  });
});
