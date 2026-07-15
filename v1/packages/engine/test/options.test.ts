import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { options, pickOptions } from "../src/options.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../public/corpus.json"), "utf8"),
) as Corpus;

describe("options(strength) — FR2 (count, max_rank)", () => {
  it("maps the three bands", () => {
    expect(options(0)).toEqual({ count: 4, maxRank: 4 }); // Learn
    expect(options(39)).toEqual({ count: 4, maxRank: 4 });
    expect(options(40)).toEqual({ count: 3, maxRank: 3 }); // Reinforce
    expect(options(79)).toEqual({ count: 3, maxRank: 3 });
    expect(options(80)).toEqual({ count: 2, maxRank: 2 }); // Carry
    expect(options(100)).toEqual({ count: 2, maxRank: 2 });
  });
});

describe("pickOptions", () => {
  it("returns 4 options at Learn strength for ayah 12:4 word 2 (قَالَ)", () => {
    const p = pickOptions(corpus, 4, 2, "قَالَ", 0);
    expect(p.correct).toBe("قَالَ");
    expect(p.distractors).toHaveLength(3); // count 4 = correct + 3 distractors
    expect(p.distractors).not.toContain("قَالَ"); // never the target
  });

  it("respects maxRank at higher strength (fewer, harder options)", () => {
    const learn = pickOptions(corpus, 4, 2, "قَالَ", 0);
    const carry = pickOptions(corpus, 4, 2, "قَالَ", 80);
    expect(learn.distractors.length).toBe(3);
    expect(carry.distractors.length).toBe(1); // count 2 = correct + 1
    // Carry's single distractor is the highest-priority (rank ≤ 2) one.
    expect(learn.distractors.slice(0, 1)).toEqual(carry.distractors);
  });

  it("is deterministic (rank order, no RNG)", () => {
    const a = pickOptions(corpus, 4, 7, "رَأَيْتُ", 0);
    const b = pickOptions(corpus, 4, 7, "رَأَيْتُ", 0);
    expect(a).toEqual(b);
  });
});
