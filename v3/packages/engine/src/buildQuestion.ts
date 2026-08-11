// Build-plan step 16 — WIREFRAME.md §22: "One pure function:
// buildQuestion(spec, ctx) -> RenderItem | null." DoD (BUILD-PLAN.md M4):
// byte-parity re-expression of the existing generators (reconstruct.ts +
// test.ts's 6 builders) under FROZEN B6 semantics. This file ships the
// COMPLETE lane set — s1/cloze/junction/locate/reorder — each fenced by a
// full-corpus sweep in test/buildQuestion.test.ts against its own oracle
// (test.ts#vocabItem/clozeItem/junctionTestItem/locateItem/reorderItem),
// same explicit-flag discipline as v3-D27/v3-D28/v3-D33/v3-D35.
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
  | { lane: "junction"; site: Site }
  /** `pool` is the Test's own candidate range — the ayat distractor NUMBERS
   *  are drawn from. It is not derivable from a Site (a Site names one
   *  coordinate, not the range it was drawn from), so the spec carries it
   *  explicitly, same discipline as s1's `lang`. */
  | { lane: "locate"; site: Site; pool: number[] }
  /** `count` is the run length — like locate's `pool`, not derivable from a
   *  Site (a Site names one coordinate, not how far the run extends). Legacy
   *  test.ts#reorderItem defaults it to 3; so does this. */
  | { lane: "reorder"; site: Site; count?: number };

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

/** Byte-parity with test.ts#locateItem: "which ayah is this?" — the ayah's
 *  text is the prompt and the ANSWER is a coordinate, so the options are
 *  ayah numbers, never Faces (render.ts#LocateChoiceItem's own contract).
 *
 *  Parity notes, each load-bearing: the pool's order is preserved verbatim
 *  (no sorting, no nearest-first — the Test's own range order IS the order),
 *  distractors are the first 3 entries !== the correct ayah with no dedup,
 *  and the correct answer sits at index 0 so `correctIndex` is 0 like every
 *  other kernel here. Legacy does not bounds-check pool entries against the
 *  corpus and neither does this — a pool is caller-supplied range data, and
 *  filtering it here would silently diverge from the oracle.
 *
 *  The one field with no home in this shape is legacy's `ayahWords`:
 *  LocateChoiceItem carries a single `prompt` Face, so the whole ayah
 *  arrives as one {kind:"verse"} Face rather than a word array. Same bytes,
 *  one Face instead of N. */
function buildLocate(corpus: Corpus, site: Site, pool: number[]): RenderItem | null {
  if (site.kind !== "ayah") return null;

  // resolveRef's own existence check, via the verse Face: an ayah absent
  // from this corpus yields null here and the whole item declines to build.
  const prompt = buildFace(corpus, { kind: "verse", ayah: site.ayah });
  if (!prompt) return null;

  const distractors = pool.filter((a) => a !== site.ayah).slice(0, 3);
  return { shape: "locateChoice", prompt, options: [site.ayah, ...distractors], correctIndex: 0 };
}

/** Byte-parity with test.ts#reorderItem: a short run of consecutive ayat the
 *  learner taps back into reading order. `correctOrder` IS legacy's `ayahs` —
 *  the ascending run [fromAyah … fromAyah+count-1] — and `attempt` starts
 *  empty because no tap has happened yet (render.ts#OrderTilesItem's own
 *  stateful field, initialized, not fabricated).
 *
 *  Two deliberate departures from legacy, each forced by the render contract:
 *
 *  1. Legacy takes NO corpus and never bounds-checks, so it will happily emit
 *     ayah numbers past the surah's end. This kernel cannot: OrderTilesItem
 *     carries `tiles: Face[]`, and a Face past `ayahCount` has no text to
 *     resolve. Rather than fabricate a tile or ship a short one, an overrunning
 *     run declines to build — the same "null, never a crash" contract every
 *     other kernel here honors (cf. junction's E-08 closure). Parity is
 *     therefore asserted over exactly the runs legacy and this kernel can both
 *     express; the sweep test names the boundary explicitly.
 *  2. Tiles are {kind:"verse"} Faces in READING order, not shuffled. Display
 *     shuffling is a UI concern (test.ts's own header: "exactly like the UI
 *     already shuffles tile DISPLAY order") and would inject nondeterminism
 *     into a pure function. `correctOrder` is the answer key; the caller
 *     permutes presentation. */
function buildReorder(corpus: Corpus, site: Site, count: number): RenderItem | null {
  if (site.kind !== "ayah") return null;
  if (count <= 0) return null;

  const correctOrder: number[] = [];
  for (let a = site.ayah; a < site.ayah + count; a++) correctOrder.push(a);

  const tiles = [];
  for (const ayah of correctOrder) {
    const face = buildFace(corpus, { kind: "verse", ayah });
    if (!face) return null; // any ayah in the run absent from the corpus kills the item
    tiles.push(face);
  }

  return { shape: "orderTiles", tiles, attempt: [], correctOrder };
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
    case "locate":
      return buildLocate(corpus, spec.site, spec.pool);
    case "reorder":
      return buildReorder(corpus, spec.site, spec.count ?? 3);
    default:
      // The lane set is now COMPLETE — every templatable lane above has a
      // kernel, so the only thing reaching here is "rc" (WIREFRAME's
      // DATA/CODE split — reconstruct.ts's state machine is never
      // templated). Runtime-graceful on purpose: a caller passing a lane
      // string past the type system (e.g. from an as-yet-unvalidated
      // Laravel spec payload) gets null, never a crash. Note this arm
      // deliberately does NOT assert `never` — that would make the
      // out-of-band "rc" test a compile error rather than the runtime
      // refusal it is meant to prove.
      return null;
  }
}
