// Build-plan step 16 — WIREFRAME.md §22: "One pure function:
// buildQuestion(spec, ctx) -> RenderItem | null." DoD (BUILD-PLAN.md M4):
// byte-parity re-expression of the existing generators (reconstruct.ts +
// test.ts's 6 builders) under FROZEN B6 semantics. This file ships the
// FIRST parity-fenced kernel (s1 — see test/buildQuestion.test.ts's
// full-corpus sweep against test.ts#vocabItem); cloze/junction/locate/
// reorder kernels land in follow-on work, same explicit-flag discipline as
// v3-D27/v3-D28/v3-D33.
//
// "rc" is deliberately NOT buildable here — WIREFRAME's own DATA/CODE
// table keeps reconstruct.ts's sequencing state machine as CODE, never
// templated; a spec authoring RC's behavior would be exactly the
// "interpreter that can author a state machine" WIREFRAME warns kills
// determinism.

import type { Corpus, GlossLang } from "./types.ts";
import type { Site } from "./site.ts";
import { ayahWords } from "./corpus.ts";
import { buildFace } from "./faces.ts";
import type { CorpusRef } from "./corpusRef.ts";
import type { RenderItem } from "./render.ts";

export type Spec =
  | { lane: "s1"; site: Site; lang?: GlossLang };

function buildS1(corpus: Corpus, site: Site, lang: GlossLang): RenderItem | null {
  if (site.kind !== "ayah") return null;
  const words = ayahWords(corpus, site.ayah);
  const target = words[0];
  if (!target) return null;

  const correctRef: CorpusRef = { kind: "gloss", ayah: site.ayah, position: target.position, lang };
  const correctFace = buildFace(corpus, correctRef);
  if (!correctFace) return null;

  // Byte-parity with ladder.ts#s1Options: nearest-by-position siblings,
  // deduped by gloss TEXT (not by CorpusRef — two different words can
  // legitimately share a gloss, and that IS what must be excluded).
  const siblings = words
    .filter((w) => w.position !== target.position)
    .sort((a, b) => Math.abs(a.position - target.position) - Math.abs(b.position - target.position) || a.position - b.position);

  const seen = new Set<string>([correctFace.text]);
  const options = [correctFace];
  for (const w of siblings) {
    const ref: CorpusRef = { kind: "gloss", ayah: site.ayah, position: w.position, lang };
    const face = buildFace(corpus, ref);
    if (!face || seen.has(face.text)) continue;
    seen.add(face.text);
    options.push(face);
    if (options.length === 4) break;
  }

  const prompt = buildFace(corpus, { kind: "word", ayah: site.ayah, position: target.position });
  if (!prompt) return null;

  return { shape: "choice", prompt, options, correctIndex: 0 };
}

/** The one pure function. Returns null for any spec/corpus combination
 *  that can't produce a real, corpus-grounded question — never throws,
 *  never fabricates. */
export function buildQuestion(corpus: Corpus, spec: Spec): RenderItem | null {
  switch (spec.lane) {
    case "s1":
      return buildS1(corpus, spec.site, spec.lang ?? "en");
    default:
      // Any lane without a kernel yet (cloze/junction/locate/reorder —
      // follow-on work) or "rc" (WIREFRAME's DATA/CODE split — reconstruct.ts's
      // state machine is never templated) never builds. Runtime-graceful
      // on purpose: a caller passing a lane string past the type system
      // (e.g. from an as-yet-unvalidated Laravel spec payload) gets null,
      // never a crash.
      return null;
  }
}
