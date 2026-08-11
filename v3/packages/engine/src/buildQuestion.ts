// Build-plan step 16 — WIREFRAME.md §22: "One pure function:
// buildQuestion(spec, ctx) -> RenderItem | null." DoD (BUILD-PLAN.md M4):
// byte-parity re-expression of the existing generators (reconstruct.ts +
// test.ts's 6 builders) under FROZEN B6 semantics. This file ships the
// s1/cloze/junction kernels (see test/buildQuestion.test.ts's full-corpus
// sweeps against test.ts#vocabItem/clozeItem/junctionTestItem);
// locate/reorder kernels land in follow-on work, same explicit-flag
// discipline as v3-D27/v3-D28/v3-D33/v3-D35.
//
// "rc" is deliberately NOT buildable here — WIREFRAME's own DATA/CODE
// table keeps reconstruct.ts's sequencing state machine as CODE, never
// templated; a spec authoring RC's behavior would be exactly the
// "interpreter that can author a state machine" WIREFRAME warns kills
// determinism.

import type { Corpus, GlossLang } from "./types.ts";
import type { Site } from "./site.ts";
import { ayahWords, distractorsFor } from "./corpus.ts";
import { buildFace } from "./faces.ts";
import type { CorpusRef } from "./corpusRef.ts";
import type { RenderItem } from "./render.ts";

export type Spec =
  | { lane: "s1"; site: Site; lang?: GlossLang }
  | { lane: "cloze"; site: Site }
  | { lane: "junction"; site: Site };

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

/** Byte-parity with options.ts#pickOptions at strength=0 (Learn band:
 *  count=4, maxRank=4), the exact spec test.ts#clozeItem calls with. */
function buildCloze(corpus: Corpus, site: Site): RenderItem | null {
  if (site.kind !== "ayah") return null;
  const words = ayahWords(corpus, site.ayah);
  if (words.length === 0) return null;
  const target = words[Math.floor(words.length / 2)] ?? words[0]!;

  const correctFace = buildFace(corpus, { kind: "word", ayah: site.ayah, position: target.position });
  if (!correctFace) return null;

  const eligible = distractorsFor(corpus, site.ayah, target.position).filter(
    (d) => d.rank <= 4 && d.text !== correctFace.text,
  );
  const options = [correctFace];
  for (const d of eligible) {
    const face = buildFace(corpus, { kind: "distractor", ayah: site.ayah, position: target.position, rank: d.rank });
    if (!face) continue;
    options.push(face);
    if (options.length === 4) break;
  }

  return { shape: "choice", prompt: correctFace, options, correctIndex: 0 };
}

/** Byte-parity with chain.ts#junctionItem (test.ts#junctionTestItem calls
 *  it verbatim): "which ayah opens next?" — the correct answer is the
 *  opening word of the seam's `to` ayah; distractors are other ayat's
 *  opening words, nearest-delta-first. */
function buildJunction(corpus: Corpus, site: Site): RenderItem | null {
  if (site.kind !== "seam") return null;
  const from = site.ayah;
  const to = from + 1;
  if (to > corpus.meta.ayahCount) return null; // E-08: no seam at the last ayah

  const correctFace = buildFace(corpus, { kind: "word", ayah: to, position: 1 });
  if (!correctFace) return null;

  const seen = new Set<string>([correctFace.text]);
  const options = [correctFace];
  for (let delta = 1; delta <= corpus.meta.ayahCount && options.length < 4; delta++) {
    for (const cand of [to + delta, to - delta]) {
      if (cand === to || cand < 1 || cand > corpus.meta.ayahCount) continue;
      const face = buildFace(corpus, { kind: "word", ayah: cand, position: 1 });
      if (!face || seen.has(face.text)) continue;
      seen.add(face.text);
      options.push(face);
      if (options.length === 4) break;
    }
  }

  return { shape: "choice", prompt: correctFace, options, correctIndex: 0 };
}

/** The one pure function. Returns null for any spec/corpus combination
 *  that can't produce a real, corpus-grounded question — never throws,
 *  never fabricates. */
export function buildQuestion(corpus: Corpus, spec: Spec): RenderItem | null {
  switch (spec.lane) {
    case "s1":
      return buildS1(corpus, spec.site, spec.lang ?? "en");
    case "cloze":
      return buildCloze(corpus, spec.site);
    case "junction":
      return buildJunction(corpus, spec.site);
    default:
      // Any lane without a kernel yet (locate/reorder — follow-on work) or
      // "rc" (WIREFRAME's DATA/CODE split — reconstruct.ts's state machine
      // is never templated) never builds. Runtime-graceful on purpose: a
      // caller passing a lane string past the type system (e.g. from an
      // as-yet-unvalidated Laravel spec payload) gets null, never a crash.
      return null;
  }
}
