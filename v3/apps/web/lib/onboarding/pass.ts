// ASSEMBLING A `SequenceFillItem` FROM A `ReconstructState`.
//
// v3-D37 gap 2, stated in SequenceFillCard's own header: this shape has NO
// producer inside `buildQuestion`. It is RC's shape, and RC is permanently CODE
// (`reconstruct.ts`'s state machine), so the item is ASSEMBLED from the engine's
// state rather than compiled from a Spec. `test/quiz.test.tsx` does this inline
// and calls it "the same thing the session loop will have to do" — this module
// is that thing, extracted so screen 2 and the session loop share ONE assembly
// instead of two that drift.
//
// ---------------------------------------------------------------------------
// EVERY ARABIC BYTE HERE COMES FROM `buildFace`
// ---------------------------------------------------------------------------
// `pickOptions` returns STRINGS (`{correct, distractors[]}`) — surface forms,
// with no provenance attached. A `Face` requires `from: CorpusRef`, and
// `buildFace` is its ONLY constructor: it resolves the coordinate against the
// corpus and returns a Face carrying THAT text, never text handed to it.
//
// So this module never puts a `pickOptions` string into a Face. It maps each
// option back to the COORDINATE that produced it — the word itself, or the
// ranked distractor row — and builds the Face from the coordinate. The strings
// are used only to FIND the coordinate, never to become the payload. That is
// what keeps `resolveRef(corpus, face.from) === face.text` true by construction
// on this path exactly as it is on the compiler's.
//
// ---------------------------------------------------------------------------
// NO ENGINE DECISIONS ARE MADE HERE
// ---------------------------------------------------------------------------
// Which words are blank, how many, and which distractors are eligible are all
// decided inside `reconstruct.ts` / `options.ts` before this function is
// called. This module reads the resulting state and turns coordinates into
// Faces. It compares nothing to a band, a strength or a threshold — those
// belong to the engine, and `check-boundaries.mjs` clause 5 exists to keep
// them out of anything a view can reach.

import { buildFace, type Face } from "@engine/faces.ts";
import type { CorpusRef } from "@engine/corpusRef.ts";
import { distractorsFor } from "@engine/corpus.ts";
import type { SequenceFillItem } from "@engine/render.ts";
import { nextReconstructItem, type ReconstructState } from "@engine/reconstruct.ts";
import type { Corpus } from "@engine/types.ts";

/**
 * Find the CorpusRef whose resolved text is `surface`, for one word slot.
 *
 * The correct answer resolves to the word coordinate; anything else must be one
 * of that position's ranked distractors. Returns `null` when no coordinate
 * produces this surface, which is the only honest outcome — a Face cannot be
 * manufactured from a bare string, by design.
 */
function refForSurface(
  corpus: Corpus,
  ayah: number,
  position: number,
  correctSurface: string,
  surface: string,
): CorpusRef | null {
  if (surface === correctSurface) return { kind: "word", ayah, position };
  const row = distractorsFor(corpus, ayah, position).find((d) => d.text === surface);
  return row ? { kind: "distractor", ayah, position, rank: row.rank } : null;
}

// ---------------------------------------------------------------------------
// DISPLAY ORDER — the UI's concern, and stated as such by the engine
// ---------------------------------------------------------------------------
// `options.ts`: "Pure and deterministic — no RNG here (option ORDER for display
// is the UI's concern; the engine returns a stable, rank-sorted set)." So the
// engine hands back `[correct, ...distractors]` with the correct answer ALWAYS
// at index 0. Painting that order would make the drill trivially gameable:
// tapping the first tile every time produces a perfect reconstruction without
// reading a single word, which would make the whole recall claim a lie.
//
// The shuffle is SEEDED, never `Math.random`:
//   - a re-render (React strict mode double-renders in dev, a resize, a
//     re-paint after a tap) must not reshuffle the bank under the learner's
//     finger — a tile moving between the decision to tap and the tap itself is
//     a mis-tap the learner will read as their own error;
//   - the same blank shown twice is the same screen, so a reload rebuilds what
//     the learner was looking at.
//
// Mirrors `rotation.ts`'s Fisher-Yates-driven-by-hash32 (INVARIANTS.md
// Absolute A). That function is private to the engine and the engine is not
// mine to edit, so the mixer is re-stated here — it is four lines of integer
// hashing, and duplicating it is strictly better than reaching into engine
// internals or weakening the no-RNG rule.
function hash32(seed: number): number {
  let x = seed | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return x >>> 0;
}

/**
 * A deterministic permutation of [0..n-1] for a given seed.
 *
 * Exported so the property that matters — same seed, same order; different
 * blank, different order — can be asserted directly rather than inferred from
 * a rendered bank.
 */
