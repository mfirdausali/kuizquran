// Build-plan step 4: manifest with per-surah schemaVersion (build facts
// only — DECISIONS.md v3-D13 / edge case #30 keeps review state server-side,
// never static) and content-addressed corpus filenames.

import { describe, expect, it } from "vitest";
import { loadInputs, buildFromInputs } from "../src/io.ts";
import { buildAyahHashTable, contentAddressedFilename, corpusManifestEntry, mergeManifest } from "../src/manifest.ts";

describe("content-addressed filenames (16-hex)", () => {
  it("embeds a 16-hex hash in the corpus filename", () => {
    const corpus = buildFromInputs(loadInputs(112));
    const name = contentAddressedFilename(corpus);
    expect(name).toMatch(/^corpus\.[0-9a-f]{16}\.json$/);
  });

  it("is deterministic — recompiling the same inputs yields the same filename", () => {
    const a = contentAddressedFilename(buildFromInputs(loadInputs(112)));
    const b = contentAddressedFilename(buildFromInputs(loadInputs(112)));
    expect(a).toBe(b);
  });

  it("differs across surahs with different content", () => {
    const a = contentAddressedFilename(buildFromInputs(loadInputs(103)));
    const b = contentAddressedFilename(buildFromInputs(loadInputs(112)));
    expect(a).not.toBe(b);
  });
});

describe("per-ayah tiered hash table", () => {
  it("has exactly ayahCount rows, each carrying hashSpecVersion", () => {
    const corpus = buildFromInputs(loadInputs(103));
    const table = buildAyahHashTable(corpus);
    expect(table).toHaveLength(corpus.meta.ayahCount);
    for (const row of table) {
      expect(row.hashSpecVersion).toBe(corpus.meta.hashSpecVersion);
      expect(row.qariHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.adminHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("row ayah numbers match the compiled verses, in order", () => {
    const corpus = buildFromInputs(loadInputs(103));
    const table = buildAyahHashTable(corpus);
    expect(table.map((r) => r.ayah)).toEqual(corpus.verses.map((v) => v.ayah));
  });
});

describe("manifest — build facts only, per-surah schemaVersion (edge case #28)", () => {
  it("a fresh manifest entry carries schemaVersion, hashSpecVersion, corpusHash and counts", () => {
    const corpus = buildFromInputs(loadInputs(112));
    const entry = corpusManifestEntry(corpus);
    expect(entry.surah).toBe(112);
    expect(entry.schemaVersion).toBe(corpus.meta.schemaVersion);
    expect(entry.hashSpecVersion).toBe(corpus.meta.hashSpecVersion);
    expect(entry.corpusHash).toMatch(/^[0-9a-f]{16}$/);
    expect(entry.corpusPath).toBe(`112/${contentAddressedFilename(corpus)}`);
    expect(entry.ayahCount).toBe(4);
    expect(entry.wordCount).toBe(15);
    // build facts only — no review/frontier state (v3-D22 serves that from
    // the API at runtime, never bakes it into a static file)
    expect(entry).not.toHaveProperty("verified");
    expect(entry).not.toHaveProperty("frontier");
  });

  it("merging one surah's entry into an existing manifest preserves other surahs (never clobbers)", () => {
    const ikhlas = corpusManifestEntry(buildFromInputs(loadInputs(112)));
    const alAsr = corpusManifestEntry(buildFromInputs(loadInputs(103)));

    const afterFirst = mergeManifest({ surahs: {} }, ikhlas);
    expect(Object.keys(afterFirst.surahs)).toEqual(["112"]);

    const afterSecond = mergeManifest(afterFirst, alAsr);
    expect(Object.keys(afterSecond.surahs).sort()).toEqual(["103", "112"]);
    expect(afterSecond.surahs["112"]).toEqual(ikhlas);
    expect(afterSecond.surahs["103"]).toEqual(alAsr);
  });

  it("recompiling the same surah replaces its own entry, not a new key", () => {
    const first = corpusManifestEntry(buildFromInputs(loadInputs(112)));
    const manifest = mergeManifest({ surahs: {} }, first);
    const second = corpusManifestEntry(buildFromInputs(loadInputs(112)));
    const updated = mergeManifest(manifest, second);
    expect(Object.keys(updated.surahs)).toEqual(["112"]);
  });
});
