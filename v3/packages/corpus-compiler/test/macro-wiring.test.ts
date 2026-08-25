// v3-D21's classifier (macro.ts) was built and unit-tested (macro.test.ts)
// but nothing ever called it — v3-D43 named this explicitly: "only ATOMIC
// was decidable... every non-ATOMIC surah would silently fall to ARC."
// apps/web's `lib/macro/facts.ts` already has a documented, deliberate
// fallback for exactly this gap ("WHEN THE COMPILER EMITS meta.macro...
// this module reads it directly and the fallback below stops being
// reachable") but the compiler side of that sentence was never built.
//
// This file proves the wiring: buildCorpus() now calls classify() with the
// ayah count (always available) and a vendored ruku count (when the
// surah has one — data/raw/<surah>-ruku.json), and stamps the result on
// CorpusMeta.macro.
//
// Synthetic ASCII fixtures only — never Quranic Arabic (v3/INVARIANTS.md
// Absolute B). `text_uthmani` values are placeholder tokens, never real
// script.

import { describe, expect, it } from "vitest";
import { buildCorpus } from "../src/buildCorpus.ts";
import { buildFromInputs, loadInputs } from "../src/io.ts";
import type { RawVerse } from "../src/types.ts";

function fixtureVerses(ayahCount: number): RawVerse[] {
  const out: RawVerse[] = [];
  for (let ayah = 1; ayah <= ayahCount; ayah++) {
    out.push({
      verse_number: ayah,
      text_uthmani: `placeholder-verse-${ayah}`,
      words: [{ position: 1, text_uthmani: `placeholder-${ayah}-1`, translation: `gloss-${ayah}` }],
    });
  }
  return out;
}

describe("buildCorpus — meta.macro (v3-D21 classification, wired at last)", () => {
  it("degrades to ARC with authored:false when no ruku count is supplied (unchanged prior behaviour)", () => {
    const corpus = buildCorpus({
      surah: 999,
      verses: fixtureVerses(30),
      mcqItems: [],
      morph: new Map(),
      generatedFrom: ["fixture"],
    });
    expect(corpus.meta.macro.archetype).toBe("ARC");
    expect(corpus.meta.macro.authored).toBe(false);
  });

  it("classifies ATOMIC for a short surah regardless of ruku count", () => {
    const corpus = buildCorpus({
      surah: 999,
      verses: fixtureVerses(3),
      mcqItems: [],
      morph: new Map(),
      rukuCount: 12,
      generatedFrom: ["fixture"],
    });
    expect(corpus.meta.macro.archetype).toBe("ATOMIC");
  });

  it("classifies RING when a real ruku count of 4+ is supplied for a long surah", () => {
    const corpus = buildCorpus({
      surah: 999,
      verses: fixtureVerses(30),
      mcqItems: [],
      morph: new Map(),
      rukuCount: 12,
      generatedFrom: ["fixture"],
    });
    expect(corpus.meta.macro.archetype).toBe("RING");
    expect(corpus.meta.macro.ring?.rukuCount).toBe(12);
  });

  it("a ruku count under the threshold does not manufacture RING (falls through to ARC without rhyme data)", () => {
    const corpus = buildCorpus({
      surah: 999,
      verses: fixtureVerses(30),
      mcqItems: [],
      morph: new Map(),
      rukuCount: 2,
      generatedFrom: ["fixture"],
    });
    expect(corpus.meta.macro.archetype).toBe("ARC");
  });
});

describe("loadInputs — vendored ruku count (data/raw/<surah>-ruku.json)", () => {
  it("loads surah 12's real vendored ruku count and it satisfies RING", () => {
    const inp = loadInputs(12);
    expect(inp.rukuCount).toBe(12);
    const corpus = buildFromInputs(inp);
    expect(corpus.meta.macro.archetype).toBe("RING");
  });

  it("loads surah 103's vendored ruku count (1) — irrelevant, ATOMIC wins first anyway", () => {
    const inp = loadInputs(103);
    expect(inp.rukuCount).toBe(1);
    const corpus = buildFromInputs(inp);
    expect(corpus.meta.macro.archetype).toBe("ATOMIC");
  });

  it("surah 67's vendored ruku count (2) is below the RING threshold, so it degrades honestly to ARC without rhyme data", () => {
    // Proves the optional field threads all the way through the real
    // pipeline even when its value alone would not manufacture RING — a
    // missing OR a too-small ruku count must both fail to satisfy the rule.
    const inp = loadInputs(67);
    expect(inp.rukuCount).toBe(2);
    const corpus = buildFromInputs(inp);
    expect(corpus.meta.macro.archetype).toBe("ARC");
    expect(corpus.meta.macro.authored).toBe(false);
  });
});
