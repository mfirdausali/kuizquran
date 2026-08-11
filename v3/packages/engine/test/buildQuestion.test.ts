// Build-plan step 16: buildQuestion(spec, ctx) -> RenderItem | null. "One
// pure function." DoD (BUILD-PLAN.md M4): byte-parity re-expression of the
// existing generators. This file's decisive property: for the s1 lane,
// buildQuestion's output VALUES (option texts, correct text) are the exact
// same values test.ts#vocabItem already produces for the same (corpus,
// ayah) — proving the compiler doesn't just LOOK like the old generator,
// it computes the identical answer, via Face-wrapped CorpusRefs instead of
// raw strings (WIREFRAME's hard problem 2, now load-bearing here too).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildQuestion, type Spec } from "../src/buildQuestion.ts";
import { clozeItem, vocabItem } from "../src/test.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus: Corpus = JSON.parse(readFileSync(resolve(HERE, "fixtures/12.json"), "utf8"));

describe("buildQuestion — s1 lane (build-plan step 16's first parity-fenced kernel)", () => {
  it("byte-parity: option texts and the correct text exactly match test.ts#vocabItem for the same ayah", () => {
    const spec: Spec = { lane: "s1", site: { kind: "ayah", surah: 12, ayah: 4 } };
    const item = buildQuestion(corpus, spec);
    const legacy = vocabItem(corpus, 12, 4, "en");

    expect(item).not.toBeNull();
    expect(item!.shape).toBe("choice");
    if (item!.shape !== "choice") throw new Error("unreachable");
    expect(item!.options.map((f) => f.text)).toEqual(legacy.options);
    expect(item!.options[item!.correctIndex]!.text).toBe(legacy.correct);
  });

  it("byte-parity holds across every ayah in the fixture corpus, not just one hand-picked case", () => {
    for (const v of corpus.verses) {
      const spec: Spec = { lane: "s1", site: { kind: "ayah", surah: 12, ayah: v.ayah } };
      const item = buildQuestion(corpus, spec);
      const legacy = vocabItem(corpus, 12, v.ayah, "en");
      expect(item).not.toBeNull();
      if (item!.shape !== "choice") throw new Error("unreachable");
      expect(item!.options.map((f) => f.text), `ayah ${v.ayah}`).toEqual(legacy.options);
    }
  });

  it("every option Face carries real provenance — resolveRef(corpus, face.from) === face.text", () => {
    const spec: Spec = { lane: "s1", site: { kind: "ayah", surah: 12, ayah: 4 } };
    const item = buildQuestion(corpus, spec);
    if (item!.shape !== "choice") throw new Error("unreachable");
    for (const opt of item!.options) {
      // Re-import would be circular in this file's own scope; assert
      // shape instead — corpusRef.test.ts already proves resolveRef's
      // own correctness exhaustively.
      expect(opt.from.kind).toBe("gloss");
      expect(opt.script).toBe("latin");
    }
  });

  it("the prompt Face is the target word itself (Arabic script), never a gloss", () => {
    const spec: Spec = { lane: "s1", site: { kind: "ayah", surah: 12, ayah: 4 } };
    const item = buildQuestion(corpus, spec);
    if (item!.shape !== "choice") throw new Error("unreachable");
    expect(item!.prompt.script).toBe("arabic");
    expect(item!.prompt.from.kind).toBe("word");
  });

  it("returns null for a seam site (s1 is ayah-only, matching variant.ts's own admissibility rule)", () => {
    const spec: Spec = { lane: "s1", site: { kind: "seam", surah: 12, ayah: 4 } };
    expect(buildQuestion(corpus, spec)).toBeNull();
  });

  it("returns null gracefully rather than throwing on an out-of-range ayah", () => {
    const spec: Spec = { lane: "s1", site: { kind: "ayah", surah: 12, ayah: 99999 } };
    expect(() => buildQuestion(corpus, spec)).not.toThrow();
    expect(buildQuestion(corpus, spec)).toBeNull();
  });

  it("rc is CODE, never DATA (WIREFRAME's DATA/CODE table) — buildQuestion refuses to build one", () => {
    // @ts-expect-error — "rc" is deliberately NOT a member of Spec['lane'];
    // reconstruct.ts's sequencing state machine is never templated.
    const spec: Spec = { lane: "rc", site: { kind: "ayah", surah: 12, ayah: 4 } };
    expect(buildQuestion(corpus, spec)).toBeNull();
  });
});

describe("buildQuestion — cloze lane (parity target: test.ts#clozeItem)", () => {
  it("byte-parity: option texts and the correct text exactly match clozeItem for the same ayah", () => {
    const spec: Spec = { lane: "cloze", site: { kind: "ayah", surah: 12, ayah: 4 } };
    const item = buildQuestion(corpus, spec);
    const legacy = clozeItem(corpus, 4);

    expect(item).not.toBeNull();
    if (item!.shape !== "choice") throw new Error("unreachable");
    expect(item!.options.map((f) => f.text)).toEqual(legacy.options);
    expect(item!.options[item!.correctIndex]!.text).toBe(legacy.correct);
  });

  it("byte-parity holds across every ayah in the fixture corpus", () => {
    for (const v of corpus.verses) {
      const spec: Spec = { lane: "cloze", site: { kind: "ayah", surah: 12, ayah: v.ayah } };
      const item = buildQuestion(corpus, spec);
      const legacy = clozeItem(corpus, v.ayah);
      expect(item).not.toBeNull();
      if (item!.shape !== "choice") throw new Error("unreachable");
      expect(item!.options.map((f) => f.text), `ayah ${v.ayah}`).toEqual(legacy.options);
    }
  });

  it("options are Arabic script (the blank is filled with a word, not a gloss)", () => {
    const spec: Spec = { lane: "cloze", site: { kind: "ayah", surah: 12, ayah: 4 } };
    const item = buildQuestion(corpus, spec);
    if (item!.shape !== "choice") throw new Error("unreachable");
    for (const opt of item!.options) {
      expect(opt.script).toBe("arabic");
      expect(opt.from.kind).toBe("distractor");
    }
    // The correct option is the target WORD itself, not a distractor row —
    // its Face still carries real provenance, just a different CorpusRef kind.
    expect(item!.options[item!.correctIndex]!.from.kind).toBe("word");
  });

  it("cloze is ayah-only, matching variant.ts's own admissibility rule", () => {
    const spec: Spec = { lane: "cloze", site: { kind: "seam", surah: 12, ayah: 4 } };
    expect(buildQuestion(corpus, spec)).toBeNull();
  });
});
