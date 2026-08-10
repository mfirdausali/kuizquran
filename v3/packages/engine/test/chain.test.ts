// v3-D25: chain.ts's `applyChain`/`applyVictoryLapChain`/`applyWeakSeamChain`/
// `chainSteps`/`riskiestJunctions`/`weakSeamChainRange`/`junctionOutcome` were
// never wired into any shipped v2 screen (grep-verified: zero references
// outside engine/src and engine/test themselves) — atticked. `junctionItem`
// alone survives: it's called directly by test.ts's live junction generator.
// See RETIRED-TESTS.md for the full mapping of every test retired from this
// file.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { junctionItem } from "../src/chain.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "fixtures/12.json"), "utf8"),
) as Corpus;

describe("junctionItem", () => {
  it("correct = the opening of the target ayah; options are distinct openings", () => {
    const j = junctionItem(corpus, 4, 5);
    const opening5 = corpus.words.find((w) => w.ayah === 5 && w.position === 1)!.text_uthmani;
    expect(j.correct).toBe(opening5);
    expect(j.options).toContain(j.correct);
    expect(new Set(j.options).size).toBe(j.options.length);
  });
});
