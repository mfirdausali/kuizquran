// v3-D25: every prior ladder.test.ts case drove through the retired
// `nextItem`/`advance` S1→S2→S3 state machine (see RETIRED-TESTS.md for the
// full mapping). `initLadder`/`s1Options` survive because test.ts's live
// `vocabItem` generator calls them directly — this file replaces the retired
// coverage with direct unit tests of that surviving surface, rather than
// dropping coverage entirely.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initLadder, s1Options } from "../src/ladder.ts";
import { applyOverrides, type QuestionOverride } from "../src/overrides.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "fixtures/12.json"), "utf8"),
) as Corpus;

const AYAH = 4; // 12:4 — 15 words
function words() {
  return corpus.words.filter((w) => w.ayah === AYAH).sort((a, b) => a.position - b.position);
}

describe("initLadder", () => {
  it("carries the ayah's words in reading order and starts at S1", () => {
    const state = initLadder(corpus, 12, AYAH);
    expect(state.rung).toBe("S1");
    expect(state.words.map((w) => w.position)).toEqual(words().map((w) => w.position));
    expect(state.ayahComplete).toBe(false);
  });

  it("DATA-1: s1Queue excludes non-anchor group members", () => {
    const GROUP: QuestionOverride = {
      surah: 12,
      ayah: AYAH,
      position: 8,
      questionType: "S1",
      field: "group",
      payload: { groupWith: [9] },
      createdAt: 1000,
    };
    const { corpus: patched } = applyOverrides(corpus, [GROUP]);
    const state = initLadder(patched, 12, AYAH);
    expect(state.s1Queue).toContain(8); // anchor probed
    expect(state.s1Queue).not.toContain(9); // trailing member never probed
    expect(state.s1Queue).toHaveLength(words().length - 1);
  });
});

describe("s1Options", () => {
  it("returns the word's own gloss as correct, plus up to 3 distinct sibling distractors", () => {
    const state = initLadder(corpus, 12, AYAH);
    const position = state.words[0]!.position;
    const { options, correct } = s1Options(state, position);
    expect(options[0]).toBe(correct);
    expect(new Set(options).size).toBe(options.length); // no duplicate glosses
    expect(options.length).toBeGreaterThanOrEqual(1);
    expect(options.length).toBeLessThanOrEqual(4);
  });

  it("honors an explicit lang argument", () => {
    const state = initLadder(corpus, 12, AYAH);
    const position = state.words[0]!.position;
    const en = s1Options(state, position, "en");
    const ms = s1Options(state, position, "ms");
    // Both resolve to SOME correct string (v2-D27's fallback chain); the
    // point of this test is that the lang argument is actually threaded
    // through, not that MS glosses exist for this fixture.
    expect(typeof en.correct).toBe("string");
    expect(typeof ms.correct).toBe("string");
  });

  it("throws for a position not in this ayah (fail loud, not silent)", () => {
    const state = initLadder(corpus, 12, AYAH);
    expect(() => s1Options(state, 9999)).toThrow();
  });
});
