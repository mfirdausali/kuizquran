// v2 Phase 4 (v2-D13–D16) — the Test feature: a self-initiated, READ-ONLY
// mirror over a learner-chosen range of proficient ayat. Mixed random
// questions drawn from the SAME generators the Learn ladder already uses — no
// new distractor logic, invariant #6 — plus two patterns new to Test:
// locate-the-ayah and chaining-reorder (v2-D13's exact named list).
//
// "No RNG in the engine" (Appendix A §E) governs DETERMINISTIC drill generation
// for the spaced-repetition path; a Test's raison d'être is a real, unpredictable
// mixed quiz, so — exactly like the UI already shuffles tile DISPLAY order — the
// UI also picks WHICH (kind, ayah) pairs make the Test and in what order. Every
// builder below is still pure and deterministic for a GIVEN (kind, ayah) input.
//
// Grading never touches atoms: rebuild.ts has no branch for test_* events, so
// they carry no strength/due-date signal by construction (v2-D14).

import type { Corpus, CorpusWord, DrillEvent, GlossLang } from "./types.ts";
import { ayahWords } from "./corpus.ts";
import { initLadder, s1Options } from "./ladder.ts";
import { pickOptions } from "./options.ts";
import { junctionItem } from "./chain.ts";
import type { AtomState } from "./atom.ts";
import { currentBand } from "./strength.ts";
import type { DayConfig } from "./daybound.ts";

export interface TestVocabItem {
  kind: "vocab";
  ayah: number;
  position: number;
  word: CorpusWord;
  /** The full ayah in reading order — grounded in the verse (v2-D23), same
   *  contract as the S1 DrillItem's own ayahWords. */
  ayahWords: CorpusWord[];
  options: string[];
  correct: string;
}

export interface TestClozeItem {
  kind: "cloze";
  ayah: number;
  ayahWords: CorpusWord[];
  blankPosition: number;
  options: string[];
  correct: string;
}

/** Produce-from-cold: a full whole-ayah reconstruct pass, no warm-up — the UI
 *  drives it via reconstruct.ts's initReconstruct(..., {full:true}) exactly like
 *  the day-1 cold gate. Carries no options of its own (reconstruct.ts owns that). */
export interface TestProduceItem {
  kind: "produce";
  ayah: number;
}

export interface TestJunctionItem {
  kind: "junction";
  from: number;
  to: number;
  options: string[];
  correct: string;
}

export interface TestLocateItem {
  kind: "locate";
  /** The ayah whose text is shown (the learner must name its number). */
  ayah: number;
  ayahWords: CorpusWord[];
  /** Ayah-number options (correct + nearby distractors from the test pool). */
  options: number[];
  correct: number;
}

/** Chaining-reorder: a short run of consecutive ayat, shown out of order — the
 *  learner taps them back into reading order (tap-to-order, not drag-and-drop:
 *  v2 has no drag primitive and every other drill is already tap-based —
 *  v2-D28's "tap-to-reconstruct is a thumb interaction" extends naturally here). */
export interface TestReorderItem {
  kind: "reorder";
  /** The correct reading order. */
  ayahs: number[];
}

export type TestItem =
  | TestVocabItem
  | TestClozeItem
  | TestProduceItem
  | TestJunctionItem
  | TestLocateItem
  | TestReorderItem;

/**
 * The learner's carried ayat (band CARRY, ≥80 strength decayed to `now`) — the
 * smart default test range (v2-D15). Sorted ascending; may be non-contiguous.
 */
export function carriedAyat(atoms: AtomState[], now: number, cfg?: DayConfig): number[] {
  return atoms
    .filter((a) => a.kind === "ayah" && currentBand(a, now, cfg) === "carry")
    .map((a) => a.ref)
    .sort((a, b) => a - b);
}

/** S1-equivalent meaning MCQ, probing the ayah's FIRST word (a stable, simple
 *  choice — which specific word varies less than the fact that Test already
 *  randomizes which ayat/kinds appear). Reuses ladder.ts's s1Options verbatim. */
export function vocabItem(corpus: Corpus, surah: number, ayah: number, lang: GlossLang = "en"): TestVocabItem {
  const state = initLadder(corpus, surah, ayah);
  const word = state.words[0]!;
  const { options, correct } = s1Options(state, word.position, lang);
  return { kind: "vocab", ayah, position: word.position, word, ayahWords: state.words, options, correct };
}

/** S2-equivalent cloze MCQ, blanking the ayah's middle word (deterministic; the
 *  Learn-band option spec — 4 options — since Test probes recognition, not the
 *  learner's current band). Reuses options.ts's pickOptions verbatim. */
export function clozeItem(corpus: Corpus, ayah: number): TestClozeItem {
  const words = ayahWords(corpus, ayah);
  const target = words[Math.floor(words.length / 2)] ?? words[0]!;
  const picked = pickOptions(corpus, ayah, target.position, target.text_uthmani, 0);
  return {
    kind: "cloze",
    ayah,
    ayahWords: words,
    blankPosition: target.position,
    options: [picked.correct, ...picked.distractors],
    correct: picked.correct,
  };
}

export function produceItem(ayah: number): TestProduceItem {
  return { kind: "produce", ayah };
}

/** Reuses chain.ts's junctionItem verbatim — "which ayah opens next?" */
export function junctionTestItem(corpus: Corpus, ayah: number): TestJunctionItem {
  const j = junctionItem(corpus, ayah, ayah + 1);
  return { kind: "junction", from: j.from, to: j.to, options: j.options, correct: j.correct };
}

/** `pool` is the candidate ayat the Test is drawn from (the range) — up to 3
 *  distractor ayah numbers are taken from it, excluding the correct one. */
export function locateItem(corpus: Corpus, ayah: number, pool: number[]): TestLocateItem {
  const distractors = pool.filter((a) => a !== ayah).slice(0, 3);
  return { kind: "locate", ayah, ayahWords: ayahWords(corpus, ayah), options: [ayah, ...distractors], correct: ayah };
}

export function reorderItem(fromAyah: number, count = 3): TestReorderItem {
  const ayahs: number[] = [];
  for (let a = fromAyah; a < fromAyah + count; a++) ayahs.push(a);
  return { kind: "reorder", ayahs };
}

/** Grade an MCQ-shaped item (vocab/cloze/junction): the chosen text vs correct. */
export function isCorrectChoice(item: TestVocabItem | TestClozeItem | TestJunctionItem, choice: string): boolean {
  return choice === item.correct;
}

/** Grade a locate item: the chosen ayah number vs correct. */
export function isCorrectLocate(item: TestLocateItem, choice: number): boolean {
  return choice === item.correct;
}

/** Grade a reorder item: the FULL attempted sequence must match exactly — no
 *  partial credit (invariant #1's "whole unit" spirit extended to the set). */
export function isCorrectReorder(item: TestReorderItem, attempt: number[]): boolean {
  return attempt.length === item.ayahs.length && attempt.every((a, i) => a === item.ayahs[i]);
}

export interface TestResultSummary {
  ts: number;
  from: number;
  to: number;
  score: number;
  total: number;
  sentToReviews: boolean;
}

/** Test history (v2-D17 Progress Report), read straight off the append-only log
 *  — every `test_result` event, in log order. Pure. */
export function testHistory(events: DrillEvent[]): TestResultSummary[] {
  return events
    .filter((e): e is DrillEvent & { score: number; total: number } => e.type === "test_result" && e.score !== undefined && e.total !== undefined)
    .map((e) => ({ ts: e.ts, from: e.ayah, to: e.to ?? e.ayah, score: e.score, total: e.total, sentToReviews: e.sentToReviews === true }));
}
