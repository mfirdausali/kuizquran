import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { computeStreak, completedDayIndices } from "../src/streak.ts";
import { floorQueue, floorMinutes } from "../src/floor.ts";
import { decaySince, sinceLabel } from "../src/decay.ts";
import { ayahHeatmap, wordDiagnostics, growthCurve } from "../src/heatmap.ts";
import { initAtom, atomKey, type AtomState } from "../src/atom.ts";
import { scheduleGate } from "../src/gate.ts";
import { learningDayIndex, DEFAULT_DAY_CONFIG } from "../src/daybound.ts";
import type { Corpus, DrillEvent } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../public/corpus/12.json"), "utf8"),
) as Corpus;
const DAY = 86_400_000;
function dayMs(index: number): number {
  return index * DAY + 12 * 3600_000; // noon of that learning-day-ish
}

describe("streak (FR9: pauses on miss, make-up repairs, never zeroes)", () => {
  const cfg = DEFAULT_DAY_CONFIG;
  it("counts consecutive active days ending today", () => {
    const today = learningDayIndex(Date.now(), cfg);
    const s = computeStreak([today, today - 1, today - 2], Date.now(), cfg);
    expect(s.length).toBe(3);
    expect(s.pausedOnMiss).toBe(false);
  });
  it("at-risk when yesterday active but today not yet", () => {
    const now = dayMs(1000);
    const today = learningDayIndex(now, cfg);
    const s = computeStreak([today - 1, today - 2], now, cfg);
    expect(s.atRisk).toBe(true);
    expect(s.length).toBe(2);
  });
  it("pauses (not zeroes) on a missed day; make-up available for a single miss", () => {
    const now = dayMs(1000);
    const today = learningDayIndex(now, cfg);
    // last active 2 days ago (yesterday missed)
    const s = computeStreak([today - 2, today - 3], now, cfg);
    expect(s.pausedOnMiss).toBe(true);
    expect(s.makeupAvailable).toBe(true);
    expect(s.length).toBe(2); // streak preserved, not zeroed
  });
  it("empty history → zero, nothing at risk", () => {
    const s = computeStreak([], Date.now(), cfg);
    expect(s).toMatchObject({ length: 0, atRisk: false, pausedOnMiss: false });
  });
});

describe("completedDayIndices (v2-D17 streak calendar)", () => {
  const cfg = DEFAULT_DAY_CONFIG;
  it("marks a day active on ayah_complete/rung_complete(S3)/gate_result", () => {
    const events: DrillEvent[] = [
      { type: "rung_complete", ts: dayMs(10), surah: 12, ayah: 4, rung: "S3" },
      { type: "ayah_complete", ts: dayMs(10) + 1000, surah: 12, ayah: 4, rung: "S3" },
      { type: "gate_result", ts: dayMs(11), surah: 12, ayah: 4, rung: "S3", correct: true },
    ];
    expect(completedDayIndices(events, cfg)).toEqual([learningDayIndex(dayMs(10), cfg), learningDayIndex(dayMs(11), cfg)]);
  });
  it("bare taps don't count on their own", () => {
    const events: DrillEvent[] = [{ type: "tap", ts: dayMs(10), surah: 12, ayah: 4, rung: "S1", correct: true }];
    expect(completedDayIndices(events, cfg)).toEqual([]);
  });
  it("a victory-lap chain step (structured:false) still counts — v2-D11", () => {
    const events: DrillEvent[] = [
      { type: "chain_step", ts: dayMs(10), surah: 12, ayah: 4, rung: "S1", correct: true, structured: false },
    ];
    expect(completedDayIndices(events, cfg)).toEqual([learningDayIndex(dayMs(10), cfg)]);
  });
  it("a Test still counts as showing up — v2-D14", () => {
    const events: DrillEvent[] = [
      { type: "test_start", ts: dayMs(10), surah: 12, ayah: 1, to: 10, rung: "S1", structured: false },
    ];
    expect(completedDayIndices(events, cfg)).toEqual([learningDayIndex(dayMs(10), cfg)]);
  });
});

describe("floor session (≤2 min, never empty)", () => {
  function enc(ref: number, extra: Partial<AtomState> = {}): AtomState {
    return { ...initAtom("ayah", ref), encoded: true, gatePassed: true, strength: 60, stability: 3, lastRetrieval: dayMs(995), ...extra };
  }
  it("prioritises a due cold gate", () => {
    const gated = scheduleGate({ ...initAtom("ayah", 4), encoded: true }, dayMs(999), undefined);
    const q = floorQueue([gated], dayMs(1001));
    expect(q[0]!.kind).toBe("gate");
    expect(floorMinutes(q)).toBeLessThanOrEqual(2.01);
  });
  it("falls back to the riskiest due review, capped at 2 min", () => {
    const q = floorQueue([enc(4, { lastRetrieval: dayMs(990) }), enc(5, { lastRetrieval: dayMs(991) })], dayMs(1001));
    expect(q.length).toBeGreaterThan(0);
    expect(floorMinutes(q)).toBeLessThanOrEqual(2.01);
  });
  it("NEVER empty: a warm-up when nothing is due", () => {
    const fresh = enc(4, { lastRetrieval: dayMs(1001), stability: 999 }); // basically no risk
    const q = floorQueue([fresh], dayMs(1001));
    expect(q.length).toBe(1);
    expect(q[0]!.kind).toBe("warmup");
  });
});

