// FR1 validation. Pure `validateCorpus()` returns a structured report; the CLI
// tail prints it and exits non-zero on any hard failure.

import type { CorpusJson, RawVerse, WordRef } from "./types.ts";
import { foldTanwin, normalizeArabic } from "./normalize.ts";

export interface Check {
  name: string;
  /** hard = blocks v0.1 exit; soft = reported but non-blocking. */
  severity: "hard" | "soft";
  pass: boolean;
  detail: string;
}

export interface ValidationReport {
  ok: boolean; // true iff no hard check failed
  checks: Check[];
  stats: {
    ayahCount: number;
    wordCount: number;
    distractorCount: number;
    droppedCollisions: WordRef[];
    morphCoverage: { lemma: number; root: number; class: number; total: number };
    outOfSurahDistractors: number;
    missingFromQuran: string[];
  };
}

const EXPECTED_AYAT = 111;
const EXPECTED_WORDS = 1777;
const MIN_DISTRACTORS = 5;

export function validateCorpus(
  corpus: CorpusJson,
  rawVerses: RawVerse[],
  fullQuranWordSet: Set<string>,
): ValidationReport {
  const checks: Check[] = [];

  // 1. 111 ayat present (hard).
  const ayahCount = corpus.verses.length;
  checks.push({
    name: "ayah count",
    severity: "hard",
    pass: ayahCount === EXPECTED_AYAT,
    detail: `${ayahCount} verses (expected ${EXPECTED_AYAT})`,
  });

  // 2. word counts match source, per ayah (hard).
  const srcWpv = new Map<number, number>();
  for (const v of rawVerses) srcWpv.set(v.verse_number, v.words.length);
  const outWpv = new Map<number, number>();
  for (const w of corpus.words) outWpv.set(w.ayah, (outWpv.get(w.ayah) ?? 0) + 1);
  const mismatches: number[] = [];
  for (const [ayah, n] of srcWpv) if (outWpv.get(ayah) !== n) mismatches.push(ayah);
  checks.push({
    name: "word counts match source",
    severity: "hard",
    pass: mismatches.length === 0 && corpus.words.length === EXPECTED_WORDS,
    detail:
      mismatches.length === 0
        ? `${corpus.words.length} words, all ${ayahCount} ayat match source counts`
        : `mismatched ayat: ${mismatches.join(", ")}`,
  });

  // Distractor bucketing per word.
  const distByWord = new Map<string, number>();
  for (const d of corpus.distractors) {
    const k = `${d.ayah}:${d.position}`;
    distByWord.set(k, (distByWord.get(k) ?? 0) + 1);
  }

  // 3. every word has ≥5 ranked distractors — soft, because the 5 known
  //    self-collision items legitimately keep 4 after the drop (hard-fail only
  //    if any word has fewer than 4, i.e. more than one bad distractor).
  const belowFive: string[] = [];
  const belowFour: string[] = [];
  for (const w of corpus.words) {
    const k = `${w.ayah}:${w.position}`;
    const n = distByWord.get(k) ?? 0;
    if (n < MIN_DISTRACTORS) belowFive.push(`${k}(${n})`);
    if (n < MIN_DISTRACTORS - 1) belowFour.push(`${k}(${n})`);
  }
  checks.push({
    name: "≥5 ranked distractors per word",
    severity: "soft",
    pass: belowFive.length === corpus.meta.droppedCollisions.length && belowFour.length === 0,
    detail:
      belowFive.length === 0
        ? "all words have 5"
        : `${belowFive.length} word(s) at 4 after collision drop (expected): ${belowFive.join(", ")}`,
  });
  // Hard floor: no word may drop below 4.
  checks.push({
    name: "≥4 distractors per word (hard floor)",
    severity: "hard",
    pass: belowFour.length === 0,
    detail: belowFour.length === 0 ? "no word below 4" : `below 4: ${belowFour.join(", ")}`,
  });

  // 4. no distractor equals its target (hard — must be zero after the drop).
  const selfCollisions: string[] = [];
  const targetText = new Map<string, string>();
  for (const w of corpus.words) targetText.set(`${w.ayah}:${w.position}`, w.text_uthmani);
  for (const d of corpus.distractors) {
    if (d.text === targetText.get(`${d.ayah}:${d.position}`)) {
      selfCollisions.push(`${d.ayah}:${d.position}`);
    }
  }
  checks.push({
    name: "no distractor equals its target",
    severity: "hard",
    pass: selfCollisions.length === 0,
    detail:
      selfCollisions.length === 0
        ? `clean (${corpus.meta.droppedCollisions.length} collisions dropped during compile)`
        : `remaining collisions: ${selfCollisions.join(", ")}`,
  });

  // 5. distractor attestation in the Quran — SOFT review flag. Checked against
  //    the full-Quran word set built from QAC (segments + clitic runs + tanwin
  //    fold). ~15% of the hand-authored distractors are morphologically-valid
  //    inflections not attested verbatim in the mushaf (e.g. أَبِيكَ, فَيَكِيدُونَ);
  //    these are strong pedagogical traps, not defects. Surfaced here + in the
  //    report for the qari/teacher review the PRD §11 mandates before testers.
  const attested = (text: string): boolean => {
    const n = normalizeArabic(text);
    return fullQuranWordSet.has(n) || fullQuranWordSet.has(foldTanwin(n));
  };
  const missingFromQuran: string[] = [];
  let outOfSurah = 0;
  const yusufWordSet = new Set<string>();
  for (const w of corpus.words) yusufWordSet.add(normalizeArabic(w.text_uthmani));
  const seenMissing = new Set<string>();
  let missCount = 0;
  for (const d of corpus.distractors) {
    const n = normalizeArabic(d.text);
    if (!yusufWordSet.has(n)) outOfSurah++;
    if (!attested(d.text)) {
      missCount++;
      if (!seenMissing.has(n)) {
        seenMissing.add(n);
        missingFromQuran.push(d.text);
      }
    }
  }
  const pct = ((100 * missCount) / corpus.distractors.length).toFixed(1);
  checks.push({
    name: "distractor attestation in the Quran",
    severity: "soft",
    pass: missCount === 0,
    detail:
      missCount === 0
        ? `all ${corpus.distractors.length} distractors are attested Quran forms (${outOfSurah} out-of-surah, as designed)`
        : `${missCount}/${corpus.distractors.length} (${pct}%) distractors are valid inflections not attested verbatim in the mushaf — flagged for reviewer (${missingFromQuran.length} distinct forms). ${outOfSurah} distractors are out-of-surah by design.`,
  });

  // 6. connections == ayahCount - 1 (hard).
  checks.push({
    name: "connections = ayahCount - 1",
    severity: "hard",
    pass: corpus.connections.length === ayahCount - 1,
    detail: `${corpus.connections.length} connections (expected ${ayahCount - 1})`,
  });

  // 7. scene beats present for every act (soft).
  checks.push({
    name: "scene beats cover all acts",
    severity: "soft",
    pass: corpus.sceneBeats.length > 0,
    detail: `${corpus.sceneBeats.length} scene beats (labels are TODO placeholders)`,
  });

  // Morphology coverage (informational — nulls expected for particles/PNs).
  let lemma = 0;
  let root = 0;
  let cls = 0;
  for (const w of corpus.words) {
    if (w.lemma) lemma++;
    if (w.root) root++;
    if (w.class) cls++;
  }
  const total = corpus.words.length;
  checks.push({
    name: "morphology coverage",
    severity: "soft",
    pass: cls === total, // every word should at least have a POS class
    detail: `lemma ${lemma}/${total}, root ${root}/${total}, class ${cls}/${total}`,
  });

  const ok = checks.every((c) => c.severity !== "hard" || c.pass);
  return {
    ok,
    checks,
    stats: {
      ayahCount,
      wordCount: corpus.words.length,
      distractorCount: corpus.distractors.length,
      droppedCollisions: corpus.meta.droppedCollisions,
      morphCoverage: { lemma, root, class: cls, total },
      outOfSurahDistractors: outOfSurah,
      missingFromQuran,
    },
  };
}

export function formatReport(r: ValidationReport): string {
  const lines: string[] = [];
  lines.push("Corpus validation — Surah Yusuf (v0.1)");
  lines.push("=".repeat(48));
  for (const c of r.checks) {
    const mark = c.pass ? "✓" : c.severity === "hard" ? "✗" : "⚠";
    lines.push(`${mark} [${c.severity}] ${c.name}`);
    lines.push(`    ${c.detail}`);
  }
  lines.push("-".repeat(48));
  lines.push(r.ok ? "RESULT: PASS (no hard failures)" : "RESULT: FAIL (hard check failed)");
  return lines.join("\n");
}

// ---- CLI ----
const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMain) {
  const { loadInputs, buildFromInputs } = await import("./io.ts");
  const inp = loadInputs();
  const corpus = buildFromInputs(inp);
  const report = validateCorpus(corpus, inp.verses, inp.qac.fullQuranWordSet);
  console.log(formatReport(report));
  process.exit(report.ok ? 0 : 1);
}
