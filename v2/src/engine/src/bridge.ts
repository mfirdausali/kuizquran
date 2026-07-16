// S4 bridge (FR2). After ayah n's whole-bank (S3) completes, the bridge
// introduces ayah n+1's OPENING vocab as meaning items ("what comes next?"),
// and BIRTHS the connection atom n→n+1. Pure.

import type { Corpus, CorpusWord, DrillItem, GlossLang } from "./types.ts";
import { ayahWords, wordGloss } from "./corpus.ts";
import { atomKey, initAtom, type AtomState } from "./atom.ts";

/** How many opening words of the next ayah the bridge probes. */
export const BRIDGE_OPENING_COUNT = 3;

/** The opening words of ayah n+1 (first BRIDGE_OPENING_COUNT, reading order). */
export function nextOpening(corpus: Corpus, fromAyah: number): CorpusWord[] {
  return ayahWords(corpus, fromAyah + 1).slice(0, BRIDGE_OPENING_COUNT);
}

/**
 * Build the S4 bridge meaning items for ayah n → n+1. Each item probes one of
 * n+1's opening words with a gloss MCQ (correct gloss in the learner's chosen
 * language, v2-D27, + 3 sibling-gloss distractors drawn from the SAME opening
 * set + a couple of n's own words for near context). Deterministic order.
 */
export function bridgeItems(
  corpus: Corpus,
  fromAyah: number,
  lang: GlossLang = "en",
): Extract<DrillItem, { rung: "S4" }>[] {
  const opening = nextOpening(corpus, fromAyah);
  const toAyah = fromAyah + 1;
  // Distractor gloss pool: the opening words' glosses + the from-ayah's last words.
  const pool = [
    ...opening.map((w) => wordGloss(w, lang)),
    ...ayahWords(corpus, fromAyah)
      .slice(-4)
      .map((w) => wordGloss(w, lang)),
  ];

  return opening.map((word, i) => {
    const correct = wordGloss(word, lang);
    const distractors: string[] = [];
    const seen = new Set<string>([correct]);
    for (const g of pool) {
      if (seen.has(g)) continue;
      seen.add(g);
      distractors.push(g);
      if (distractors.length === 3) break;
    }
    return {
      rung: "S4" as const,
      fromAyah,
      toAyah,
      word,
      nextOpening: opening,
      options: [correct, ...distractors],
      correct,
      index: i + 1,
      total: opening.length,
    };
  });
}

/**
 * Birth the connection atom for n→n+1 into an atoms map (ref = the `from` ayah).
 * Idempotent — if it already exists, returns the existing one unchanged.
 */
export function birthConnection(atoms: Map<string, AtomState>, fromAyah: number): AtomState {
  const key = atomKey("connection", fromAyah);
  let a = atoms.get(key);
  if (!a) {
    a = initAtom("connection", fromAyah);
    atoms.set(key, a);
  }
  return a;
}
