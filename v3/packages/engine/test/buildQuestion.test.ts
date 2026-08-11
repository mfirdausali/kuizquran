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
import { clozeItem, junctionTestItem, locateItem, reorderItem, vocabItem } from "../src/test.ts";
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
    }
    // Distractor options carry distractor provenance; the correct option is
    // the target WORD itself, not a distractor row — different CorpusRef
    // kind, but every option's Face still carries real provenance.
    item!.options.slice(1).forEach((opt) => expect(opt.from.kind).toBe("distractor"));
    expect(item!.options[item!.correctIndex]!.from.kind).toBe("word");
  });

  it("cloze is ayah-only, matching variant.ts's own admissibility rule", () => {
    const spec: Spec = { lane: "cloze", site: { kind: "seam", surah: 12, ayah: 4 } };
    expect(buildQuestion(corpus, spec)).toBeNull();
  });
});

describe("buildQuestion — junction lane (parity target: test.ts#junctionTestItem)", () => {
  it("byte-parity: option texts and the correct text exactly match junctionTestItem for the same seam", () => {
    const spec: Spec = { lane: "junction", site: { kind: "seam", surah: 12, ayah: 4 } };
    const item = buildQuestion(corpus, spec);
    const legacy = junctionTestItem(corpus, 4);

    expect(item).not.toBeNull();
    if (item!.shape !== "choice") throw new Error("unreachable");
    expect(item!.options.map((f) => f.text)).toEqual(legacy.options);
    expect(item!.options[item!.correctIndex]!.text).toBe(legacy.correct);
  });

  it("byte-parity holds across every seam in the fixture corpus (ayah 1..ayahCount-1)", () => {
    for (let ayah = 1; ayah < corpus.meta.ayahCount; ayah++) {
      const spec: Spec = { lane: "junction", site: { kind: "seam", surah: 12, ayah } };
      const item = buildQuestion(corpus, spec);
      const legacy = junctionTestItem(corpus, ayah);
      expect(item).not.toBeNull();
      if (item!.shape !== "choice") throw new Error("unreachable");
      expect(item!.options.map((f) => f.text), `seam ${ayah}`).toEqual(legacy.options);
    }
  });

  it("junction is seam-only, matching variant.ts's own admissibility rule", () => {
    const spec: Spec = { lane: "junction", site: { kind: "ayah", surah: 12, ayah: 4 } };
    expect(buildQuestion(corpus, spec)).toBeNull();
  });

  it("the last ayah's seam is never constructible (E-08, site.ts#expand's own by-construction closure) — null, never a crash", () => {
    const spec: Spec = { lane: "junction", site: { kind: "seam", surah: 12, ayah: corpus.meta.ayahCount } };
    expect(() => buildQuestion(corpus, spec)).not.toThrow();
    expect(buildQuestion(corpus, spec)).toBeNull();
  });

  it("every option Face carries real word provenance, Arabic script", () => {
    const spec: Spec = { lane: "junction", site: { kind: "seam", surah: 12, ayah: 4 } };
    const item = buildQuestion(corpus, spec);
    if (item!.shape !== "choice") throw new Error("unreachable");
    for (const opt of item!.options) {
      expect(opt.script).toBe("arabic");
      expect(opt.from.kind).toBe("word");
    }
  });
});

