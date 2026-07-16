// Corpus indexing helpers. Pure — takes a parsed Corpus object (the app loads
// public/corpus.json and passes it in; the engine never does IO).

import type { Corpus, CorpusDistractor, CorpusWord } from "./types.ts";

/** Words of one ayah, sorted by reading position. */
export function ayahWords(corpus: Corpus, ayah: number): CorpusWord[] {
  return corpus.words
    .filter((w) => w.ayah === ayah)
    .sort((a, b) => a.position - b.position);
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
