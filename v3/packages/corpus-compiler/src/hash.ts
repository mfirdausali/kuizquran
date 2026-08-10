// Content hashing — build-plan step 4. ONE hash implementation (v3-D13 /
// edge case #18: "ONE hash implementation (TS: compiler + fold-runner);
// Laravel stores hash tables, never computes"). This module is that
// implementation's home for now; the fold-runner (M3) reuses it verbatim
// rather than re-deriving the spec.
//
// Two concerns, kept distinct:
//  - contentHash16: 16-hex content-addressed FILENAMES (edge case #27 —
//    "hash8 collision under immutable cache -> 16-hex filenames").
//  - ayahQariHash / ayahAdminHash: full-length verification hashes (v3-D13's
//    tiered hash), compared for equality, never used in a filename.
//
// Canonicalization: NFC-normalize every string before hashing (edge case
// #18 — "NFC/NFD + JSON canonicalization TS vs PHP -> hash flicker"). This
// is the same normalization class that matters for Arabic combining marks
// (harakat); it is exercised here with non-Quranic placeholder text only —
// see test/hash.test.ts's comment.

import { createHash } from "node:crypto";
import type { Distractor, Verse, Word } from "./types.ts";

/** Version of the canonicalization + hashing spec (edge case #26). Bump
 * whenever a hash's input shape changes; every per-ayah hash row carries
 * this alongside CorpusMeta.hashSpecVersion so a spec change is detectable
 * per-row, not just per-corpus. */
export const HASH_SPEC_VERSION = 1;

/** NFC-normalize a string for hashing/comparison. The one normalization
 * point every hash in this module routes through. */
