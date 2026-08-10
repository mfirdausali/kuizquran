// build-plan step 11 (the remaining slice after DECISIONS.md's v3-D27 scope
// cut landed Site/siteKey/expand/visitOrdinal): WIREFRAME.md §23 Q2's
// rotation mechanism. "Rotation is lane-first, then an affine cycle within
// the lane. `lapPerm` hash-permutes the L lanes per lap, so every lane fires
// exactly once per lap (no starvation, structurally) while lap order differs
// every lap (variety). `stride(N)` is computed in integer arithmetic — no
// float on the selection path."
//
// These are property tests, not a byte-replication of WIREFRAME's own
// measured numbers (17/30 distinct on 12:4, 5/5 distinct lap orders, etc.) —
// that measurement came from a prototype whose exact algorithm was never
// committed to source. What IS committed here is an algorithm that provably
// satisfies the properties WIREFRAME states as requirements: every lane
// fires exactly once per lap, no immediate repeats within a lane's own
// cycle, full pool coverage before any repeat, and no RNG (INVARIANTS.md
// Absolute A) — deterministic and replay-safe across devices.
import { describe, expect, it } from "vitest";
import { lapPerm, stride, affineIndex } from "../src/rotation.ts";

describe("lapPerm — every lane fires exactly once per lap (no starvation)", () => {
  it("returns a permutation of [0..laneCount-1] for any lap", () => {
    for (const laneCount of [1, 2, 3, 6, 8]) {
      for (let lap = 0; lap < 10; lap++) {
        const perm = lapPerm(lap, laneCount, 42);
        expect(perm.slice().sort((a, b) => a - b)).toEqual(
          Array.from({ length: laneCount }, (_, i) => i),
        );
      }
    }
  });

  it("lap order varies across laps (variety) for laneCount >= 3", () => {
    const orders = Array.from({ length: 5 }, (_, lap) => lapPerm(lap, 6, 7).join(","));
    // not every lap collapses to the same order (WIREFRAME: "distinct lap orders")
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it("is deterministic — same (lap, laneCount, seedKey) always returns the same order", () => {
    expect(lapPerm(3, 6, 42)).toEqual(lapPerm(3, 6, 42));
  });

  it("different seedKeys (e.g. different sites) can diverge in lap order", () => {
    const a = lapPerm(0, 6, 1).join(",");
    const b = lapPerm(0, 6, 2).join(",");
    // not a hard guarantee for every pair, but true for this pair — pins the
    // seedKey actually influencing the permutation, not just `lap`.
    expect(a === b).toBe(false);
  });
});

describe("stride — an integer step coprime with the pool size", () => {
  it("is coprime with poolSize for every poolSize from 3 to 50", () => {
    function gcd(a: number, b: number): number {
      while (b !== 0) [a, b] = [b, a % b];
      return a;
    }
    for (let poolSize = 3; poolSize <= 50; poolSize++) {
      expect(gcd(stride(poolSize), poolSize)).toBe(1);
    }
  });

  it("never returns 0 or a non-integer", () => {
    for (let poolSize = 1; poolSize <= 20; poolSize++) {
      const s = stride(poolSize);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThan(0);
    }
  });
});

describe("affineIndex — full pool coverage before any repeat, no immediate repeats", () => {
  it("visits every index 0..poolSize-1 exactly once before repeating, for poolSize 3..20", () => {
    for (let poolSize = 3; poolSize <= 20; poolSize++) {
      const seen = new Set<number>();
      for (let n = 0; n < poolSize; n++) {
        seen.add(affineIndex(n, poolSize));
      }
      expect(seen.size).toBe(poolSize); // full coverage, no collisions within one cycle
      // and it's periodic with period poolSize:
      expect(affineIndex(poolSize, poolSize)).toBe(affineIndex(0, poolSize));
    }
  });

  it("never repeats the immediately-prior index, for poolSize > 1 (WIREFRAME: 'a rotation, not a swap')", () => {
    for (let poolSize = 2; poolSize <= 30; poolSize++) {
      for (let n = 0; n < poolSize * 2; n++) {
        expect(affineIndex(n, poolSize)).not.toBe(affineIndex(n + 1, poolSize));
      }
    }
  });

  it("a per-lane offset shifts the starting point without breaking full coverage", () => {
    const poolSize = 7;
    const seen = new Set<number>();
    for (let n = 0; n < poolSize; n++) seen.add(affineIndex(n, poolSize, 3));
    expect(seen.size).toBe(poolSize);
  });

  it("throws on a non-positive pool size (a caller bug, not a runtime condition to silently clamp)", () => {
    expect(() => affineIndex(0, 0)).toThrow();
    expect(() => affineIndex(0, -1)).toThrow();
  });
});

describe("stress: L=2..8 lanes x 5 seed keys x 400 visits — 0 immediate repeats, every lane balanced", () => {
  it("holds across the full sweep", () => {
    for (let laneCount = 2; laneCount <= 8; laneCount++) {
      for (let seedKey = 0; seedKey < 5; seedKey++) {
        const laneVisitCounts = new Array(laneCount).fill(0);
        let prevLane = -1;
        const visitsPerLap = laneCount;
        const laps = Math.ceil(400 / visitsPerLap);
        let immediateRepeats = 0;
        for (let lap = 0; lap < laps; lap++) {
          const order = lapPerm(lap, laneCount, seedKey);
          for (const lane of order) {
            laneVisitCounts[lane]++;
            if (lane === prevLane) immediateRepeats++;
            prevLane = lane;
          }
        }
        expect(immediateRepeats).toBe(0); // laneCount >= 2 → a permutation never repeats adjacently within itself, and across laps only the seam between lap boundaries could repeat — checked below too
        // every lane visited roughly the same number of times (perfectly balanced
        // per lap since lapPerm is a permutation — each lane exactly once per lap).
        const min = Math.min(...laneVisitCounts);
        const max = Math.max(...laneVisitCounts);
        expect(max - min).toBeLessThanOrEqual(1);
      }
    }
  });
});
