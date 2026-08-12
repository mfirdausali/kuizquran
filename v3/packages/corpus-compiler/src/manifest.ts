// Build-plan step 4: content-addressed corpus files (16-hex) + a manifest
// that carries BUILD FACTS ONLY — schemaVersion, hashSpecVersion, counts,
// the content hash. Review/frontier state (verified counts, qari sign-off)
// is served at runtime from the Laravel API, never baked into this static
// file (v3-D22, edge case #30: "verifiedFrontier/glossMs in static manifest
// go stale — B3 one layer up").
//
// Per-ayah tiered hashes (v3-D13) are built here too, from the already
// tiered hash.ts primitives, and are ALSO a compile-time-only artifact.

import { contentHash16, ayahAdminHash, ayahAdminHashWithOverrides, ayahQariHash, ayahQariHashWithOverrides } from "./hash.ts";
import type { HashOverride } from "./hash.ts";
import type { CorpusJson } from "./types.ts";

export interface AyahHashRow {
  ayah: number;
  qariHash: string;
  adminHash: string;
  hashSpecVersion: number;
}

/** Sort key used everywhere a distractor/word list is grouped by ayah —
 * kept in one place so the compiler and any future consumer agree on
 * iteration order (irrelevant to hash content, since hash.ts sorts its own
 * inputs, but relevant to output determinism). */
function groupByAyah<T extends { ayah: number }>(rows: T[]): Map<number, T[]> {
  const m = new Map<number, T[]>();
  for (const r of rows) {
    const list = m.get(r.ayah) ?? [];
    list.push(r);
    m.set(r.ayah, list);
  }
  return m;
}

/** One row per compiled ayah, in verse order. */
export function buildAyahHashTable(corpus: CorpusJson): AyahHashRow[] {
  const wordsByAyah = groupByAyah(corpus.words);
  const distractorsByAyah = groupByAyah(corpus.distractors);
  const sceneBeatByAyah = new Map<number, string>();
  for (const sb of corpus.sceneBeats) {
    for (const ayah of sb.ayahs) sceneBeatByAyah.set(ayah, sb.label);
  }

  return corpus.verses.map((v) => ({
    ayah: v.ayah,
    qariHash: ayahQariHash(v, wordsByAyah.get(v.ayah) ?? [], sceneBeatByAyah.get(v.ayah) ?? null),
    adminHash: ayahAdminHash(distractorsByAyah.get(v.ayah) ?? []),
    hashSpecVersion: corpus.meta.hashSpecVersion,
  }));
}

/**
 * Same table, override-aware (DEFECTS.md#B3's named live gap: "the LIVE
 * wiring that automatically re-runs corpus:ingest-hashes with an
 * override-aware recompute the moment an override is written"). This is
 * that recompute's actual composition — `ayahQariHash`/`ayahAdminHash`
 * were already tiered (B3's first fix); `*WithOverrides` (v3-D34) already
 * resolved overrides into the tier that changes; nothing had assembled the
 * per-surah TABLE those functions feed, which is what Laravel actually
 * needs to re-ingest. With an empty override list this is byte-identical
 * to `buildAyahHashTable` — asserted directly in the test, so this can
 * never silently drift from the baseline path.
 */
export function buildAyahHashTableWithOverrides(corpus: CorpusJson, overrides: HashOverride[]): AyahHashRow[] {
  const wordsByAyah = groupByAyah(corpus.words);
  const distractorsByAyah = groupByAyah(corpus.distractors);
  const sceneBeatByAyah = new Map<number, string>();
  for (const sb of corpus.sceneBeats) {
    for (const ayah of sb.ayahs) sceneBeatByAyah.set(ayah, sb.label);
  }

  return corpus.verses.map((v) => ({
    ayah: v.ayah,
    qariHash: ayahQariHashWithOverrides(v, wordsByAyah.get(v.ayah) ?? [], sceneBeatByAyah.get(v.ayah) ?? null, overrides),
    adminHash: ayahAdminHashWithOverrides(distractorsByAyah.get(v.ayah) ?? [], overrides),
    hashSpecVersion: corpus.meta.hashSpecVersion,
  }));
}

/** The exact bytes this compiler writes for a corpus file — content
 * addressing hashes THESE bytes, so the filename and the file always agree. */
export function serializeCorpus(corpus: CorpusJson): string {
  return JSON.stringify(corpus, null, 2) + "\n";
}

/** 16-hex content hash of the serialized corpus (edge case #27: 16-hex
 * filenames avoid hash8-class collisions under an immutable cache). Text
 * fields are NFC-canonicalized before hashing is unnecessary here — the
 * corpus is hashed as the exact bytes written to disk, byte-identical
 * recompiles must produce byte-identical files. Canonicalization matters
 * for the tiered verification hashes (hash.ts), not this file hash. */
export function corpusContentHash16(corpus: CorpusJson): string {
  return contentHash16(serializeCorpus(corpus));
}

export function contentAddressedFilename(corpus: CorpusJson): string {
  return `corpus.${corpusContentHash16(corpus)}.json`;
}

export interface ManifestEntry {
  surah: number;
  schemaVersion: number;
  hashSpecVersion: number;
  corpusHash: string;
  /** Path relative to the manifest's own directory. */
  corpusPath: string;
  hashesPath: string;
  ayahCount: number;
  wordCount: number;
  hasGeometry: boolean;
  distractorsAuthored: boolean;
  hasMentalModel: boolean;
  generatedFrom: string[];
}

export function corpusManifestEntry(corpus: CorpusJson): ManifestEntry {
  const surah = corpus.meta.surah;
  return {
    surah,
    schemaVersion: corpus.meta.schemaVersion,
    hashSpecVersion: corpus.meta.hashSpecVersion,
    corpusHash: corpusContentHash16(corpus),
    corpusPath: `${surah}/${contentAddressedFilename(corpus)}`,
    hashesPath: `${surah}/hashes.json`,
    ayahCount: corpus.meta.ayahCount,
    wordCount: corpus.meta.wordCount,
    hasGeometry: corpus.meta.hasGeometry,
    distractorsAuthored: corpus.meta.distractorsAuthored,
    hasMentalModel: corpus.meta.hasMentalModel,
    generatedFrom: corpus.meta.generatedFrom,
  };
}

export interface Manifest {
  surahs: Record<string, ManifestEntry>;
}

/** Merge one surah's entry into a manifest, replacing that surah's own
 * entry (recompile) and leaving every other surah's entry untouched
 * (edge case #28: "partial recompile bricks a surah" is exactly what this
 * function must never do — one surah's compile never disturbs another's). */
export function mergeManifest(existing: Manifest, entry: ManifestEntry): Manifest {
  return {
    surahs: {
      ...existing.surahs,
      [String(entry.surah)]: entry,
    },
  };
}