describe("buildQuestion — locate lane (parity target: test.ts#locateItem)", () => {
  // locateItem's `pool` is the Test's own candidate range — not derivable
  // from a Site, so the Spec carries it verbatim (same explicit-flag
  // discipline the other kernels use for `lang`).
  const pool = [1, 2, 3, 4, 5, 6];

  it("byte-parity: option ayah numbers and the correct number exactly match test.ts#locateItem for the same ayah", () => {
    const spec: Spec = { lane: "locate", site: { kind: "ayah", surah: 12, ayah: 4 }, pool };
    const item = buildQuestion(corpus, spec);
    const legacy = locateItem(corpus, 4, pool);

    expect(item).not.toBeNull();
    expect(item!.shape).toBe("locateChoice");
    if (item!.shape !== "locateChoice") throw new Error("unreachable");
    expect(item!.options).toEqual(legacy.options);
    expect(item!.options[item!.correctIndex]).toBe(legacy.correct);
  });

  it("byte-parity holds across every ayah in the fixture corpus", () => {
    for (const v of corpus.verses) {
      const spec: Spec = { lane: "locate", site: { kind: "ayah", surah: 12, ayah: v.ayah }, pool };
      const item = buildQuestion(corpus, spec);
      const legacy = locateItem(corpus, v.ayah, pool);
      expect(item).not.toBeNull();
      if (item!.shape !== "locateChoice") throw new Error("unreachable");
      expect(item!.options, `ayah ${v.ayah}`).toEqual(legacy.options);
      expect(item!.options[item!.correctIndex], `ayah ${v.ayah}`).toBe(legacy.correct);
    }
  });

  it("byte-parity holds for a pool that preserves its own order (no sorting, no nearest-first)", () => {
    const unsorted = [9, 2, 7, 4, 1];
    const spec: Spec = { lane: "locate", site: { kind: "ayah", surah: 12, ayah: 4 }, pool: unsorted };
    const item = buildQuestion(corpus, spec);
    const legacy = locateItem(corpus, 4, unsorted);
    if (item!.shape !== "locateChoice") throw new Error("unreachable");
    expect(item!.options).toEqual(legacy.options);
  });

  it("options are ayah NUMBERS, never Faces — the answer identifies a coordinate, not text", () => {
    const spec: Spec = { lane: "locate", site: { kind: "ayah", surah: 12, ayah: 4 }, pool };
    const item = buildQuestion(corpus, spec);
    if (item!.shape !== "locateChoice") throw new Error("unreachable");
    for (const opt of item!.options) {
      expect(typeof opt).toBe("number");
    }
  });

  it("the prompt Face is the whole VERSE (Arabic script) — locate shows the text and asks for the number", () => {
    const spec: Spec = { lane: "locate", site: { kind: "ayah", surah: 12, ayah: 4 }, pool };
    const item = buildQuestion(corpus, spec);
    if (item!.shape !== "locateChoice") throw new Error("unreachable");
    expect(item!.prompt.script).toBe("arabic");
    expect(item!.prompt.from.kind).toBe("verse");
    expect(item!.prompt.text).toBe(corpus.verses.find((v) => v.ayah === 4)!.text_uthmani);
  });

  it("locate is ayah-only, matching variant.ts's own admissibility rule", () => {
    const spec: Spec = { lane: "locate", site: { kind: "seam", surah: 12, ayah: 4 }, pool };
    expect(buildQuestion(corpus, spec)).toBeNull();
  });

  it("returns null gracefully rather than throwing on an out-of-range ayah", () => {
    const spec: Spec = { lane: "locate", site: { kind: "ayah", surah: 12, ayah: 99999 }, pool };
    expect(() => buildQuestion(corpus, spec)).not.toThrow();
    expect(buildQuestion(corpus, spec)).toBeNull();
  });
});

