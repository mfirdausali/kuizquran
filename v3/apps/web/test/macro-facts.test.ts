// `lib/macro/facts.ts#macroFactsFor` was written with a documented,
// deliberate fallback ("WHEN THE COMPILER EMITS meta.macro... this module
// reads it directly and the fallback below stops being reachable") — but
// the compiler side of that sentence had zero test coverage: nothing here
// proved the preference actually happens once meta.macro exists. The
// compiler now emits it unconditionally (`packages/corpus-compiler/src/
// buildCorpus.ts`), so this is the one-line change's own missing proof.
//
// Synthetic ASCII fixtures only — never Quranic Arabic (v3/INVARIANTS.md
// Absolute B).

import { describe, expect, it } from "vitest";
import type { Corpus } from "@engine/types.ts";
import type { MacroFacts } from "@/components/macro/facts.ts";
import { macroFactsFor } from "@/lib/macro/facts.ts";

function fixtureCorpus(overrides: Partial<Corpus["meta"]> = {}): Corpus {
  return {
    meta: { surah: 999, ayahCount: 30, wordCount: 60, ...overrides } as Corpus["meta"],
    verses: Array.from({ length: 30 }, (_, i) => ({
      ayah: i + 1,
      text_uthmani: `placeholder-verse-${i + 1}`,
      page: null,
      line: null,
    })),
    words: [],
    distractors: [],
    connections: [],
    lookalikes: [],
    sceneBeats: [],
  } as unknown as Corpus;
}

describe("macroFactsFor — prefers the compiler's own emission (v3-D43)", () => {
  it("returns meta.macro VERBATIM when the compiler already decided, never re-classifying", () => {
    const compiled: MacroFacts = {
      archetype: "RING",
      reason: "ruku=12",
      layout: "arc",
      authored: true,
      ring: { rukuCount: 12, segments: [{ from: 1, to: 30, label: null }] },
    };
    const corpus = fixtureCorpus({ macro: compiled } as Partial<Corpus["meta"]>);
    expect(macroFactsFor(corpus)).toBe(compiled); // same object — not a re-derived copy
  });

  it("falls back to classify() only when meta.macro is absent (pre-emission corpus, e.g. the frozen engine fixture)", () => {
    const corpus = fixtureCorpus(); // no `macro` key at all
    const facts = macroFactsFor(corpus);
    // No rukuCount/rhymeClasses on this fixture's meta either, so an
    // unclassifiable 30-ayah surah must degrade honestly to ARC — never a
    // silently-manufactured RING/LITANY from absent inputs.
    expect(facts.archetype).toBe("ARC");
    expect(facts.authored).toBe(false);
  });

  it("the fallback still resolves a genuine ATOMIC surah correctly when meta.macro is absent", () => {
    const corpus = fixtureCorpus({ ayahCount: 3, macro: undefined } as unknown as Partial<Corpus["meta"]>);
    // Shrink the verses array to match the overridden ayahCount.
    corpus.verses = corpus.verses.slice(0, 3);
    expect(macroFactsFor(corpus).archetype).toBe("ATOMIC");
  });
});
