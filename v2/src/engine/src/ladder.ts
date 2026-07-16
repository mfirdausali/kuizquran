// The Learn ladder S1→S2→S3 as a pure state machine over ONE ayah.
//
// Invariants honored here:
//  #1 the graded unit is the whole ayah — S3 completion (full-ayah production,
//     first word to last) is the only accomplishment; S1/S2 are scaffolding.
//  #3 first-pass meaning errors are PRETEST (flagged, excluded from grading).
//  #6 all ladder/selection logic is here, pure and tested — React holds an
//     instance and renders nextItem(); it never decides sequencing.
//
// The machine is deterministic: no RNG. Option/tile display order is the UI's
// concern; the engine emits stable, rank/position-ordered sets.

import type { Corpus, CorpusWord, DrillItem, GlossLang, LadderDone, Rung } from "./types.ts";
import { ayahWords, wordGloss } from "./corpus.ts";
import { pickOptions } from "./options.ts";

/** The ladder only ever emits S1/S2/S3 (S4 bridge lives in bridge.ts; RC — v2
 *  tap-to-reconstruct — lives in reconstruct.ts). Narrowing here keeps callers'
 *  discriminated-union checks exhaustive without an unreachable RC/S4 branch. */
export type LadderItem = Extract<DrillItem, { rung: "S1" } | { rung: "S2" } | { rung: "S3" }>;

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

const STRENGTH_LEARN = 0; // v0.2 encodes at Learn band

export function initLadder(corpus: Corpus, surah: number, ayah: number): LadderState {
  const words = ayahWords(corpus, ayah);
  return {
    surah,
    ayah,
    words,
    rung: "S1",
    s1Queue: words.map((w) => w.position),
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

/** The next drill item, or {done:true} when the whole ayah is encoded (S3 complete). */
export function nextItem(state: LadderState, corpus: Corpus, lang: GlossLang = "en"): LadderItem | LadderDone {
  if (state.ayahComplete) return { done: true };

  if (state.rung === "S1") {
    const position = state.s1Queue[0];
    if (position === undefined) return { done: true }; // guard; advance handles rung flips
    const { options, correct } = s1Options(state, position, lang);
    return {
      rung: "S1",
      word: wordAt(state, position),
      ayahWords: state.words,
      options,
      correct,
      index: state.s1Seen.size + (state.s1Seen.has(position) ? 0 : 1),
      total: state.words.length,
    };
  }

  if (state.rung === "S2") {
    const word = state.words[state.s2Index]!;
    const picked = pickOptions(corpus, state.ayah, word.position, word.text_uthmani, STRENGTH_LEARN);
    return {
      rung: "S2",
      ayahWords: state.words,
      blankPosition: word.position,
      options: [picked.correct, ...picked.distractors],
      correct: picked.correct,
      index: state.s2Index + 1,
      total: state.words.length,
    };
  }

  // S3
  return {
    rung: "S3",
    ayahWords: state.words,
    expectedPosition: state.s3Expected,
    index: state.s3Expected,
    total: state.words.length,
  };
}

export interface AdvanceResult {
  state: LadderState;
  /** True if the tap was correct. */
  correct: boolean;
  /** True if this was a first-pass S1 meaning error (pretest, excluded from grading). */
  pretest: boolean;
  /** Set when a rung was completed by this advance. */
  rungCompleted?: Rung;
  /** Set when the whole ayah was completed by this advance. */
  ayahCompleted?: boolean;
}

/**
 * Apply an answer to the current item. `choice` is the chosen text (gloss for S1,
 * Arabic surface for S2/S3). Returns the next immutable state + grading flags.
 */
export function advance(
  state: LadderState,
  corpus: Corpus,
  choice: string,
  lang: GlossLang = "en",
): AdvanceResult {
  const item = nextItem(state, corpus, lang);
  if ("done" in item) return { state, correct: false, pretest: false };

  const next: LadderState = cloneState(state);

  if (item.rung === "S1") {
    const position = item.word.position;
    const correct = choice === item.correct;
    const firstTime = !next.s1Seen.has(position);
    next.s1Seen.add(position);
    // Pretest: a first-pass meaning ERROR (first time this word is seen and wrong).
    const pretest = firstTime && !correct;

    next.s1Queue = next.s1Queue.slice(1);
    if (correct) {
      next.s1PassCorrect.add(position);
    } else {
      if (!next.s1MissedThisPass.includes(position)) next.s1MissedThisPass.push(position);
    }

    // Pass exhausted?
    if (next.s1Queue.length === 0) {
      // Complete once EVERY word has been answered correctly at least once
      // (cumulative across passes) — not a single flawless sweep. This keeps the
      // "know all glosses" bar without re-drilling all 15 words on one slip.
      const allKnown = next.words.every((w) => next.s1PassCorrect.has(w.position));
      if (allKnown) {
        next.s1CleanSwept = true;
        next.rung = "S2";
        next.s2Index = 0;
        return { state: next, correct, pretest, rungCompleted: "S1" };
      }
      // Next pass: re-ask ONLY the words not yet known (missed this pass), in
      // reading order. Already-correct words are not re-probed.
      const stillMissed = next.words
        .map((w) => w.position)
        .filter((p) => !next.s1PassCorrect.has(p));
      next.s1Queue = stillMissed;
      next.s1MissedThisPass = [];
    }
    return { state: next, correct, pretest };
  }

  if (item.rung === "S2") {
    const word = next.words[next.s2Index]!;
    const correct = choice === word.text_uthmani;
    if (!correct) {
      // Slip: stay on the same slot; grading of slips is v0.3's concern.
      return { state: next, correct: false, pretest: false };
    }
    next.s2Index += 1;
    if (next.s2Index >= next.words.length) {
      next.rung = "S3";
      next.s3Expected = 1;
      return { state: next, correct: true, pretest: false, rungCompleted: "S2" };
    }
    return { state: next, correct: true, pretest: false };
  }

  // S3 whole-bank
  const expected = next.words.find((w) => w.position === next.s3Expected)!;
  const correct = choice === expected.text_uthmani;
  if (!correct) {
    // Slip: do not advance the sequence; must produce the ayah first→last in order.
    return { state: next, correct: false, pretest: false };
  }
  next.s3Expected += 1;
  if (next.s3Expected > next.words.length) {
    next.ayahComplete = true;
    return {
      state: next,
      correct: true,
      pretest: false,
      rungCompleted: "S3",
      ayahCompleted: true,
    };
  }
  return { state: next, correct: true, pretest: false };
}

function cloneState(s: LadderState): LadderState {
  return {
    ...s,
    words: s.words, // immutable corpus data — safe to share
    s1Queue: s.s1Queue.slice(),
    s1PassCorrect: new Set(s.s1PassCorrect),
    s1Seen: new Set(s.s1Seen),
    s1MissedThisPass: s.s1MissedThisPass.slice(),
  };
}