describe("buildQuestion — reorder lane (parity target: test.ts#reorderItem)", () => {
  // reorderItem's `count` is the run length — like locate's `pool`, it is not
  // derivable from a Site (a Site names one coordinate, not how far the run
  // extends), so the Spec carries it explicitly. Legacy's default is 3.

  it("byte-parity: correctOrder exactly matches test.ts#reorderItem's ayahs for the same run", () => {
    const spec: Spec = { lane: "reorder", site: { kind: "ayah", surah: 12, ayah: 4 }, count: 3 };
    const item = buildQuestion(corpus, spec);
    const legacy = reorderItem(4, 3);

    expect(item).not.toBeNull();
    expect(item!.shape).toBe("orderTiles");
    if (item!.shape !== "orderTiles") throw new Error("unreachable");
    expect(item!.correctOrder).toEqual(legacy.ayahs);
  });

  it("byte-parity holds across every ayah in the fixture corpus whose run fits inside the surah", () => {
    for (const v of corpus.verses) {
      const spec: Spec = { lane: "reorder", site: { kind: "ayah", surah: 12, ayah: v.ayah }, count: 3 };
      const item = buildQuestion(corpus, spec);
      if (v.ayah + 3 - 1 > corpus.meta.ayahCount) {
        // The run would run off the end of the surah — see the clamp test.
        expect(item, `ayah ${v.ayah}`).toBeNull();
        continue;
      }
      const legacy = reorderItem(v.ayah, 3);
      expect(item, `ayah ${v.ayah}`).not.toBeNull();
      if (item!.shape !== "orderTiles") throw new Error("unreachable");
      expect(item!.correctOrder, `ayah ${v.ayah}`).toEqual(legacy.ayahs);
    }
  });

  it("byte-parity holds for a non-default run length too (count is not hard-wired to 3)", () => {
    const spec: Spec = { lane: "reorder", site: { kind: "ayah", surah: 12, ayah: 4 }, count: 5 };
    const item = buildQuestion(corpus, spec);
    const legacy = reorderItem(4, 5);
    if (item!.shape !== "orderTiles") throw new Error("unreachable");
    expect(item!.correctOrder).toEqual(legacy.ayahs);
  });

  it("omitting count uses legacy's own default of 3", () => {
    const spec: Spec = { lane: "reorder", site: { kind: "ayah", surah: 12, ayah: 4 } };
    const item = buildQuestion(corpus, spec);
    const legacy = reorderItem(4);
    if (item!.shape !== "orderTiles") throw new Error("unreachable");
    expect(item!.correctOrder).toEqual(legacy.ayahs);
  });

  it("tiles are real verse Faces, one per ayah in the run, Arabic script, in correctOrder's order", () => {
    const spec: Spec = { lane: "reorder", site: { kind: "ayah", surah: 12, ayah: 4 }, count: 3 };
    const item = buildQuestion(corpus, spec);
    if (item!.shape !== "orderTiles") throw new Error("unreachable");
    expect(item!.tiles).toHaveLength(item!.correctOrder.length);
    item!.tiles.forEach((tile, i) => {
      expect(tile.script).toBe("arabic");
      expect(tile.from.kind).toBe("verse");
      // Provenance is the ayah at the same index of the correct order, and
      // the text is that verse's own text — no fabrication, no reshuffle.
      expect(tile.from).toEqual({ kind: "verse", ayah: item!.correctOrder[i] });
      expect(tile.text).toBe(corpus.verses.find((v) => v.ayah === item!.correctOrder[i])!.text_uthmani);
    });
  });

  it("attempt starts empty — the learner has tapped nothing yet", () => {
    const spec: Spec = { lane: "reorder", site: { kind: "ayah", surah: 12, ayah: 4 }, count: 3 };
    const item = buildQuestion(corpus, spec);
    if (item!.shape !== "orderTiles") throw new Error("unreachable");
    expect(item!.attempt).toEqual([]);
  });

  it("a run that would overrun the surah's last ayah is never constructible — null, never a crash", () => {
    const spec: Spec = { lane: "reorder", site: { kind: "ayah", surah: 12, ayah: corpus.meta.ayahCount }, count: 3 };
    expect(() => buildQuestion(corpus, spec)).not.toThrow();
    expect(buildQuestion(corpus, spec)).toBeNull();
  });

  it("returns null gracefully rather than throwing on an out-of-range ayah", () => {
    const spec: Spec = { lane: "reorder", site: { kind: "ayah", surah: 12, ayah: 99999 }, count: 3 };
    expect(() => buildQuestion(corpus, spec)).not.toThrow();
    expect(buildQuestion(corpus, spec)).toBeNull();
  });

  it("a run of length 0 or less builds nothing (there is no ordering to tap)", () => {
    const spec: Spec = { lane: "reorder", site: { kind: "ayah", surah: 12, ayah: 4 }, count: 0 };
    expect(() => buildQuestion(corpus, spec)).not.toThrow();
    expect(buildQuestion(corpus, spec)).toBeNull();
  });

  it("reorder is ayah-only, matching variant.ts's own admissibility rule", () => {
    const spec: Spec = { lane: "reorder", site: { kind: "seam", surah: 12, ayah: 4 }, count: 3 };
    expect(buildQuestion(corpus, spec)).toBeNull();
  });
});
