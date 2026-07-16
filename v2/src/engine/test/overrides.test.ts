import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { applyOverrides, isQuestionDisabled, type QuestionOverride } from "../src/overrides.ts";
import { wordGloss, distractorsFor } from "../src/corpus.ts";
import { pickOptions } from "../src/options.ts";
import { s1Options, initLadder } from "../src/ladder.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../public/corpus/12.json"), "utf8"),
) as Corpus;

function override(partial: Partial<QuestionOverride> & Pick<QuestionOverride, "ayah" | "field" | "payload">): QuestionOverride {
  return {
    surah: 12,
    position: null,
    questionType: "S1",
    createdAt: 1000,
    ...partial,
  };
}

describe("applyOverrides — gloss", () => {
  it("patches the target word's gloss without touching anything else", () => {
    const word = corpus.words.find((w) => w.ayah === 4 && w.position === 2)!;
    expect(wordGloss(word, "en")).toBe("said"); // pre-override baseline

    const ov = override({
      ayah: 4,
      position: 2,
      field: "gloss",
      payload: { lang: "en", text: "spoke" },
    });
    const { corpus: patched } = applyOverrides(corpus, [ov]);
    const patchedWord = patched.words.find((w) => w.ayah === 4 && w.position === 2)!;
    expect(wordGloss(patchedWord, "en")).toBe("spoke");

    // untouched word elsewhere is unaffected, and the ORIGINAL corpus object
    // is never mutated (pure function, invariant #6).
    const sibling = patched.words.find((w) => w.ayah === 4 && w.position === 1)!;
    expect(sibling).toEqual(corpus.words.find((w) => w.ayah === 4 && w.position === 1));
    expect(word.gloss.en).toBe("said");
  });

  it("flows through s1Options — the overridden gloss becomes the correct MCQ answer", () => {
    const ov = override({ ayah: 4, position: 2, field: "gloss", payload: { lang: "en", text: "spoke" } });
    const { corpus: patched } = applyOverrides(corpus, [ov]);
    const state = initLadder(patched, 12, 4);
    const { correct } = s1Options(state, 2, "en");
    expect(correct).toBe("spoke");
  });

  it("only patches the requested language, MS stays untouched", () => {
    const ov = override({ ayah: 4, position: 2, field: "gloss", payload: { lang: "en", text: "spoke" } });
    const { corpus: patched } = applyOverrides(corpus, [ov]);
    const w = patched.words.find((x) => x.ayah === 4 && x.position === 2)!;
    expect(w.gloss.ms).toBeNull();
  });

  it("latest createdAt wins when two overrides target the same word+lang", () => {
    const first = override({ ayah: 4, position: 2, field: "gloss", payload: { lang: "en", text: "first try" }, createdAt: 1000 });
    const second = override({ ayah: 4, position: 2, field: "gloss", payload: { lang: "en", text: "corrected" }, createdAt: 2000 });
    // array order shouldn't matter — only createdAt does.
    const { corpus: a } = applyOverrides(corpus, [first, second]);
    const { corpus: b } = applyOverrides(corpus, [second, first]);
    expect(wordGloss(a.words.find((w) => w.ayah === 4 && w.position === 2)!, "en")).toBe("corrected");
    expect(wordGloss(b.words.find((w) => w.ayah === 4 && w.position === 2)!, "en")).toBe("corrected");
  });

  it("ignores a malformed gloss payload (no crash, no patch)", () => {
    const ov = override({ ayah: 4, position: 2, field: "gloss", payload: { text: "no lang" } });
    const { corpus: patched } = applyOverrides(corpus, [ov]);
    expect(wordGloss(patched.words.find((w) => w.ayah === 4 && w.position === 2)!, "en")).toBe("said");
  });

  it("ignores overrides for a different surah", () => {
    const ov = override({ surah: 2, ayah: 4, position: 2, field: "gloss", payload: { lang: "en", text: "spoke" } });
    const { corpus: patched } = applyOverrides(corpus, [ov]);
    expect(wordGloss(patched.words.find((w) => w.ayah === 4 && w.position === 2)!, "en")).toBe("said");
  });
});

