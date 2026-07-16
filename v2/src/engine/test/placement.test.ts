import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initPlacement,
  nextProbe,
  answerProbe,
  placementResult,
  actLandmarks,
  type PlacementState,
} from "../src/placement.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../public/corpus/12.json"), "utf8"),
) as Corpus;

const NUM_ACTS = 19;

/** Simulate a user whose TRUE carried boundary is `trueCarried` acts (0..19):
 *  they answer "yes" to any probed act ≤ trueCarried, "no" otherwise. */
function runToBoundary(trueCarried: number): PlacementState {
  let state = initPlacement(corpus);
  let guard = 0;
  while (!state.done && guard++ < 50) {
    const probe = nextProbe(state, corpus);
    if ("done" in probe) break;
    state = answerProbe(state, probe.act <= trueCarried ? "yes" : "no");
  }
  return state;
}

describe("placement landmarks", () => {
  it("builds 19 act landmarks from the corpus", () => {
    const lm = actLandmarks(corpus);
    expect(lm).toHaveLength(NUM_ACTS);
    expect(lm[0]!.act).toBe(1);
    expect(lm[0]!.opening).toBe(1); // act 1 opens at ayah 1
    expect(lm.at(-1)!.act).toBe(19);
  });
});

describe("binary search converges in ≤5 probes for every boundary (property)", () => {
  it("finds the right carried boundary for all 0..19", () => {
    for (let trueCarried = 0; trueCarried <= NUM_ACTS; trueCarried++) {
      const state = runToBoundary(trueCarried);
      expect(state.done).toBe(true);
      // ⌈log2(19)⌉ = 5
      expect(state.probed.length).toBeLessThanOrEqual(5);
      expect(state.carriedThrough).toBe(trueCarried);
    }
  });
});

describe("placementResult", () => {
  it("a user carrying nothing → starts at ayah 1, nothing carried", () => {
    const state = runToBoundary(0);
    const r = placementResult(state, corpus);
    expect(r.carriedActs).toEqual([]);
    expect(r.carriedAyat).toEqual([]);
    expect(r.startAyah).toBe(1);
    expect(r.dailyPlan.remaining).toBe(corpus.meta.ayahCount);
    expect(r.probeCount).toBeLessThanOrEqual(5);
  });

  it("a user carrying through act 5 (ayat 1–18) → starts at act 6's opening (19)", () => {
    const state = runToBoundary(5);
    const r = placementResult(state, corpus);
    expect(r.carriedActs).toEqual([1, 2, 3, 4, 5]);
    // acts 1–5 cover ayat 1..18
    expect(r.carriedAyat).toContain(18);
    expect(r.carriedAyat).not.toContain(19);
    expect(r.startAyah).toBe(19); // act 6 opens at ayah 19
  });

  it("a user carrying everything → start ayah is past the surah, remaining 0", () => {
    const state = runToBoundary(NUM_ACTS);
    const r = placementResult(state, corpus);
    expect(r.carriedActs).toHaveLength(NUM_ACTS);
    expect(r.carriedAyat.length).toBe(corpus.meta.ayahCount);
    expect(r.startAyah).toBe(corpus.meta.ayahCount + 1);
    expect(r.dailyPlan.remaining).toBe(0);
    expect(r.dailyPlan.etaDays).toBe(0);
  });

  it("the daily plan carries the first-week habit protocol (FR10)", () => {
    const r = placementResult(runToBoundary(3), corpus);
    expect(r.dailyPlan.habitProtocol).toEqual({ underloaded: true, secondThreadFromDay: 3 });
    expect(r.dailyPlan.ayahPerDay).toBeGreaterThanOrEqual(1);
  });
});

describe("'I don't know' is a first-class answer (= not carried)", () => {
  it("idk behaves exactly like 'no' (searches the earlier half)", () => {
    let a = initPlacement(corpus);
    let b = initPlacement(corpus);
    // Same probe act; answer idk vs no → identical resulting window.
    const pa = nextProbe(a, corpus);
    const pb = nextProbe(b, corpus);
    expect("done" in pa || "done" in pb).toBe(false);
    a = answerProbe(a, "idk");
    b = answerProbe(b, "no");
    expect({ lo: a.lo, hi: a.hi, carriedThrough: a.carriedThrough }).toEqual({
      lo: b.lo,
      hi: b.hi,
      carriedThrough: b.carriedThrough,
    });
  });

  it("all-idk → carries nothing, starts at ayah 1", () => {
    let state = initPlacement(corpus);
    let guard = 0;
    while (!state.done && guard++ < 50) {
      const p = nextProbe(state, corpus);
      if ("done" in p) break;
      state = answerProbe(state, "idk");
    }
    const r = placementResult(state, corpus);
    expect(r.carriedActs).toEqual([]);
    expect(r.startAyah).toBe(1);
  });
});
