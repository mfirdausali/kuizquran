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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

describe("lib/macro/facts.ts's own header does not describe the compiler emission as pending", () => {
  it("never frames meta.macro as a future one-line change the compiler has not made yet", () => {
    const factsPath = fileURLToPath(
      new URL("../lib/macro/facts.ts", import.meta.url),
    );
    const factsSrc = readFileSync(factsPath, "utf8");
    // Built from two words joined at runtime so this assertion's own
    // declaration can never accidentally satisfy the pattern it forbids.
    const whenPhrase = ["WHEN", "THE COMPILER EMITS"].join(" ");
    expect(factsSrc).not.toMatch(
      new RegExp(`${whenPhrase}[\\s\\S]{0,160}one-line change`, "i"),
    );
    expect(factsSrc).not.toMatch(/optional today,\s*authoritative tomorrow/i);
  });

  it("agreement, not wording: the compiler genuinely emits meta.macro unconditionally today", () => {
    const buildCorpusPath = fileURLToPath(
      new URL(
        "../../../packages/corpus-compiler/src/buildCorpus.ts",
        import.meta.url,
      ),
    );
    const buildCorpusSrc = readFileSync(buildCorpusPath, "utf8");
    // The real production of `meta.macro` — `classify(...)` assigned to a
    // `macro` const, unconditionally, then spread into the returned `meta`
    // object with no guard. If a future change made this conditional again,
    // this half of the guard (not the wording check above) is what would
    // catch it.
    expect(buildCorpusSrc).toMatch(/const macro = classify\(/);
    expect(buildCorpusSrc).toMatch(/\bmacro,/);

    const typesPath = fileURLToPath(
      new URL("../../../packages/corpus-compiler/src/types.ts", import.meta.url),
    );
    const typesSrc = readFileSync(typesPath, "utf8");
    // Required, not optional — `macro?:` would mean the compiler itself
    // still treats emission as conditional.
    expect(typesSrc).toMatch(/\n\s*macro: MacroFacts;/);
  });
});
