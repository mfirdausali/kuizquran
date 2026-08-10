// Placement onboarding (FR10). "Memorized before?" → adaptive junction probes at
// narrative landmarks (the 19 acts), BINARY-SEARCHING the boundary between what
// the returning-hifz user still carries and what they don't. "I don't know" is a
// first-class answer (treated as not-carried). Output: carried map + start ayah +
// daily plan. Pure and tested — this is the heart of the <5-min exit criterion.

import type { Corpus, JunctionItem } from "./types.ts";
import { junctionItem } from "./chain.ts";
import { planFor, type DailyPlan } from "./capacity.ts";

export interface ActLandmark {
  act: number;
  ayahRange: string;
  ayahs: number[];
  /** First ayah of the act — the landmark to probe recognition at. */
  opening: number;
}

/** Build the 19 act landmarks from the corpus scene beats (sorted by act). */
export function actLandmarks(corpus: Corpus): ActLandmark[] {
  return (corpus.sceneBeats ?? [])
    .slice()
    .sort((a, b) => a.act - b.act)
    .map((b) => ({
      act: b.act,
      ayahRange: b.ayahRange,
      ayahs: b.ayahs,
      opening: b.ayahs[0] ?? 0,
    }));
}

export type ProbeAnswer = "yes" | "no" | "idk";

export interface PlacementState {
  landmarks: ActLandmark[];
  /** Binary-search window over act indices [lo, hi] (1-based act numbers). */
  lo: number;
  hi: number;
  /** The highest act index confirmed carried ("yes"); 0 if none yet. */
  carriedThrough: number;
  /** Acts probed so far (for the log / probe count). */
  probed: number[];
  done: boolean;
}

export function initPlacement(corpus: Corpus): PlacementState {
  const landmarks = actLandmarks(corpus);
  return {
    landmarks,
    lo: 1,
    hi: landmarks.length,
    carriedThrough: 0,
    probed: [],
    done: landmarks.length === 0,
  };
}

export interface Probe {
  act: number;
  ayahRange: string;
  /** Recognition MCQ: which word opens this act's first ayah? (reuse junctionItem). */
  item: JunctionItem;
}

/** The next act to probe (the midpoint of the search window), or done. */
export function nextProbe(state: PlacementState, corpus: Corpus): Probe | { done: true } {
  if (state.done || state.lo > state.hi) return { done: true };
  const mid = Math.floor((state.lo + state.hi) / 2); // 1-based act number
  const lm = state.landmarks[mid - 1]!;
  // Probe recognition of the act's opening ayah as a junction from the prior ayah.
  const from = Math.max(1, lm.opening - 1);
  const to = lm.opening;
  return { act: mid, ayahRange: lm.ayahRange, item: junctionItem(corpus, from, to) };
}

/**
 * Apply a probe answer, taking one binary-search step.
 *  yes  → the user carries this act → search the LATER half (lo = mid+1).
 *  no/idk → not carried → search the EARLIER half (hi = mid-1).
 * Converges in ≤ ⌈log2(19)⌉ = 5 probes.
 */
export function answerProbe(state: PlacementState, answer: ProbeAnswer): PlacementState {
  if (state.done || state.lo > state.hi) return state;
  const mid = Math.floor((state.lo + state.hi) / 2);
  const next: PlacementState = {
    ...state,
    probed: [...state.probed, mid],
  };
  if (answer === "yes") {
    next.carriedThrough = Math.max(next.carriedThrough, mid);
    next.lo = mid + 1;
  } else {
    next.hi = mid - 1;
  }
  next.done = next.lo > next.hi;
  return next;
}

export interface PlacementResult {
  /** Act numbers the user carries (1..carriedThrough). */
  carriedActs: number[];
  /** Ayat covered by the carried acts. */
  carriedAyat: number[];
  /** First ayah of the first NOT-carried act — where new Learn begins. */
  startAyah: number;
  /** The daily plan (capacity + honest ETA + first-week habit protocol). */
  dailyPlan: DailyPlan;
  /** Number of probes taken (should be ≤5). */
  probeCount: number;
}

/** Finalize placement into the carried map + start ayah + daily plan. */
export function placementResult(
  state: PlacementState,
  corpus: Corpus,
  minutesPerDay = 8,
): PlacementResult {
  const carriedActs: number[] = [];
  const carriedAyat: number[] = [];
  for (const lm of state.landmarks) {
    if (lm.act <= state.carriedThrough) {
      carriedActs.push(lm.act);
      carriedAyat.push(...lm.ayahs);
    }
  }
  // Start ayah = first ayah of the first not-carried act (or after the last ayah
  // if everything is carried).
  const firstNotCarried = state.landmarks.find((lm) => lm.act > state.carriedThrough);
  const startAyah = firstNotCarried ? firstNotCarried.opening : corpus.meta.ayahCount + 1;

  const remainingAyat = corpus.meta.ayahCount - carriedAyat.length;
  // Average words per remaining ayah (fall back to the surah average).
  const avgWordsPerAyah = Math.max(
    1,
    Math.round(corpus.meta.wordCount / Math.max(1, corpus.meta.ayahCount)),
  );

  return {
    carriedActs,
    carriedAyat,
    startAyah,
    dailyPlan: planFor({ remainingAyat, avgWordsPerAyah, minutesPerDay }),
    probeCount: state.probed.length,
  };
}
