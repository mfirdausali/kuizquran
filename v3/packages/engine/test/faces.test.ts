// Build-plan step 16: WIREFRAME.md §22's "hard problem 2, solved at the
// type level," part 2. "An Arabic Face is `{ text, script: 'arabic', from
// }` with `from` MANDATORY — only constructible by a kernel that actually
// read the corpus at that coordinate. Provenance is PRODUCED, not
// claimed." `buildFace` is that one constructor — there is no other way to
// make a Face, so `resolveRef(corpus, face.from) === face.text` holds BY
// CONSTRUCTION, not by convention a future caller could violate.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFace } from "../src/faces.ts";
import { resolveRef, type CorpusRef } from "../src/corpusRef.ts";
import type { Corpus } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus: Corpus = JSON.parse(readFileSync(resolve(HERE, "fixtures/12.json"), "utf8"));

describe("buildFace — provenance produced, not claimed", () => {
  it("a word Face carries script arabic and text equal to resolveRef's own output", () => {
    const ref: CorpusRef = { kind: "word", ayah: 4, position: 1 };
    const face = buildFace(corpus, ref);
    expect(face).not.toBeNull();
    expect(face!.script).toBe("arabic");
    expect(face!.text).toBe(resolveRef(corpus, ref));
    expect(face!.from).toEqual(ref);
  });

  it("a verse Face is script arabic", () => {
    const ref: CorpusRef = { kind: "verse", ayah: 4 };
    expect(buildFace(corpus, ref)!.script).toBe("arabic");
  });

  it("a distractor Face is script arabic", () => {
    const ref: CorpusRef = { kind: "distractor", ayah: 4, position: 1, rank: 1 };
    expect(buildFace(corpus, ref)!.script).toBe("arabic");
  });

  it("a gloss Face is script latin (English/Malay prompt text, never rendered as Arabic)", () => {
    const ref: CorpusRef = { kind: "gloss", ayah: 4, position: 1, lang: "en" };
    expect(buildFace(corpus, ref)!.script).toBe("latin");
  });

  it("returns null (never a Face with fabricated text) when the coordinate does not resolve", () => {
    const ref: CorpusRef = { kind: "word", ayah: 4, position: 9999 };
    expect(buildFace(corpus, ref)).toBeNull();
  });

  it("an ayahNumber ref never produces a Face (it is a number, not text — no script applies)", () => {
    expect(buildFace(corpus, { kind: "ayahNumber", ayah: 4 })).toBeNull();
  });

  it("full-corpus sweep: resolveRef(corpus, face.from) === face.text holds for every ayah/position (the exact test WIREFRAME.md names)", () => {
    for (const w of corpus.words) {
      const ref: CorpusRef = { kind: "word", ayah: w.ayah, position: w.position };
      const face = buildFace(corpus, ref)!;
      expect(resolveRef(corpus, face.from)).toBe(face.text);
    }
  });
});
