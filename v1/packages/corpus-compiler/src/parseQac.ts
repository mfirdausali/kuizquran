// Parse the vendored QAC morphology TSV (data/raw/quran-morphology.txt).
//
// Each line is one morphological SEGMENT:
//   surah:ayah:word:segment \t FORM \t TAG \t FEATURES
// FEATURES is a '|'-delimited list carrying e.g. ROOT:xxx, LEM:yyy (Arabic).
//
// This dataset's words are whole mushaf tokens, so we collapse all segments of
// a given (surah,ayah,word) up to one WordMorph by choosing a HEAD segment:
// the one carrying ROOT (the stem); else the one carrying LEM; else the last.
// Verified: this yields exactly 1777 words / 111 ayat for surah 12, aligning
// 1:1 by (ayah, word) with the fused dataset.

import { readFileSync } from "node:fs";
import type { WordClass, WordMorph } from "./types.ts";
import { foldTanwin, normalizeArabic } from "./normalize.ts";

interface Segment {
  form: string;
  tag: string;
  features: Record<string, string>;
}

const LOCATION_RE = /^(\d+):(\d+):(\d+):(\d+)$/;

function parseFeatures(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tok of raw.split("|")) {
    const idx = tok.indexOf(":");
    if (idx > 0) out[tok.slice(0, idx)] = tok.slice(idx + 1);
    // bare flags (PREF, DET, PN, GEN, ...) are ignored here — we only need
    // ROOT/LEM and the coarse tag for word class.
  }
  return out;
}

function tagToClass(tag: string): WordClass | null {
  if (tag === "N" || tag === "V" || tag === "P") return tag;
  return null;
}

function headOf(segs: Segment[]): Segment {
  for (const s of segs) if (s.features.ROOT) return s;
  for (const s of segs) if (s.features.LEM) return s;
  return segs[segs.length - 1]!;
}

export interface QacData {
  /** surah12 morphology keyed by "ayah:word". */
  yusufMorph: Map<string, WordMorph>;
  /** Normalized skeletons of every word form in the whole Quran (for validation). */
  fullQuranWordSet: Set<string>;
}

/**
 * Parse the QAC file once. Returns surah-12 per-word morphology plus the
 * normalized full-Quran word set used by the distractor-corpus check.
 */
export function parseQac(filePath: string): QacData {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split("\n");

  // Group segments by (surah,ayah,word).
  const groups = new Map<string, Segment[]>();
  const fullQuranWordSet = new Set<string>();

  for (const line of lines) {
    const row = line.replace(/\r$/, "");
    if (!row || row.startsWith("#")) continue;
    const parts = row.split("\t");
    if (parts.length < 3) continue;
    const loc = parts[0]!;
    const m = LOCATION_RE.exec(loc);
    if (!m) continue;
    const surah = m[1]!;
    const ayah = m[2]!;
    const word = m[3]!;
    const form = parts[1] ?? "";
    const tag = parts[2] ?? "";
    const features = parseFeatures(parts[3] ?? "");

    const key = `${surah}:${ayah}:${word}`;
    let g = groups.get(key);
    if (!g) {
      g = [];
      groups.set(key, g);
    }
    g.push({ form, tag, features });
  }

  // Collapse each word to (a) a rich set of attested forms for the corpus check
  // and (b) surah-12 morphology from the head segment.
  //
  // The distractors are hand-authored Uthmani tokens whose clitic boundaries
  // differ from QAC's segmentation (e.g. QAC stores الكواكب while a distractor
  // is كواكب without the article). So the "attested in the Quran" set includes,
  // per word: the whole reconstructed form, every individual segment, and every
  // leading/trailing run of segments — plus a tanwin/stem-folded variant of each
  // so accusative-nunation forms (كوثرا) match their base.
  const add = (form: string): void => {
    const n = normalizeArabic(form);
    if (!n) return;
    fullQuranWordSet.add(n);
    const stem = foldTanwin(n);
    if (stem) fullQuranWordSet.add(stem);
  };

  const yusufMorph = new Map<string, WordMorph>();
  for (const [key, segs] of groups) {
    const [surah, ayah, word] = key.split(":");
    const forms = segs.map((s) => s.form);
    add(forms.join("")); // whole word
    for (const f of forms) add(f); // each segment
    for (let i = 1; i < forms.length; i++) {
      add(forms.slice(i).join("")); // trailing run (drop leading clitics)
      add(forms.slice(0, i).join("")); // leading run
    }

    if (surah === "12") {
      const h = headOf(segs);
      yusufMorph.set(`${ayah}:${word}`, {
        lemma: h.features.LEM ?? null,
        root: h.features.ROOT ?? null,
        class: tagToClass(h.tag),
      });
    }
  }

  return { yusufMorph, fullQuranWordSet };
}
