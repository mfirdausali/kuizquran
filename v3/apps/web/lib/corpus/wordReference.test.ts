import { describe, expect, it } from "vitest";
import type { CorpusWord } from "@engine/types.ts";
import { mushafLineLabel } from "./wordReference.ts";

/** A minimal CorpusWord — only the fields this function reads matter. */
function wordWith(line: CorpusWord["line"]): CorpusWord {
  return {
    ayah: 1,
    position: 1,
    text_uthmani: "irrelevant",
    lemma: null,
    root: null,
    class: null,
    gloss: { en: "irrelevant", ms: null, ja: null },
    act: null,
    sceneImage: null,
    line,
  };
}

describe("mushafLineLabel", () => {
  it("labels a real, geometry-derived line number — the common case for every launch surah", () => {
    // 3 is a real value this build's own vendored geometry produces (see
    // apps/web/public/corpus/112.json's own first word) — not an invented
    // placeholder shape.
    expect(mushafLineLabel(wordWith(3))).toBe("line 3");
  });

  it("returns null for a surah with no vendored geometry yet (CorpusWord.line is null)", () => {
    expect(mushafLineLabel(wordWith(null))).toBeNull();
  });

  it("returns null for an older corpus subset that predates the field entirely (undefined)", () => {
    // Simulates a shape that never carried `line` at all — the fixture case,
    // not merely a null value.
    const word = wordWith(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (word as any).line;
    expect(mushafLineLabel(word)).toBeNull();
  });

  it("never fabricates a line for 0 — 0 is falsy but a genuine mushaf line never exists at index 0, so this pins the typeof check rather than a truthiness check", () => {
    // Mushaf lines are 1-indexed in the vendored geometry, so this case is
    // defensive: it proves the function checks `typeof === "number"`, not
    // `if (word.line)`, which would (wrongly, if it ever occurred) treat a
    // real 0 as absent.
    expect(mushafLineLabel(wordWith(0))).toBe("line 0");
  });
});