describe("decay visible (FR9)", () => {
  it("shows now vs a past strength with a plain label", () => {
    const atom = { ...initAtom("ayah", 4), encoded: true, strength: 90, stability: 5, lastRetrieval: dayMs(1000) };
    const d = decaySince(atom, dayMs(1000), dayMs(1005), DEFAULT_DAY_CONFIG);
    expect(d.nowPct).toBeLessThan(d.sincePct); // decayed
    expect(d.declined).toBe(true);
    expect(typeof d.sinceLabel).toBe("string");
  });
  it("labels recent days plainly", () => {
    const now = dayMs(1000);
    expect(sinceLabel(now, now, DEFAULT_DAY_CONFIG)).toBe("today");
    expect(sinceLabel(dayMs(999), now, DEFAULT_DAY_CONFIG)).toBe("yesterday");
    expect(sinceLabel(dayMs(990), now, DEFAULT_DAY_CONFIG)).toBe("10 days ago");
  });
});

describe("mushaf heatmap (FR9 P1)", () => {
  it("111 rows, encoded atoms lit, others zero", () => {
    const atoms = new Map<string, AtomState>();
    atoms.set(atomKey("ayah", 4), { ...initAtom("ayah", 4), encoded: true, strength: 85, stability: 10, lastRetrieval: dayMs(1000) });
    const rows = ayahHeatmap(corpus, atoms, dayMs(1000));
    expect(rows).toHaveLength(111);
    expect(rows[3]!.ayah).toBe(4);
    expect(rows[3]!.encoded).toBe(true);
    expect(rows[3]!.strength).toBeGreaterThan(0);
    expect(rows[0]!.encoded).toBe(false); // ayah 1 not encoded
    expect(rows[0]!.strength).toBe(0);
  });
  it("word diagnostics aggregate tap accuracy, excluding pretest", () => {
    const events: DrillEvent[] = [
      { type: "tap", ts: 1, surah: 12, ayah: 4, rung: "S1", position: 1, correct: true },
      { type: "tap", ts: 2, surah: 12, ayah: 4, rung: "S1", position: 1, correct: false },
      { type: "tap", ts: 3, surah: 12, ayah: 4, rung: "S1", position: 1, correct: false, pretest: true }, // excluded
    ];
    const diag = wordDiagnostics(corpus, events, 4);
    const w1 = diag.find((d) => d.position === 1)!;
    expect(w1.taps).toBe(2); // pretest excluded
    expect(w1.accuracy).toBe(0.5); // 1/2
  });
});

describe("growthCurve (v2-D17/D20 Progress Report)", () => {
  it("cumulative encoded count grows one point per learning-day with a new encode", () => {
    const events: DrillEvent[] = [
      { type: "ayah_produced", ts: dayMs(10), surah: 12, ayah: 4, rung: "S3", structured: true },
      { type: "ayah_produced", ts: dayMs(10) + 500, surah: 12, ayah: 5, rung: "S3", structured: true }, // same day
      { type: "rung_complete", ts: dayMs(12), surah: 12, ayah: 6, rung: "S3" }, // legacy S3 completion
    ];
    const curve = growthCurve(events);
    expect(curve).toEqual([
      { day: learningDayIndex(dayMs(10)), cumulativeEncoded: 2 },
      { day: learningDayIndex(dayMs(12)), cumulativeEncoded: 3 },
    ]);
  });

  it("each ayah counts once, at its FIRST encode — a re-encode after a demote doesn't double-count", () => {
    const events: DrillEvent[] = [
      { type: "ayah_produced", ts: dayMs(10), surah: 12, ayah: 4, rung: "S3", structured: true },
      { type: "ayah_produced", ts: dayMs(20), surah: 12, ayah: 4, rung: "S3", structured: true }, // re-encoded later
    ];
    expect(growthCurve(events)).toEqual([{ day: learningDayIndex(dayMs(10)), cumulativeEncoded: 1 }]);
  });

  it("free-play (structured:false) production never counts as encoding — invariant #5", () => {
    const events: DrillEvent[] = [
      { type: "ayah_produced", ts: dayMs(10), surah: 12, ayah: 4, rung: "S3", structured: false },
    ];
    expect(growthCurve(events)).toEqual([]);
  });

  it("empty log → empty curve", () => {
    expect(growthCurve([])).toEqual([]);
  });
});
