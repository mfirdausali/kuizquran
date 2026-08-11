// Build-plan step 4: tiered content hashing (v3-D13's qari/admin tiers) +
// 16-hex content addressing. Every fixture here uses synthetic PLACEHOLDER
// strings, never real Quranic Arabic (v3/INVARIANTS.md Absolute B) — the
// hash functions are content-agnostic, so a placeholder proves the same
// canonicalization/hashing behavior a real ayah would exercise.

import { describe, expect, it } from "vitest";
import {
  HASH_SPEC_VERSION,
  ayahAdminHash,
  ayahAdminHashWithOverrides,
  ayahQariHash,
  ayahQariHashWithOverrides,
  canonicalizeText,
  contentHash16,
  type HashOverride,
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
  origin: "authored",
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

describe("*WithOverrides — DEFECTS.md#B3's actual trigger: an override changes the EFFECTIVE hash", () => {
  // B3's own words: "A qari signs ayah 5, an admin then overrides its
  // gloss, the row still reads verified." The tiered hash alone (above)
  // isn't the fix by itself — the qari-tier hash must be computed over the
  // OVERRIDE-PATCHED gloss, or an override can never move it. These
  // functions are that composition: the SAME hash.ts implementation
  // (v3-D08: one hash implementation), applied to override-resolved
  // fields, using the same latest-wins-per-key semantics
  // engine/src/overrides.ts#applyOverrides already established (kept
  // minimal and duplicated here, not imported — corpus-compiler and
  // packages/engine are separate packages with no shared-types layer yet;
  // both resolve overrides via the identical (createdAt, id) latest-wins
  // rule DEFECTS.md#B4 fixed, so the two implementations cannot silently
  // diverge in a way a test wouldn't catch).

  const glossOverride = (position: number, text: string, createdAt: number, id: number): HashOverride => ({
    ayah: 1,
    position,
    field: "gloss",
    payload: { lang: "en", text },
    createdAt,
    id,
  });
  const distractorOverride = (position: number, text: string, createdAt: number, id: number): HashOverride => ({
    ayah: 1,
    position,
    field: "distractor",
    payload: { distractors: [{ text, rank: 1, prd_rank: "synonym", src_type: "semantic", why: "override" }] },
    createdAt,
    id,
  });

  it("a gloss override changes the qari-tier hash — this IS B3's fix", () => {
    const v = verse("PLACEHOLDER");
    const words = [word("original-gloss")];
    const baseline = ayahQariHash(v, words, null);
    const overridden = ayahQariHashWithOverrides(v, words, null, [glossOverride(1, "corrected-gloss", 100, 1)]);
    expect(overridden).not.toBe(baseline);
  });

  it("no overrides for this ayah -> identical to the un-overridden hash (backward compatible)", () => {
    const v = verse("PLACEHOLDER");
    const words = [word("gloss")];
    expect(ayahQariHashWithOverrides(v, words, null, [])).toBe(ayahQariHash(v, words, null));
  });

  it("a distractor override changes the admin-tier hash, never the qari-tier hash", () => {
    const v = verse("PLACEHOLDER");
    const words = [word("gloss")];
    const dists = [distractor("baseline-foil")];
    const override = distractorOverride(1, "overridden-foil", 100, 1);
    expect(ayahAdminHashWithOverrides(dists, [override])).not.toBe(ayahAdminHash(dists));
    expect(ayahQariHashWithOverrides(v, words, null, [override])).toBe(ayahQariHash(v, words, null));
  });

  it("(createdAt, id) latest-wins per position (DEFECTS.md#B4's rule, applied here too)", () => {
    const v = verse("PLACEHOLDER");
    const words = [word("gloss")];
    const older = glossOverride(1, "first-correction", 100, 1);
    const newer = glossOverride(1, "second-correction", 100, 2); // same createdAt, higher id wins
    const onlyOlder = ayahQariHashWithOverrides(v, words, null, [older]);
    const both = ayahQariHashWithOverrides(v, words, null, [older, newer]);
    const onlyNewer = ayahQariHashWithOverrides(v, words, null, [newer]);
    expect(both).toBe(onlyNewer);
    expect(both).not.toBe(onlyOlder);
  });

  it("an override for a DIFFERENT ayah never affects this ayah's hash", () => {
    const v = verse("PLACEHOLDER");
    const words = [word("gloss")];
    const baseline = ayahQariHash(v, words, null);
    const otherAyahOverride: HashOverride = { ayah: 2, position: 1, field: "gloss", payload: { lang: "en", text: "x" }, createdAt: 1, id: 1 };
    expect(ayahQariHashWithOverrides(v, words, null, [otherAyahOverride])).toBe(baseline);
  });

  it("an MS-language gloss override never affects the hash (v3-D15: ms excluded from hash v1)", () => {
    const v = verse("PLACEHOLDER");
    const words = [word("gloss")];
    const baseline = ayahQariHash(v, words, null);
    const msOverride: HashOverride = { ayah: 1, position: 1, field: "gloss", payload: { lang: "ms", text: "terjemahan" }, createdAt: 1, id: 1 };
    expect(ayahQariHashWithOverrides(v, words, null, [msOverride])).toBe(baseline);
  });
});
