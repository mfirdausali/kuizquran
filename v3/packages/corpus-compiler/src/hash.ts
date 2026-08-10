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