export function displayOrder(n: number, seed: number): number[] {
  const perm = Array.from({ length: n }, (_, i) => i);
  let state = hash32(seed * 2654435761);
  for (let i = n - 1; i > 0; i--) {
    state = hash32(state);
    const j = state % (i + 1);
    [perm[i], perm[j]] = [perm[j]!, perm[i]!];
  }
  return perm;
}

export interface AssembledPass {
  item: SequenceFillItem;
  /** The surface the engine expects at the active blank. The caller passes the
   *  TAPPED surface back into `advanceReconstruct`, which does the real
   *  (normalising) comparison — this is carried so the caller never has to
   *  re-derive it and never compares strings itself. */
  correctSurface: string;
}

/**
 * Turn the current `ReconstructState` into a renderable item, or `null` once
 * every blank is filled (the engine's own `{done:true}`).
 *
 * `filled` is intentionally NOT computed here: the card takes already-filled
 * positions from the caller, which holds them alongside the committed log, so a
 * reload rebuilds the same screen from the same source.
 */
export function assemblePass(state: ReconstructState, corpus: Corpus): AssembledPass | null {
  const drill = nextReconstructItem(state, corpus);
  if ("done" in drill) return null;

  // The whole ayah, always on screen (v2-D23) — non-blank words render in
  // place, only the blanked tail is hidden.
  const ayahWordFaces: Face[] = [];
  for (const word of state.words) {
    const face = buildFace(corpus, { kind: "word", ayah: state.ayah, position: word.position });
    // A word that will not resolve means the corpus is not the one this state
    // was built from. Refuse rather than paint a hole in an ayah.
    if (!face) return null;
    ayahWordFaces.push(face);
  }

  // `blankPositions` holds WORD POSITIONS (corpus coordinates). The render
  // contract's `blankPositions` holds INDICES INTO `ayahWords`. These are not
  // the same numbering, and conflating them is how the wrong word gets blanked
  // when an ayah's positions do not start at 1 or are not contiguous. Map
  // explicitly, by identity, rather than assuming `position - 1`.
  const indexOfPosition = new Map(state.words.map((w, i) => [w.position, i]));
  const blankIndices: number[] = [];
  for (const position of state.blankPositions) {
    const index = indexOfPosition.get(position);
    if (index === undefined) return null;
    blankIndices.push(index);
  }

  // The option bank, each option built from the coordinate that produced it.
  const optionFaces: Face[] = [];
  for (const surface of drill.options) {
    const ref = refForSurface(corpus, state.ayah, drill.currentBlank, drill.correct, surface);
    if (!ref) return null;
    const face = buildFace(corpus, ref);
    if (!face) return null;
    optionFaces.push(face);
  }

  // `drill.options` is `[correct, ...distractors]` (reconstruct.ts), so the
  // correct answer is index 0. Stated by SEARCHING for it rather than assuming,
  // so a future change to that ordering surfaces as a wrong reveal in a test
  // instead of a silently mis-marked answer key.
  const engineCorrectIndex = drill.options.indexOf(drill.correct);
  if (engineCorrectIndex < 0) return null;

  // Seeded by the COORDINATE being filled, so the order is a property of "which
  // blank is this", not of when it was rendered. Same blank → same bank, across
  // re-renders and reloads; different blank → different bank.
  const order = displayOrder(optionFaces.length, state.ayah * 1000 + drill.currentBlank);
  const shuffledOptions = order.map((i) => optionFaces[i]!);
  // `order[k]` is the ENGINE index painted at slot k, so the slot holding the
  // correct answer is where `order` contains `engineCorrectIndex`. Inverting it
  // the other way round is the classic off-by-inversion here and would mark the
  // wrong tile green.
  const correctIndex = order.indexOf(engineCorrectIndex);
  if (correctIndex < 0) return null;

  return {
    item: {
      shape: "sequenceFill",
      ayahWords: ayahWordFaces,
      blankPositions: blankIndices,
      cursor: state.blankIndex,
      options: shuffledOptions,
      correctIndex,
    },
    correctSurface: drill.correct,
  };
}

/**
 * The map of already-filled blanks the card paints, keyed by index into
 * `ayahWords` — built from the engine state's own progress, so it can never
 * disagree with the cursor.
 *
 * Blanks fill strictly in reading order, so every blank BEFORE `blankIndex` is
 * filled and holds its own word's surface.
 */
export function filledSoFar(state: ReconstructState): ReadonlyMap<number, string> {
  const filled = new Map<number, string>();
  const indexOfPosition = new Map(state.words.map((w, i) => [w.position, i]));
  for (let i = 0; i < state.blankIndex && i < state.blankPositions.length; i++) {
    const position = state.blankPositions[i]!;
    const index = indexOfPosition.get(position);
    const word = state.words.find((w) => w.position === position);
    if (index === undefined || !word) continue;
    filled.set(index, word.text_uthmani);
  }
  return filled;
}
