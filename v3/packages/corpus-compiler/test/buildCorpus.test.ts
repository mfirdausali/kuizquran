// Synthetic ASCII fixtures only — never Quranic Arabic (v3/INVARIANTS.md
// Absolute B). `text_uthmani` values below are placeholder tokens ("w1-1",
// "w1-2", ...), never real script; buildCorpus() and normalize.ts treat them
// opaquely for the purposes exercised here (surah-stamping, word/verse counts,
// missing-input degradation), which is all these tests check.

import { describe, expect, it } from "vitest";
import { buildCorpus } from "../src/buildCorpus.ts";
import type { RawVerse } from "../src/types.ts";

function fixtureVerses(ayahCount: number, wordsPerAyah: number): RawVerse[] {
  const out: RawVerse[] = [];
  for (let ayah = 1; ayah <= ayahCount; ayah++) {
    const words = [];
    for (let position = 1; position <= wordsPerAyah; position++) {
      words.push({
        position,
        text_uthmani: `placeholder-${ayah}-${position}`,
        translation: `gloss-${ayah}-${position}`,
      });
    }
    out.push({ verse_number: ayah, text_uthmani: `placeholder-verse-${ayah}`, words });
  }
  return out;
}

describe("buildCorpus — surah-parameterized (build-plan step 3)", () => {
  it("stamps every row with the given surah (E-01)", () => {
    const corpus = buildCorpus({
      surah: 103,
      verses: fixtureVerses(3, 2),
      mcqItems: [],
      morph: new Map(),
      generatedFrom: ["fixture"],
    });
    expect(corpus.meta.surah).toBe(103);
    expect(corpus.verses.every((v) => v.surah === 103)).toBe(true);
    expect(corpus.words.every((w) => w.surah === 103)).toBe(true);
    expect(corpus.connections.every((c) => c.surah === 103)).toBe(true);
  });

  it("degrades gracefully with no authored mcqItems: zero distractors, flagged honestly", () => {
    const corpus = buildCorpus({
      surah: 112,
      verses: fixtureVerses(4, 3),
      mcqItems: [],
      morph: new Map(),
      generatedFrom: ["fixture"],
    });
    expect(corpus.distractors).toEqual([]);
    expect(corpus.meta.distractorsAuthored).toBe(false);
  });

  it("degrades gracefully with no mentalModel: zero scene beats, flagged honestly", () => {
    const corpus = buildCorpus({
      surah: 112,
      verses: fixtureVerses(4, 3),
      mcqItems: [],
      morph: new Map(),
      generatedFrom: ["fixture"],
    });
    expect(corpus.sceneBeats).toEqual([]);
    expect(corpus.meta.hasMentalModel).toBe(false);
    // and every word's act/sceneImage is null, never fabricated
    expect(corpus.words.every((w) => w.act === null && w.sceneImage === null)).toBe(true);
  });

  it("word count matches the verse source exactly", () => {
    const corpus = buildCorpus({
      surah: 12,
      verses: fixtureVerses(5, 4),
      mcqItems: [],
      morph: new Map(),
      generatedFrom: ["fixture"],
    });
    expect(corpus.words).toHaveLength(20);
    expect(corpus.meta.wordCount).toBe(20);
    expect(corpus.verses).toHaveLength(5);
  });

  it("connections = ayahCount - 1, matching v3/INVARIANTS.md's atom-count bound", () => {
    const corpus = buildCorpus({
      surah: 12,
      verses: fixtureVerses(10, 1),
      mcqItems: [],
      morph: new Map(),
      generatedFrom: ["fixture"],
    });
    expect(corpus.connections).toHaveLength(9);
  });

  it("a self-collision distractor is dropped, not silently kept", () => {
    const verses = fixtureVerses(1, 1);
    const corpus = buildCorpus({
      surah: 12,
      verses,
      mcqItems: [
        {
          verse: 1,
          position: 1,
          word: "placeholder-1-1",
          translation: "gloss-1-1",
          clozeStem: "___",
          correct: "placeholder-1-1",
          distractors: [
            { text: "placeholder-1-1", type: "visual", why: "self-collision fixture" },
            { text: "distractor-b", type: "semantic", why: "fixture" },
          ],
        },
      ],
      morph: new Map(),
      generatedFrom: ["fixture"],
    });
    expect(corpus.distractors).toHaveLength(1);
    expect(corpus.distractors[0]!.text).toBe("distractor-b");
    expect(corpus.meta.droppedCollisions).toEqual([{ ayah: 1, position: 1 }]);
    expect(corpus.meta.distractorsAuthored).toBe(true);
  });
});
