// Build-plan step 4: tiered content hashing (v3-D13's qari/admin tiers) +
// 16-hex content addressing. Every fixture here uses synthetic PLACEHOLDER
// strings, never real Quranic Arabic (v3/INVARIANTS.md Absolute B) — the
// hash functions are content-agnostic, so a placeholder proves the same
// canonicalization/hashing behavior a real ayah would exercise.

import { describe, expect, it } from "vitest";
import {
  HASH_SPEC_VERSION,
  ayahAdminHash,
  ayahQariHash,
  canonicalizeText,
  contentHash16,
} from "../src/hash.ts";
import type { Distractor, Verse, Word } from "../src/types.ts";

const verse = (text: string): Verse => ({ surah: 999, ayah: 1, text_uthmani: text, page: null });
const word = (en: string): Word => ({
  surah: 999,
  ayah: 1,
  position: 1,
  text_uthmani: "PLACEHOLDER",
  lemma: null,
  root: null,
  class: null,
  gloss: { en, ms: null, ja: null },
  act: null,
  sceneImage: null,
  line: null,
});
const distractor = (text: string): Distractor => ({
  surah: 999,
  ayah: 1,
  position: 1,
  rank: 1,
  text,
  prd_rank: "synonym",
  src_type: "semantic",
  why: "placeholder rationale",
});

describe("canonicalizeText — NFC normalization (edge case #18: combining-mark fixtures)", () => {
  it("precomposed and decomposed forms of the same character canonicalize identically", () => {
    // "é" precomposed (U+00E9) vs "e" + combining acute accent (U+0065 U+0301).
    // Deliberately Latin, never Arabic — proves the same NFC code path a real
    // ayah's combining marks (e.g. harakat) would exercise, without touching
    // sacred text.
    const precomposed = "café";
    const decomposed = "café";
    expect(precomposed).not.toBe(decomposed); // distinct as raw strings
    expect(canonicalizeText(precomposed)).toBe(canonicalizeText(decomposed));
  });
});

describe("contentHash16 — 16-hex content addressing (edge case #27)", () => {
  it("returns exactly 16 lowercase hex characters", () => {
    const h = contentHash16("{\"a\":1}");
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic for identical input", () => {
    expect(contentHash16("same")).toBe(contentHash16("same"));
  });

  it("differs for different input", () => {
    expect(contentHash16("a")).not.toBe(contentHash16("b"));
  });
});

describe("tiered per-ayah hashes (v3-D13 / DEFECTS.md#B3)", () => {
  it("qari tier changes when verse text changes; admin tier does not", () => {
    const v1 = verse("PLACEHOLDER_ONE");
    const v2 = verse("PLACEHOLDER_TWO");
    const words = [word("gloss")];
    const dists = [distractor("foil")];
    expect(ayahQariHash(v1, words, null)).not.toBe(ayahQariHash(v2, words, null));
    expect(ayahAdminHash(dists)).toBe(ayahAdminHash(dists));
  });

  it("qari tier changes when a word's EN gloss changes", () => {
    const v = verse("PLACEHOLDER");
    const wordsA = [word("gloss-a")];
    const wordsB = [word("gloss-b")];
    expect(ayahQariHash(v, wordsA, null)).not.toBe(ayahQariHash(v, wordsB, null));
  });

  it("admin tier changes when distractors change; qari tier does not (B3's core fix)", () => {
    const v = verse("PLACEHOLDER");
    const words = [word("gloss")];
    const distsA = [distractor("foil-a")];
    const distsB = [distractor("foil-b")];
    expect(ayahAdminHash(distsA)).not.toBe(ayahAdminHash(distsB));
    expect(ayahQariHash(v, words, null)).toBe(ayahQariHash(v, words, null));
  });

  it("qari tier is stable under NFC-equivalent text variants (combining marks)", () => {
    const vPrecomposed = verse("café");
    const vDecomposed = verse("café");
    const words = [word("gloss")];
    expect(ayahQariHash(vPrecomposed, words, null)).toBe(ayahQariHash(vDecomposed, words, null));
  });

  it("HASH_SPEC_VERSION is a stable positive integer (edge case #26)", () => {
    expect(Number.isInteger(HASH_SPEC_VERSION)).toBe(true);
    expect(HASH_SPEC_VERSION).toBeGreaterThan(0);
  });
});
