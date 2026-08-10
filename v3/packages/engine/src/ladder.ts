// `initLadder` + `s1Options` only. v3-D25: the full S1→S2→S3 state machine
// here (`nextItem`/`advance`/`AdvanceResult`/`LadderItem`) was built and
// unit-tested in v2 but never wired into a shipped screen — `Drill.tsx`/
// `Gate.tsx` (the only live drill/gate screens) import `ReconstructState`
// from `engine`, never `LadderState` (grep-verified). Atticked, per
// BUILD-PLAN.md's step-5 order. `initLadder`/`s1Options` alone are
// load-bearing: test.ts's live `vocabItem` generator calls them directly.
//
// Invariants honored here:
//  #1 the graded unit is the whole ayah (not relevant to this surviving
//     surface — S1 meaning items never grade strength; see reconstruct.ts).
//  #6 all ladder/selection logic is here, pure and tested — React renders
//     what it's given, it never decides.
//
// The generators are deterministic: no RNG. Option/tile display order is the
// UI's concern; the engine emits stable, rank/position-ordered sets.

import type { Corpus, CorpusWord, GlossLang, Rung } from "./types.ts";
import { ayahWords, wordGloss } from "./corpus.ts";

export interface LadderState {
  surah: number;
  ayah: number;
  words: CorpusWord[]; // reading order
  rung: Rung;

  // ---- S1 meaning pass ----
  /** Queue of word positions still to probe this pass (reading order, plus warm-ups). */
  s1Queue: number[];
  /** Positions answered correctly in the CURRENT pass (for clean-sweep detection). */
  s1PassCorrect: Set<number>;
  /** Positions that have EVER been asked (first-pass errors on these are pretest). */
  s1Seen: Set<number>;
  /** Positions missed in the current pass → requeued as warm-ups next pass. */
  s1MissedThisPass: number[];
  /** True once a full clean sweep (all words correct, no miss) completes. */
  s1CleanSwept: boolean;

  // ---- S2 fill ----
  /** Index into words[] of the current blank (0-based). */
  s2Index: number;

  // ---- S3 whole-bank ----
  /** Next expected reading position (1-based). */
  s3Expected: number;

  /** Set once S3 completes the whole ayah. */
  ayahComplete: boolean;
}

/** DATA-1: a word is independently probeable in S1 unless it's a NON-anchor
 *  member of a multi-word group (`groupPositions[0]` is the anchor — the
 *  lowest position, the only one ever probed; the phrase's shared gloss is
 *  already correct there, so asking the trailing token(s) again would be a
 *  near-duplicate question, per the corpus-report grouping review). */
export function isS1Probeable(w: CorpusWord): boolean {
  return !w.groupPositions || w.groupPositions[0] === w.position;
}

function s1ProbeablePositions(words: CorpusWord[]): number[] {
  return words.filter(isS1Probeable).map((w) => w.position);
}

export function initLadder(corpus: Corpus, surah: number, ayah: number): LadderState {
  const words = ayahWords(corpus, ayah);
  return {
    surah,
    ayah,
    words,
    rung: "S1",
    s1Queue: s1ProbeablePositions(words),
    s1PassCorrect: new Set(),
    s1Seen: new Set(),
    s1MissedThisPass: [],
    s1CleanSwept: false,
    s2Index: 0,
    s3Expected: 1,
    ayahComplete: false,
  };
}

function wordAt(state: LadderState, position: number): CorpusWord {
  const w = state.words.find((x) => x.position === position);
  if (!w) throw new Error(`no word at position ${position} in ayah ${state.ayah}`);
  return w;
}

/**
 * S1 gloss MCQ options for a word: its own gloss in the learner's chosen
 * language (correct, v2-D27 — `gloss[lang] ?? gloss.en ?? text_uthmani`) plus
 * up to 3 sibling-word glosses as distractors, chosen deterministically as the
 * nearest distinct-gloss neighbors (closest by position first). Falls back
 * gracefully if the ayah is tiny.
 */
export function s1Options(
  state: LadderState,
  position: number,
  lang: GlossLang = "en",
): { options: string[]; correct: string } {
  const target = wordAt(state, position);
  const correct = wordGloss(target, lang);
  const siblings = state.words
    .filter((w) => w.position !== position)
    .map((w) => ({ pos: w.position, gloss: wordGloss(w, lang) }))
    .filter((s) => s.gloss !== correct)
    // nearest by position, deterministic
    .sort((a, b) => Math.abs(a.pos - position) - Math.abs(b.pos - position) || a.pos - b.pos);
  const distractors: string[] = [];
  const seen = new Set<string>([correct]);
  for (const s of siblings) {
    if (seen.has(s.gloss)) continue;
    seen.add(s.gloss);
    distractors.push(s.gloss);
    if (distractors.length === 3) break;
  }
  // Stable option order: correct first, then distractors. UI shuffles for display.
  return { options: [correct, ...distractors], correct };
}
