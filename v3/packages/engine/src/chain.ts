// Junction items only. v3-D25: `chainSteps`/`applyChain`/`applyVictoryLapChain`/
// `applyWeakSeamChain`/`riskiestJunctions`/`weakSeamChainRange`/`junctionOutcome`
// were built and unit-tested in v2 but never wired into a shipped screen
// (grep-verified: zero references outside engine/src and engine/test) —
// atticked, per BUILD-PLAN.md's step-5 order. `junctionItem` alone is
// load-bearing: test.ts's live junction generator calls it directly.

import type { Corpus, JunctionItem } from "./types.ts";
import { ayahWords } from "./corpus.ts";

/**
 * A junction check for n→n+1: "which ayah opens next?" The correct answer is the
 * opening word of ayah n+1; distractors are other ayat's opening words (look-alike
 * openings), taken deterministically from the corpus.
 */
export function junctionItem(corpus: Corpus, from: number, to: number): JunctionItem {
  const correctWord = ayahWords(corpus, to)[0];
  const correct = correctWord ? correctWord.text_uthmani : "";
  // Distractor openings: the opening word of nearby OTHER ayat (not `to`).
  const distractors: string[] = [];
  const seen = new Set<string>([correct]);
  for (let delta = 1; delta <= corpus.meta.ayahCount && distractors.length < 3; delta++) {
    for (const cand of [to + delta, to - delta]) {
      if (cand === to || cand < 1 || cand > corpus.meta.ayahCount) continue;
      const w = ayahWords(corpus, cand)[0];
      if (!w) continue;
      if (seen.has(w.text_uthmani)) continue;
      seen.add(w.text_uthmani);
      distractors.push(w.text_uthmani);
      if (distractors.length === 3) break;
    }
  }
  return { from, to, correct, options: [correct, ...distractors] };
}