describe("applyOverrides — distractor", () => {
  it("fully replaces the ranked distractor set for one (ayah, position)", () => {
    expect(distractorsFor(corpus, 4, 2)).toHaveLength(5); // pre-override baseline

    const ov = override({
      ayah: 4,
      position: 2,
      field: "distractor",
      payload: { distractors: [{ text: "custom-distractor", rank: 1, prd_rank: "synonym", src_type: "semantic", why: "qari-curated" }] },
    });
    const { corpus: patched } = applyOverrides(corpus, [ov]);
    const ds = distractorsFor(patched, 4, 2);
    expect(ds).toHaveLength(1);
    expect(ds[0]!.text).toBe("custom-distractor");
    expect(ds[0]!.ayah).toBe(4);
    expect(ds[0]!.position).toBe(2);

    // other ayat/positions untouched
    expect(distractorsFor(patched, 4, 1)).toEqual(distractorsFor(corpus, 4, 1));
  });

  it("flows through pickOptions — an overridden distractor set changes the S2/RC tile bank", () => {
    const ov = override({
      ayah: 4,
      position: 2,
      field: "distractor",
      payload: { distractors: [{ text: "custom-distractor", rank: 1, prd_rank: "synonym", src_type: "semantic", why: "qari-curated" }] },
    });
    const { corpus: patched } = applyOverrides(corpus, [ov]);
    const picked = pickOptions(patched, 4, 2, "قَالَ", 0);
    expect(picked.distractors).toEqual(["custom-distractor"]);
  });
});

describe("applyOverrides — disable", () => {
  it("lists an active disable and isQuestionDisabled matches it", () => {
    const ov = override({ ayah: 4, position: 2, questionType: "S2", field: "disable", payload: { disabled: true } });
    const { disabled } = applyOverrides(corpus, [ov]);
    expect(disabled).toEqual([{ ayah: 4, position: 2, questionType: "S2" }]);
    expect(isQuestionDisabled(disabled, 4, 2, "S2")).toBe(true);
    expect(isQuestionDisabled(disabled, 4, 3, "S2")).toBe(false); // different position
    expect(isQuestionDisabled(disabled, 4, 2, "S1")).toBe(false); // different question type
  });

  it("a later disabled:false row re-enables (latest-wins, not additive)", () => {
    const off = override({ ayah: 4, position: 2, questionType: "S2", field: "disable", payload: { disabled: true }, createdAt: 1000 });
    const on = override({ ayah: 4, position: 2, questionType: "S2", field: "disable", payload: { disabled: false }, createdAt: 2000 });
    const { disabled } = applyOverrides(corpus, [off, on]);
    expect(disabled).toEqual([]);
  });

  it("position:null disables every position of that question type on the ayah", () => {
    const ov = override({ ayah: 4, position: null, questionType: "S1", field: "disable", payload: { disabled: true } });
    const { disabled } = applyOverrides(corpus, [ov]);
    expect(isQuestionDisabled(disabled, 4, 1, "S1")).toBe(true);
    expect(isQuestionDisabled(disabled, 4, 5, "S1")).toBe(true);
    expect(isQuestionDisabled(disabled, 4, 1, "S2")).toBe(false);
  });
});

describe("applyOverrides — group/custom (stored, not generation-wired this phase)", () => {
  it("passes group and custom rows through untouched, and leaves the corpus unpatched by them", () => {
    const group = override({ ayah: 4, position: 1, field: "group", payload: { groupWith: [2, 3] } });
    const custom = override({ ayah: 4, position: null, field: "custom", payload: { prompt: "who spoke?", options: ["Yaqub", "Yusuf"], correct: "Yaqub" } });
    const { groups, customs, corpus: patched } = applyOverrides(corpus, [group, custom]);
    expect(groups).toEqual([group]);
    expect(customs).toEqual([custom]);
    expect(patched.words).toEqual(corpus.words);
    expect(patched.distractors).toEqual(corpus.distractors);
  });
});
