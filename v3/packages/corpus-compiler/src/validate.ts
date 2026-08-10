// FR1 validation. Pure `validateCorpus()` returns a structured report; the CLI
// tail prints it and exits non-zero on any hard failure.
//
// Ported from v1/packages/corpus-compiler/src/validate.ts, surah-parameterized
// for build-plan step 3:
//  - EXPECTED_AYAT/EXPECTED_WORDS were hardcoded to Yusuf's 111/1777. They are
//    now derived from the surah's own source data (word counts must match
//    source — that check is universal, not Yusuf-specific).
//  - The distractor-count checks (≥4/≥5 per word) only apply when this surah
//    HAS authored distractors. A surah with none (meta.distractorsAuthored
//    === false) reports that honestly as a soft note instead of hard-failing
//    — "degenerate surahs are the ICP's common case" (build-plan step 3)
//    means zero distractors is the expected state until foil kernels ship,
//    not a corpus defect.

import type { CorpusJson, RawVerse, WordRef } from "./types.ts";
import { foldTanwin, normalizeArabic } from "./normalize.ts";

export interface Check {
  name: string;
  /** hard = blocks compile; soft = reported but non-blocking. */
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

const MIN_DISTRACTORS = 5;

export function validateCorpus(
  corpus: CorpusJson,
  rawVerses: RawVerse[],
  fullQuranWordSet: Set<string>,
): ValidationReport {
  const checks: Check[] = [];
  const surah = corpus.meta.surah;

  // 1. every surah row is stamped with THIS surah — E-01's corpus-half
  //    regression: a compiler bug that ever emits an unkeyed or wrong-surah
  //    row must hard-fail here, before it reaches a fixture or the app.
  const wrongSurahRows =
    corpus.verses.some((v) => v.surah !== surah) ||
    corpus.words.some((w) => w.surah !== surah) ||
    corpus.distractors.some((d) => d.surah !== surah) ||
    corpus.connections.some((c) => c.surah !== surah) ||
    corpus.lookalikes.some((l) => l.surah !== surah) ||
    corpus.sceneBeats.some((s) => s.surah !== surah);
  checks.push({
    name: "every row stamped with this surah (E-01)",
    severity: "hard",
    pass: !wrongSurahRows,
    detail: wrongSurahRows ? "found a row whose surah field does not match meta.surah" : `all rows carry surah ${surah}`,
  });

  // 2. ayah count matches source (hard).
  const ayahCount = corpus.verses.length;
  const expectedAyat = rawVerses.length;
  checks.push({
    name: "ayah count",
    severity: "hard",
    pass: ayahCount === expectedAyat,
    detail: `${ayahCount} verses (source has ${expectedAyat})`,
  });

  // 3. word counts match source, per ayah (hard).
  const srcWpv = new Map<number, number>();
  for (const v of rawVerses) srcWpv.set(v.verse_number, v.words.length);
  const outWpv = new Map<number, number>();
  for (const w of corpus.words) outWpv.set(w.ayah, (outWpv.get(w.ayah) ?? 0) + 1);
  const mismatches: number[] = [];
  for (const [ayah, n] of srcWpv) if (outWpv.get(ayah) !== n) mismatches.push(ayah);
  const expectedWords = rawVerses.reduce((sum, v) => sum + v.words.length, 0);
  checks.push({
    name: "word counts match source",
    severity: "hard",
    pass: mismatches.length === 0 && corpus.words.length === expectedWords,
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

  if (corpus.meta.distractorsAuthored) {
    // 4. every word has ≥5 ranked distractors — soft, because a handful of
    //    self-collision items legitimately keep 4 after the drop (hard-fail
    //    only if any word has fewer than 4).
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
    checks.push({
      name: "≥4 distractors per word (hard floor)",
      severity: "hard",
      pass: belowFour.length === 0,
      detail: belowFour.length === 0 ? "no word below 4" : `below 4: ${belowFour.join(", ")}`,
    });
  } else {
    checks.push({
      name: "distractor coverage",
      severity: "soft",
      pass: true,
      detail:
        "no authored distractor source for this surah — 0 distractors is expected " +
        "(foil-kernel generation is separate, not-yet-implemented follow-on work), " +
        "not a compile defect",
    });
  }

  // 5. no distractor equals its target (hard — must be zero after the drop).
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

  // 6. distractor attestation in the Quran — SOFT review flag. Checked against
  //    the full-Quran word set built from QAC (segments + clitic runs + tanwin
  //    fold). Some hand-authored distractors are morphologically-valid
  //    inflections not attested verbatim in the mushaf; these are strong
  //    pedagogical traps, not defects. Surfaced here + in the report for
  //    qari/teacher review.
  const attested = (text: string): boolean => {
    const n = normalizeArabic(text);
    return fullQuranWordSet.has(n) || fullQuranWordSet.has(foldTanwin(n));
  };
  const missingFromQuran: string[] = [];
  let outOfSurah = 0;
  const surahWordSet = new Set<string>();
  for (const w of corpus.words) surahWordSet.add(normalizeArabic(w.text_uthmani));
  const seenMissing = new Set<string>();
  let missCount = 0;
  for (const d of corpus.distractors) {
    const n = normalizeArabic(d.text);
    if (!surahWordSet.has(n)) outOfSurah++;
    if (!attested(d.text)) {
      missCount++;
      if (!seenMissing.has(n)) {
        seenMissing.add(n);
        missingFromQuran.push(d.text);
      }
    }
  }
  const pct = corpus.distractors.length > 0 ? ((100 * missCount) / corpus.distractors.length).toFixed(1) : "0.0";
  checks.push({
    name: "distractor attestation in the Quran",
    severity: "soft",
    pass: missCount === 0,
    detail:
      corpus.distractors.length === 0
        ? "no distractors to check"
        : missCount === 0
          ? `all ${corpus.distractors.length} distractors are attested Quran forms (${outOfSurah} out-of-surah, as designed)`
          : `${missCount}/${corpus.distractors.length} (${pct}%) distractors are valid inflections not attested verbatim in the mushaf — flagged for reviewer (${missingFromQuran.length} distinct forms). ${outOfSurah} distractors are out-of-surah by design.`,
  });

  // 7. connections == ayahCount - 1 (hard).
  checks.push({
    name: "connections = ayahCount - 1",
    severity: "hard",
    pass: corpus.connections.length === ayahCount - 1,
    detail: `${corpus.connections.length} connections (expected ${ayahCount - 1})`,
  });

  // 8. scene beats present when a mental model exists (soft — a surah with no
  //    mental model is expected to have zero, not a defect).
  checks.push({
    name: "scene beats cover all acts",
    severity: "soft",
    pass: !corpus.meta.hasMentalModel || corpus.sceneBeats.length > 0,
    detail: corpus.meta.hasMentalModel
      ? `${corpus.sceneBeats.length} scene beats (labels may be TODO placeholders)`
      : "no mental model authored for this surah — 0 scene beats is expected",
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

export function formatReport(surah: number, r: ValidationReport): string {
  const lines: string[] = [];
  lines.push(`Corpus validation — surah ${surah}`);
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
  const surahArg = Number(process.argv[2]);
  if (!Number.isInteger(surahArg) || surahArg < 1) {
    console.error("usage: validate.ts <surah>");
    process.exit(2);
  }
  const inp = loadInputs(surahArg);
  const corpus = buildFromInputs(inp);
  const report = validateCorpus(corpus, inp.verses, inp.qac.fullQuranWordSet);
  console.log(formatReport(surahArg, report));
  process.exit(report.ok ? 0 : 1);
}
