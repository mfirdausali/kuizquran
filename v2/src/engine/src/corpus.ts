// Corpus indexing helpers. Pure — takes a parsed Corpus object (the app loads
// public/corpus.json and passes it in; the engine never does IO).

import type { Corpus, CorpusDistractor, CorpusWord, GlossLang } from "./types.ts";

/** Words of one ayah, sorted by reading position. */
export function ayahWords(corpus: Corpus, ayah: number): CorpusWord[] {
  return corpus.words
    .filter((w) => w.ayah === ayah)
    .sort((a, b) => a.position - b.position);
}

/**
 * The gloss text for a word in the learner's chosen language (v2-D27):
 * `gloss[lang] ?? gloss.en ?? text_uthmani`. MS is currently unsourced for
 * most words (null), so it falls through to EN — the same chain every
 * gloss-based question must honor, never a hardcoded `.en`.
 */
export function wordGloss(word: CorpusWord, lang: GlossLang = "en"): string {
  return word.gloss[lang] ?? word.gloss.en ?? word.text_uthmani;
}

/** Ranked distractor row for one word (sorted by rank ascending). */
export function distractorsFor(
  corpus: Corpus,
  ayah: number,
  position: number,
): CorpusDistractor[] {
  return corpus.distractors
    .filter((d) => d.ayah === ayah && d.position === position)
    .sort((a, b) => a.rank - b.rank);
}
