import { describe, expect, it } from "vitest";
import { estMinutes, planFor } from "../src/capacity.ts";

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
