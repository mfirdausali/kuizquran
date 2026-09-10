import type { CorpusWord } from "@engine/types.ts";

/**
 * A word's own mushaf line — "line N" — or null when there is nothing
 * honest to say.
 *
 * `CorpusWord.line` is computed at compile time
 * (`corpus-compiler/src/buildCorpus.ts#lineOf`, fed from vendored Tanzil
 * geometry: `data/raw/<surah>-geometry.json`) and shipped to the browser
 * verbatim — `stage-corpus.mjs#slim()`/`stripMorphology()` strips only
 * `lemma`/`root`/`class`, never `line`. Every one of this build's four
 * launch surahs has vendored geometry, so this is a REAL, populated integer
 * on every word the app currently serves, not a placeholder.
 *
 * Until this fix `CorpusWord` did not even declare the field, so nothing
 * anywhere could read it — the same "shipped, never declared on the
 * consuming type" shape as `CorpusDistractor.origin` (v3-D187) and
 * `Corpus.lookalikes` (v3-D181).
 *
 * Three inputs, two honest outcomes — never a fabricated "line 0" for a
 * surah with no geometry:
 *  - a real number  -> "line N"
 *  - null           -> a surah with no vendored geometry yet
 *  - undefined      -> an older corpus subset compiled before this field
 *                      existed at all (a shape older fixtures may still use)
 *
 * `typeof word.line === "number"`, deliberately, not `if (word.line)` — a
 * genuine mushaf line is never 0 in this build's vendored geometry, but the
 * check must not silently start treating one as absent if that ever changed.
 */
export function mushafLineLabel(word: CorpusWord): string | null {
  return typeof word.line === "number" ? `line ${word.line}` : null;
}
