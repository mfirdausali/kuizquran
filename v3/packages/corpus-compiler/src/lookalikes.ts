// Look-alike index: word pairs across DIFFERENT ayat, WITHIN one surah, that
// collide visually and so risk cross-verse confusion. Diagnostic seed data,
// not exhaustive. Ported from v1/packages/corpus-compiler/src/lookalikes.ts,
// surah-parameterized (E-01): every row now names its surah.
//
// Sources:
//  (a) exact recurrence — the same normalized form appearing in >1 ayah
//      (score 1.0). These are the "same word, different verse" collisions that
//      the tell-apart drills target.
//  (b) near-identical script — non-identical forms with high normalized-bigram
//      similarity (>= NEAR_THRESHOLD, < 1.0).
//  (c) curated memory-hook pairs — surah-specific spine-threads, passed in by
//      the caller (v1 hardcoded Yusuf's threads inline; v3 keeps that table
//      for surah 12 only and passes an empty list for surahs without one).

import type { LookAlike, RawVerse, WordRef } from "./types.ts";
import { normalizeArabic, scriptSimilarity } from "./normalize.ts";

const MIN_NORM_LEN = 4; // ignore particles/very short forms — pure noise
const NEAR_THRESHOLD = 0.85;

interface FlatWord {
  ayah: number;
  position: number;
  text: string;
  norm: string;
}

export interface CuratedThread {
  reason: string;
  forms: string[];
  ayat: number[];
}

// v1's port source hardcoded a YUSUF_CURATED_THREADS table of literal Arabic
// word forms here (surah 12's spine-thread vocabulary, e.g. "the shirt"
// motif). v3 does not carry it forward: v3/NIGHTLY.md's constraint is
// unconditional ("never write Quranic Arabic anywhere") and this table is
// the one piece of the ported compiler that is actual Quranic vocabulary
// rather than alphabet-level normalization data (normalize.ts's letter
// substitution tables) — so build-plan step 3 drops it rather than risk it.
// buildLookAlikes()'s (a) exact-recurrence and (b) near-identical-script
// tiers are unaffected and still run for every surah; only tier (c),
// curated memory-hook pairs, is empty until a human re-authors this table
// through a reviewed, non-agent path.

function flatten(verses: RawVerse[]): FlatWord[] {
  const out: FlatWord[] = [];
  for (const v of verses) {
    for (const w of v.words) {
      const norm = normalizeArabic(w.text_uthmani);
      if (norm.length >= MIN_NORM_LEN) {
        out.push({ ayah: v.verse_number, position: w.position, text: w.text_uthmani, norm });
      }
    }
  }
  return out;
}

function ref(w: FlatWord): WordRef {
  return { ayah: w.ayah, position: w.position };
}

export function buildLookAlikes(
  surah: number,
  verses: RawVerse[],
  curatedThreads: CuratedThread[] = [],
): LookAlike[] {
  const words = flatten(verses);
  const out: LookAlike[] = [];
  const seen = new Set<string>();

  const pairKey = (a: WordRef, b: WordRef): string => {
    const x = `${a.ayah}:${a.position}`;
    const y = `${b.ayah}:${b.position}`;
    return x < y ? `${x}|${y}` : `${y}|${x}`;
  };
  const push = (a: FlatWord, b: FlatWord, reason: string, score: number): void => {
    if (a.ayah === b.ayah && a.position === b.position) return;
    const k = pairKey(ref(a), ref(b));
    if (seen.has(k)) return;
    seen.add(k);
    // Order the pair deterministically (earlier ayah/position first).
    const [first, second] =
      a.ayah < b.ayah || (a.ayah === b.ayah && a.position < b.position) ? [a, b] : [b, a];
    out.push({ surah, a: ref(first), b: ref(second), reason, score: Math.round(score * 100) / 100 });
  };

  // (a) exact recurrence across ayat — one representative pair (two earliest
  //     occurrences in distinct ayat) per normalized form.
  const byNorm = new Map<string, FlatWord[]>();
  for (const w of words) {
    let g = byNorm.get(w.norm);
    if (!g) {
      g = [];
      byNorm.set(w.norm, g);
    }
    g.push(w);
  }
  for (const [, arr] of byNorm) {
    const distinctAyah: FlatWord[] = [];
    const ayatSeen = new Set<number>();
    for (const w of arr.sort((x, y) => x.ayah - y.ayah || x.position - y.position)) {
      if (!ayatSeen.has(w.ayah)) {
        ayatSeen.add(w.ayah);
        distinctAyah.push(w);
      }
    }
    if (distinctAyah.length >= 2) {
      push(distinctAyah[0]!, distinctAyah[1]!, "identical form across ayat", 1.0);
    }
  }

  // (b) near-identical script (non-exact), pruned by first letter + length.
  for (let i = 0; i < words.length; i++) {
    const wi = words[i]!;
    for (let j = i + 1; j < words.length; j++) {
      const wj = words[j]!;
      if (wi.ayah === wj.ayah) continue;
      if (wi.norm === wj.norm) continue; // handled by (a)
      if (wi.norm[0] !== wj.norm[0]) continue;
      if (Math.abs(wi.norm.length - wj.norm.length) > 2) continue;
      const s = scriptSimilarity(wi.text, wj.text);
      if (s >= NEAR_THRESHOLD && s < 1) push(wi, wj, "script similarity", s);
    }
  }

  // (c) curated memory-hook threads: link the earliest occurrence of each
  //     thread form in the listed ayat.
  for (const thread of curatedThreads) {
    const members: FlatWord[] = [];
    const perAyah = new Set<number>();
    for (const w of words) {
      if (thread.ayat.includes(w.ayah) && thread.forms.includes(w.norm) && !perAyah.has(w.ayah)) {
        perAyah.add(w.ayah);
        members.push(w);
      }
    }
    members.sort((x, y) => x.ayah - y.ayah);
    for (let i = 1; i < members.length; i++) push(members[0]!, members[i]!, thread.reason, 1.0);
  }

  // Stable ordering for a reproducible artifact.
  out.sort(
    (p, q) =>
      p.a.ayah - q.a.ayah ||
      p.a.position - q.a.position ||
      p.b.ayah - q.b.ayah ||
      p.b.position - q.b.position,
  );
  return out;
}
