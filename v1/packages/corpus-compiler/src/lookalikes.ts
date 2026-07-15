// Look-alike index: word pairs across DIFFERENT ayat that collide visually and
// so risk cross-verse confusion. Diagnostic seed data, not exhaustive.
//
// Sources:
//  (a) exact recurrence — the same normalized form appearing in >1 ayah
//      (score 1.0). These are the "same word, different verse" collisions that
//      the tell-apart drills target.
//  (b) near-identical script — non-identical forms with high normalized-bigram
//      similarity (>= NEAR_THRESHOLD, < 1.0).
//  (c) curated memory-hook pairs — the surah's known spine-threads (qamees,
//      the dream vocabulary, sabr-jameel, kayd), scored 1.0 with a named reason.

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

/** Curated cross-ayah threads distilled from the mental model's memory hooks. */
const CURATED_THREADS: { reason: string; forms: string[]; ayat: number[] }[] = [
  { reason: "qamees (the shirt) spine-thread", forms: ["قميص", "قميصه", "بقميص"], ayat: [18, 25, 26, 27, 28, 93] },
  { reason: "dream vocabulary (ru'ya) bookends", forms: ["رءيا", "ارى", "رايت"], ayat: [4, 5, 6, 36, 43, 100] },
  { reason: "kayd (scheme) recurring danger-word", forms: ["كيد", "كيدهن", "كيدكن", "بكيدهن"], ayat: [5, 28, 33, 34, 50] },
  { reason: "sabr jameel refrain", forms: ["صبر", "جميل"], ayat: [18, 83] },
];

export function buildLookAlikes(verses: RawVerse[]): LookAlike[] {
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
    out.push({ a: ref(first), b: ref(second), reason, score: Math.round(score * 100) / 100 });
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
  for (const thread of CURATED_THREADS) {
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
