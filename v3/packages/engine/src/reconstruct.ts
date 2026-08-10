// v2 Phase 1 (v2-D05, v2-D23) — tap-to-reconstruct: the primary drill mechanic,
// generalizing the old ladder's S2 (one-word fill) and S3 (whole-ayah production)
// into a single pass whose blank COUNT auto-scales with strength band (Appendix A
// §B in ROADMAP.md): Learn → 1 blank, Reinforce → about half, Carry → the whole
// ayah (matches S3's full production exactly).
//
// Always grounded in the whole verse (v2-D23): non-blank positions render in
// place; only the blank tail is hidden. Blanks fill strictly in reading order
// (invariant #1 — the graded unit is the whole ayah, not a word), one at a time,
// each with a tile bank of the correct form + band-scaled near-miss distractors
// from the SAME ranked pool S2 already used (`corpus.distractorsFor` via
// `options.pickOptions` — no new distractor logic, invariant #6).
//
// Pure, deterministic — no RNG (tile display shuffle is the UI's concern).

import type { Corpus, CorpusWord, DrillItem, LadderDone } from "./types.ts";
import { ayahWords } from "./corpus.ts";
import { pickOptions } from "./options.ts";
import { bandOf } from "./atom.ts";

/** reconstruct.ts only ever emits the RC item. Narrowing keeps callers' checks
 *  exhaustive without an unreachable S1/S2/S3/S4 branch. */
export type ReconstructItem = Extract<DrillItem, { rung: "RC" }>;

export interface ReconstructState {
  surah: number;
  ayah: number;
  words: CorpusWord[]; // reading order, the full ayah
  /** Positions hidden this pass, ascending (reading) order. */
  blankPositions: number[];
  /** 0-based index into blankPositions of the blank currently being filled. */
  blankIndex: number;
  /** Strength this pass was initialized at (drives both blank count and the
   *  per-blank option difficulty via pickOptions). */
  strength: number;
}

/**
 * How many of the ayah's words are blanked, given the atom's strength band.
 * Learn (< 40): 1 — the gentlest introduction. Reinforce (40–80): about half.
 * Carry (≥ 80): the whole ayah — full production, equivalent to old S3.
 */
export function blankCountFor(strength: number, total: number): number {
  if (total <= 0) return 0;
  const band = bandOf(strength);
  if (band === "learn") return Math.min(1, total);
  if (band === "reinforce") return Math.min(Math.ceil(total / 2), total);
  return total; // carry (and lapsed, which never starts a fresh pass here)
}

export interface InitReconstructOptions {
  /** Force whole-ayah blanking regardless of strength band — the day-1 COLD gate
   *  check (ROADMAP Phase 2 / invariant "cold = first attempt of a fresh
   *  learning-day, no warm-up") is always full production, even for an atom
   *  that just encoded and is still band "learn". */
  full?: boolean;
}

/**
 * Start a reconstruct pass over one ayah. Blanks are the LAST `blankCountFor`
 * positions (reading order) — the ayah's opening stays visible as scaffold and
 * the hidden tail grows toward the front as strength climbs, until at Carry
 * band nothing is given (pure production, matching S3). Pass `opts.full` to
 * force whole-ayah blanking regardless of band (the cold gate check).
 */
export function initReconstruct(
  corpus: Corpus,
  surah: number,
  ayah: number,
  strength: number,
  opts?: InitReconstructOptions,
): ReconstructState {
  const words = ayahWords(corpus, ayah);
  const blankCount = opts?.full ? words.length : blankCountFor(strength, words.length);
  const start = words.length - blankCount;
  const blankPositions = words.slice(start).map((w) => w.position);
  return { surah, ayah, words, blankPositions, blankIndex: 0, strength };
}

/** The current drill item, or {done:true} once every blank has been filled. */
export function nextReconstructItem(state: ReconstructState, corpus: Corpus): ReconstructItem | LadderDone {
  if (state.blankIndex >= state.blankPositions.length) return { done: true };
  const position = state.blankPositions[state.blankIndex]!;
  const word = state.words.find((w) => w.position === position)!;
  const picked = pickOptions(corpus, state.ayah, position, word.text_uthmani, state.strength);
  return {
    rung: "RC",
    ayahWords: state.words,
    blankPositions: state.blankPositions,
    currentBlank: position,
    options: [picked.correct, ...picked.distractors],
    correct: picked.correct,
    index: state.blankIndex + 1,
    total: state.blankPositions.length,
    full: state.blankPositions.length === state.words.length,
  };
}

export interface ReconstructAdvance {
  state: ReconstructState;
  /** Whether this particular tap was correct. */
  correct: boolean;
  /** Set true when this tap completed the LAST blank — the whole pass is
   *  produced. This is the moment to emit the graded `ayah_produced` event. */
  ayahProduced?: boolean;
  /** Whether the completed pass blanked the whole ayah (→ grade as S3, encodes)
   *  vs a partial reconstruction (→ grade as S2). Only set when ayahProduced. */
  full?: boolean;
}

/**
 * Apply one tap to the current blank. A wrong tap is a slip — it does not
 * advance (stays on the same blank), mirroring the old S2/S3 slip behavior.
 */
export function advanceReconstruct(
  state: ReconstructState,
  corpus: Corpus,
  choice: string,
): ReconstructAdvance {
  const item = nextReconstructItem(state, corpus);
  if ("done" in item) return { state, correct: false };

  const correct = choice === item.correct;
  if (!correct) return { state, correct: false };

  const next: ReconstructState = { ...state, blankIndex: state.blankIndex + 1 };
  const ayahProduced = next.blankIndex >= next.blankPositions.length;
  return { state: next, correct: true, ayahProduced, full: ayahProduced ? item.full : undefined };
}
