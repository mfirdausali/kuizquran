// RED before green (v3/CLAUDE.md rule 3): this file is committed and run
// failing (buildTestItems/itemAyah/ayahSnippet do not exist yet) before
// `lib/test/build.ts` is implemented.
//
// NO ARABIC. Every Arabic byte asserted on here is read back OUT of the real
// compiled corpus at runtime (`ayahWords`/`.text_uthmani`), never a literal —
// same discipline as `lib/session/run.test.ts`'s own header.

import { describe, expect, it, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Corpus } from "@engine/types.ts";
import { ayahWords } from "@engine/corpus.ts";

import { buildTestItems, itemAyah, ayahSnippet, type Shuffle } from "./build";

const HERE = dirname(fileURLToPath(import.meta.url));
const SURAH = 112;
const STAGED = resolve(HERE, "../../public/corpus/112.json");
const COMPILED = resolve(HERE, "../../../../packages/corpus-compiler/output/112/corpus.json");

let corpus: Corpus;

beforeAll(() => {
  const path = existsSync(STAGED) ? STAGED : COMPILED;
  if (!existsSync(path)) {
    throw new Error(`No 112 corpus at ${STAGED} or ${COMPILED}. Run \`make compile-corpus\`.`);
  }
  corpus = JSON.parse(readFileSync(path, "utf8")) as Corpus;
});

/** Deterministic: reverses the array. Proves buildTestItems actually USES the
 *  injected shuffle (rather than silently reaching for Math.random) — a
 *  reversed pool must change which ayah lands on which kind. */
const reverseShuffle: Shuffle = (items) => items.slice().reverse();
const identityShuffle: Shuffle = (items) => items.slice();

describe("buildTestItems", () => {
  it("returns an empty Test for an empty pool", () => {
    expect(buildTestItems(corpus, SURAH, [], "en", identityShuffle)).toEqual([]);
  });

  it("cycles vocab/cloze/junction/locate/produce across the pool, in order", () => {
    // 112 has 4 ayat, so a pool [1,2,3,4] never reaches ITEM_COUNT=6 — every
    // ayah gets exactly one kind, cycling KIND_ORDER, plus one appended
    // reorder item at the end (before the final shuffle).
    const items = buildTestItems(corpus, SURAH, [1, 2, 3, 4], "en", identityShuffle);
    const kinds = items.map((i) => i.kind);
    expect(kinds).toEqual(["vocab", "cloze", "junction", "locate", "reorder"]);
  });

  it("degrades a junction request on the range's LAST ayah to cloze (no n+1 to ask about)", () => {
    // Pool of exactly 3 puts "junction" (index 2 of KIND_ORDER) on the pool's
    // own last element, which for a pool ending at ayahCount has no n+1.
    const lastAyah = corpus.meta.ayahCount;
    const pool = [lastAyah - 2, lastAyah - 1, lastAyah];
    const items = buildTestItems(corpus, SURAH, pool, "en", identityShuffle);
    const junctionSlot = items[2]!;
    expect(junctionSlot.kind).toBe("cloze");
    expect((junctionSlot as { ayah: number }).ayah).toBe(lastAyah);
  });

  it("never emits a junction item whose `from` has no successor", () => {
    const items = buildTestItems(corpus, SURAH, [1, 2, 3, 4], "en", identityShuffle);
    for (const item of items) {
      if (item.kind === "junction") {
        expect(item.from + 1).toBeLessThanOrEqual(corpus.meta.ayahCount);
      }
    }
  });

  it("appends a reorder item over the pool's own ascending range when it spans >= 2 ayat", () => {
    const items = buildTestItems(corpus, SURAH, [1, 2, 3, 4], "en", identityShuffle);
    const reorder = items.find((i) => i.kind === "reorder");
    expect(reorder).toBeDefined();
    if (reorder?.kind === "reorder") {
      expect(reorder.ayahs.length).toBeGreaterThanOrEqual(2);
      expect(reorder.ayahs[0]).toBe(1);
      // Strictly ascending reading order — this is what a learner reorders BACK into.
      for (let i = 1; i < reorder.ayahs.length; i++) {
        expect(reorder.ayahs[i]).toBe(reorder.ayahs[i - 1]! + 1);
      }
    }
  });

  it("never appends a reorder item over a single-ayah pool", () => {
    const items = buildTestItems(corpus, SURAH, [1], "en", identityShuffle);
    expect(items.some((i) => i.kind === "reorder")).toBe(false);
  });

  it("actually uses the injected shuffle — a reversed pool changes the assignment", () => {
    const forward = buildTestItems(corpus, SURAH, [1, 2, 3, 4], "en", identityShuffle);
    const reversed = buildTestItems(corpus, SURAH, [1, 2, 3, 4], "en", reverseShuffle);
    // Both cycle the same KIND_ORDER, but "vocab" (slot 0) is built from a
    // DIFFERENT ayah in each — 1 forward, 4 reversed.
    const forwardVocab = forward.find((i) => i.kind === "vocab") as { ayah: number };
    const reversedVocab = reversed.find((i) => i.kind === "vocab") as { ayah: number };
    expect(forwardVocab.ayah).toBe(1);
    expect(reversedVocab.ayah).toBe(4);
  });

  it("caps the mixed portion at 6 items even over a larger pool", () => {
    // 112 only has 4 ayat, so exercise the cap structurally instead — a pool
    // repeated past ITEM_COUNT still yields at most 6 mixed items (+1 reorder).
    const bigPool = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2];
    const items = buildTestItems(corpus, SURAH, bigPool, "en", identityShuffle);
    const mixed = items.filter((i) => i.kind !== "reorder");
    expect(mixed.length).toBe(6);
  });
});

describe("itemAyah", () => {
  it("reads a junction item's `from`, never `to`", () => {
    const items = buildTestItems(corpus, SURAH, [1, 2], "en", identityShuffle);
    const junction = items.find((i) => i.kind === "junction");
    if (junction?.kind === "junction") {
      expect(itemAyah(junction)).toBe(junction.from);
      expect(itemAyah(junction)).not.toBe(junction.to);
    }
  });

  it("reads a reorder item's FIRST ayah", () => {
    const items = buildTestItems(corpus, SURAH, [1, 2, 3, 4], "en", identityShuffle);
    const reorder = items.find((i) => i.kind === "reorder");
    if (reorder?.kind === "reorder") {
      expect(itemAyah(reorder)).toBe(reorder.ayahs[0]);
    }
  });

  it("reads every other kind's own `ayah` field", () => {
    const items = buildTestItems(corpus, SURAH, [1, 2, 3, 4], "en", identityShuffle);
    for (const item of items) {
      if (item.kind !== "junction" && item.kind !== "reorder") {
        expect(itemAyah(item)).toBe(item.ayah);
      }
    }
  });
});

describe("ayahSnippet", () => {
  it("reads real corpus bytes back out — never a literal", () => {
    const words = ayahWords(corpus, 1);
    const expected = words
      .slice(0, 4)
      .map((w) => w.text_uthmani)
      .join(" ");
    expect(ayahSnippet(corpus, 1)).toBe(expected);
  });

  it("respects a shorter word-count cap", () => {
    const words = ayahWords(corpus, 1);
    const expected = words
      .slice(0, 2)
      .map((w) => w.text_uthmani)
      .join(" ");
    expect(ayahSnippet(corpus, 1, 2)).toBe(expected);
  });
});