export function canonicalizeText(s: string): string {
  return s.normalize("NFC");
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** 16-hex content hash for an immutable, cache-busting FILENAME. Not used
 * for verification comparison (see ayahQariHash/ayahAdminHash for that). */
export function contentHash16(canonicalJson: string): string {
  return sha256Hex(canonicalJson).slice(0, 16);
}

/** Qari tier (v3-D13): text_uthmani + glosses + scene beat label for one
 * ayah. Distractors and specs never enter this hash — churning them must
 * never amber a scholar's signature (DEFECTS.md#B3). gloss.ms is excluded
 * (v3-D15: EN-only launch, ms excluded from hash v1); gloss.ja likewise,
 * as unsourced. Absent-key handling (edge case #25): a word with no EN
 * gloss hashes as "" — an explicit canonical value, not an omitted key. */
export function ayahQariHash(verse: Verse, words: Word[], sceneBeatLabel: string | null): string {
  const payload = {
    text_uthmani: canonicalizeText(verse.text_uthmani),
    glosses: words
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((w) => canonicalizeText(w.gloss.en ?? "")),
    sceneBeatLabel: sceneBeatLabel ? canonicalizeText(sceneBeatLabel) : null,
  };
  return sha256Hex(JSON.stringify(payload));
}

/** Admin tier (v3-D13): distractors (+ specs, once specs exist — M3) for
 * one ayah. Never read by the qari-tier comparison. */
export function ayahAdminHash(distractors: Distractor[]): string {
  const payload = {
    distractors: distractors
      .slice()
      .sort((a, b) => a.position - b.position || a.rank - b.rank)
      .map((d) => ({
        position: d.position,
        rank: d.rank,
        text: canonicalizeText(d.text),
        prd_rank: d.prd_rank,
      })),
    // specs: [] — placeholder until M3's spec table lands; documented here
    // so a future spec addition is a visible diff to this function, not a
    // silent hash-shape change.
  };
  return sha256Hex(JSON.stringify(payload));
}

// ---- Override-aware hashing (DEFECTS.md#B3's actual trigger) ----
//
// The two functions above hash the BASELINE compiled corpus — they never
// move when an override lands, so pairing them with a verification row
// alone does not fix B3 ("a qari signs ayah 5, an admin then overrides its
// gloss, the row still reads verified"). These compose the same
// implementation with an override-resolved view of the ayah's qari/admin-
// tier fields. A minimal, LOCAL override resolver — not an import of
// engine/src/overrides.ts#applyOverrides, since corpus-compiler and
// packages/engine are separate packages with no shared-types layer yet.
// Both resolve "latest wins" via the identical (createdAt, id) rule
// DEFECTS.md#B4 fixed, so the two cannot silently diverge in a way a test
// wouldn't catch (packages/engine/test/b4-override-ties.test.ts covers the
// engine's own copy).

/** The hash-relevant subset of a Laravel `overrides` row — never the full
 *  wire shape (no `note`/`editorId`, irrelevant to what gets hashed). */
export interface HashOverride {
  ayah: number;
  position: number | null;
  field: "gloss" | "distractor" | "group" | "disable";
  payload: unknown;
  createdAt: number;
  id: number;
}

function latestPerKey(overrides: HashOverride[], field: HashOverride["field"]): Map<string, HashOverride> {
  const sorted = overrides
    .filter((o) => o.field === field)
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
  const latest = new Map<string, HashOverride>();
  for (const o of sorted) {
    if (o.position == null) continue;
    latest.set(`${o.ayah}:${o.position}`, o);
  }
  return latest;
}

/** Qari tier, override-aware: a `gloss` override for `lang: "en"` replaces
 *  that word's EN gloss before hashing. An `ms` override never touches the
 *  hash (v3-D15: ms excluded from hash v1). Overrides for a different ayah
 *  are ignored (defensive — callers should already filter by ayah). */
export function ayahQariHashWithOverrides(
  verse: Verse,
  words: Word[],
  sceneBeatLabel: string | null,
  overrides: HashOverride[],
): string {
  const ayah = verse.ayah;
  const glossLatest = latestPerKey(
    overrides.filter((o) => o.ayah === ayah),
    "gloss",
  );
  const patchedWords = words.map((w) => {
    const ov = glossLatest.get(`${w.ayah}:${w.position}`);
    if (!ov) return w;
    const payload = ov.payload as { lang?: string; text?: string } | null;
    if (payload?.lang !== "en" || typeof payload.text !== "string") return w;
    return { ...w, gloss: { ...w.gloss, en: payload.text } };
  });
  return ayahQariHash(verse, patchedWords, sceneBeatLabel);
}

/** Admin tier, override-aware: a `distractor` override REPLACES the full
 *  distractor set for that (ayah, position) — matching engine/src/
 *  overrides.ts#applyOverrides's own "full replacement set, not a merge"
 *  semantics for the same field kind. */
export function ayahAdminHashWithOverrides(distractors: Distractor[], overrides: HashOverride[]): string {
  // Ayah identity comes only from the baseline distractor rows themselves
  // (this function's signature carries no separate ayah param, matching
  // ayahAdminHash's own). An empty baseline array has no ayah to scope
  // to — fail safe by applying NO overrides rather than risking a
  // cross-ayah leak, rather than guessing from the override list.
  const ayah = distractors[0]?.ayah;
  const distractorLatest = latestPerKey(
    ayah === undefined ? [] : overrides.filter((o) => o.ayah === ayah),
    "distractor",
  );
  const replacedPositions = new Set(distractorLatest.keys());
  const kept = distractors.filter((d) => !replacedPositions.has(`${d.ayah}:${d.position}`));
  const added: Distractor[] = [];
  for (const ov of distractorLatest.values()) {
    const payload = ov.payload as { distractors?: Array<Omit<Distractor, "surah" | "ayah" | "position">> } | null;
    if (!Array.isArray(payload?.distractors)) continue;
    for (const d of payload.distractors) {
      added.push({ ...d, surah: kept[0]?.surah ?? 0, ayah: ov.ayah, position: ov.position! });
    }
  }
  return ayahAdminHash([...kept, ...added]);
}
