// WHERE MacroFacts COMES FROM, ON THE SERVER.
//
// ---------------------------------------------------------------------------
// THE ARRANGEMENT, AND THE BLOCKER IT WORKS AROUND HONESTLY
// ---------------------------------------------------------------------------
// v3-D21 classifies a surah by FOUR archetypes, and two of the four rules need
// inputs the compiled corpus does not carry today:
//
//     RING   — ruku >= 4                    (needs a ruku count)
//     LITANY — dominant rhyme >= 70%, or a verbatim refrain
//                                           (needs a rhyme profile)
//
// `Corpus.meta` (engine/types.ts:65) is `{ surah, ayahCount, wordCount }`. No
// ruku, no rhyme profile, no refrain — a repo-wide search for those finds only
// distractor `why` prose, which is compile-time-only and stripped from the
// learner artifact (edge case #21).
//
// The consequence matters more than it looks: with those inputs missing, only
// ATOMIC (`ayahCount <= 8`) is decidable, so EVERY non-ATOMIC surah falls
// through to ARC. That is a classifier which always returns its default while
// wearing the costume of one that classifies — the three RING surahs and two
// LITANY surahs v3-D21 measured would silently render as ARC, and nobody would
// notice, because ARC is a plausible-looking panel.
//
// SO THIS MODULE DOES NOT PRETEND. It calls the real classifier with the
// inputs that genuinely exist, and passes `rukuCount`/`rhymeClasses` ONLY when
// the corpus actually carries them. `classify()` is written so a missing input
// can never SATISFY a rule (an absent ruku count is 0, and 0 >= 4 is false), so
// an unclassifiable surah lands on ARC — where `authored: false` makes the
// panel say out loud that its structure is derived.
//
// WHEN THE COMPILER EMITS `meta.macro` (corpus-compiler/src/macro.ts, already
// written and tested), this module reads it directly and the fallback below
// stops being reachable. That is the one-line change; nothing else moves.

import type { Corpus } from "@engine/types.ts";
import { classify } from "../../../../packages/corpus-compiler/src/macro.ts";
import type { MacroFacts } from "@/components/macro/facts.ts";

/** The shape a compiled corpus will carry once the compiler's `meta.macro`
 *  emission ships. Optional today, authoritative tomorrow. */
type CorpusWithMacro = Corpus & {
  meta: Corpus["meta"] & {
    macro?: MacroFacts;
    /** Tanzil ruku count — the numbering basis edge case #13 already locks. */
    rukuCount?: number;
    /** Per-ayah rhyme class ids (transliterated, never Arabic). */
    rhymeClasses?: string[];
  };
};

/**
 * MacroFacts for one surah.
 *
 * Prefers the compiler's own emission when present — the compiler is the
 * authority, and re-deriving here would be a second place for the thresholds
 * to live. Falls back to classifying from whatever structural inputs the
 * corpus carries.
 */
export function macroFactsFor(corpus: Corpus): MacroFacts {
  const meta = (corpus as CorpusWithMacro).meta;

  // The compiled artifact already decided. Use it verbatim.
  if (meta.macro) return meta.macro;

  return classify({
    ayahCount: meta.ayahCount,
    // Passed only when real. `classify` treats absent as 0, and 0 never
    // satisfies `>= 4` — a missing input must not manufacture a RING.
    rukuCount: meta.rukuCount,
    rhymeClasses: meta.rhymeClasses,
    // The refrain check compares verse text for EQUALITY only; it never
    // stores or emits a glyph. Corpus data at runtime (Absolute B).
    verseTexts: corpus.verses.map((v) => v.text_uthmani),
  }) as MacroFacts;
}
