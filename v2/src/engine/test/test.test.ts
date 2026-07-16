import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  carriedAyat,
  vocabItem,
  clozeItem,
  produceItem,
  junctionTestItem,
  locateItem,
  reorderItem,
  isCorrectChoice,
  isCorrectLocate,
  isCorrectReorder,
  testHistory,
} from "../src/test.ts";
import { initAtom, type AtomState } from "../src/atom.ts";
import { rebuild } from "../src/rebuild.ts";
import type { Corpus, DrillEvent } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../public/corpus/12.json"), "utf8"),
) as Corpus;

const SURAH = 12;

describe("carriedAyat (v2-D15 smart default range)", () => {
  it("returns only ayat at or above the carry band, sorted", () => {
    const carried: AtomState = { ...initAtom("ayah", 5), strength: 85, stability: 10 };
    const reinforce: AtomState = { ...initAtom("ayah", 3), strength: 60, stability: 5 };
    const alsoCarried: AtomState = { ...initAtom("ayah", 2), strength: 90, stability: 12 };
    expect(carriedAyat([carried, reinforce, alsoCarried], Date.now())).toEqual([2, 5]);
  });

  it("empty when nothing is carried yet", () => {
    expect(carriedAyat([initAtom("ayah", 1)], Date.now())).toEqual([]);
  });
});

describe("Test item generators reuse the same engine generators as Learn (invariant #6)", () => {
  it("vocab item — a meaning MCQ for the ayah's first word", () => {
    const item = vocabItem(corpus, SURAH, 4);
    expect(item.kind).toBe("vocab");
    expect(item.options).toContain(item.correct);
    expect(isCorrectChoice(item, item.correct)).toBe(true);
    expect(isCorrectChoice(item, "not-the-answer")).toBe(false);
  });

  it("cloze item — an Arabic-form MCQ for the ayah's middle word", () => {
    const item = clozeItem(corpus, 4);
    expect(item.kind).toBe("cloze");
    expect(item.options).toContain(item.correct);
    expect(isCorrectChoice(item, item.correct)).toBe(true);
  });

  it("produce item — just names the ayah; the UI drives a full reconstruct pass", () => {
    expect(produceItem(4)).toEqual({ kind: "produce", ayah: 4 });
  });

  it("junction item — reuses chain.ts's junctionItem verbatim", () => {
    const item = junctionTestItem(corpus, 4);
    expect(item.from).toBe(4);
    expect(item.to).toBe(5);
    expect(item.options).toContain(item.correct);
  });

  it("locate item — the correct ayah number plus distractors drawn from the pool", () => {
    const item = locateItem(corpus, 4, [1, 2, 3, 4, 5, 6]);
    expect(item.options).toContain(4);
    expect(item.options.length).toBeLessThanOrEqual(4);
    expect(isCorrectLocate(item, 4)).toBe(true);
    expect(isCorrectLocate(item, 5)).toBe(false);
  });

  it("reorder item — a consecutive run in correct reading order", () => {
    const item = reorderItem(4, 3);
    expect(item.ayahs).toEqual([4, 5, 6]);
    expect(isCorrectReorder(item, [4, 5, 6])).toBe(true);
    expect(isCorrectReorder(item, [4, 6, 5])).toBe(false);
    expect(isCorrectReorder(item, [4, 5])).toBe(false); // partial attempt, no partial credit
  });
});

describe("Test is a read-only mirror (v2-D14): test_* events never move strength", () => {
  it("rebuild() ignores test_start/test_answer/test_result entirely", () => {
    const before = rebuild([
      { type: "rung_complete", ts: 1000, surah: SURAH, ayah: 4, rung: "S3" },
      { type: "ayah_complete", ts: 1001, surah: SURAH, ayah: 4, rung: "S3" },
    ] as DrillEvent[]);

    const after = rebuild([
      { type: "rung_complete", ts: 1000, surah: SURAH, ayah: 4, rung: "S3" },
      { type: "ayah_complete", ts: 1001, surah: SURAH, ayah: 4, rung: "S3" },
      { type: "test_start", ts: 2000, surah: SURAH, ayah: 1, to: 10, rung: "S1", structured: false },
      { type: "test_answer", ts: 2001, surah: SURAH, ayah: 4, rung: "S1", testKind: "vocab", correct: false, structured: false },
      { type: "test_result", ts: 2500, surah: SURAH, ayah: 1, to: 10, rung: "S1", score: 0.4, total: 5, structured: false },
    ] as DrillEvent[]);

    expect(after).toEqual(before);
  });
});

describe("testHistory (v2-D17 Progress Report)", () => {
  it("reads test_result events off the log, in order", () => {
    const events: DrillEvent[] = [
      { type: "test_result", ts: 1000, surah: SURAH, ayah: 1, to: 10, rung: "S1", score: 0.8, total: 5, structured: false },
      { type: "test_result", ts: 2000, surah: SURAH, ayah: 5, to: 20, rung: "S1", score: 1, total: 8, structured: false, sentToReviews: true },
    ];
    expect(testHistory(events)).toEqual([
      { ts: 1000, from: 1, to: 10, score: 0.8, total: 5, sentToReviews: false },
      { ts: 2000, from: 5, to: 20, score: 1, total: 8, sentToReviews: true },
    ]);
  });

  it("ignores everything that isn't a scored test_result", () => {
    const events: DrillEvent[] = [
      { type: "test_start", ts: 500, surah: SURAH, ayah: 1, to: 10, rung: "S1", structured: false },
      { type: "tap", ts: 600, surah: SURAH, ayah: 4, rung: "S1", correct: true },
    ];
    expect(testHistory(events)).toEqual([]);
  });
});
