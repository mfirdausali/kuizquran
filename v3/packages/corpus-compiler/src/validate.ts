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
import { gradeKey } from "./foilKernels.ts";

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
    // Kernel-filled surah. Shortfall is SOFT for the same reason the authored
    // coverage check is: "degenerate surahs are the ICP's common case", and a
    // kernel emits as many admissible foils as genuinely EXIST rather than
    // padding to a quota (padding would mean inventing Arabic — rule 1 — or
    // duplicating a sibling, which the accumulator forbids anyway).
    const shortfall: string[] = [];
    const noFoils: string[] = [];
    for (const w of corpus.words) {
      const n = distByWord.get(`${w.ayah}:${w.position}`) ?? 0;
      if (n === 0) noFoils.push(`${w.ayah}:${w.position}`);
      else if (n < MIN_DISTRACTORS - 1) shortfall.push(`${w.ayah}:${w.position}(${n})`);
    }
    checks.push({
      name: "kernel distractor coverage",
      severity: "soft",
      pass: shortfall.length === 0 && noFoils.length === 0,
      detail:
        corpus.distractors.length === 0
          ? "no authored source and no foil pool — 0 distractors"
          : `${corpus.distractors.length} kernel-derived foils; yield histogram ${JSON.stringify(corpus.meta.kernelYield)}` +
            (shortfall.length ? `; below 4: ${shortfall.join(", ")}` : "") +
            (noFoils.length ? `; NO foils at: ${noFoils.join(", ")}` : ""),
    });
    // A word with ZERO foils is D51's slot machine: the tile bank would offer
    // only the correct answer. Hard-fail only when the surah has a pool to draw
    // from at all — a surah compiled with no pool legitimately has none.
    if (corpus.distractors.length > 0) {
      checks.push({
        name: "every word has >=1 foil (D51 — no one-option quiz)",
        severity: "hard",
        pass: noFoils.length === 0,
        detail: noFoils.length === 0 ? "every word has at least one foil" : `no foils at: ${noFoils.join(", ")}`,
      });
    }
  }

  // 5. no distractor GRADES CORRECT against its target (hard — zero after the
  //    drop). Compared with the ENGINE's grading key (NFC + tatweel strip),
  //    NOT byte equality: this check previously used `d.text === target` and so
  //    passed green while three surah-12 rows (12:21 p15, 12:22 p7, 12:24 p11)
  //    shipped a foil that was the target plus one U+0640 tatweel — byte-
  //    different, grade-identical. 12:21 p15 put a SECOND CORRECT ANSWER in the
  //    Learn and Reinforce option sets. Byte equality here is precisely the gap
  //    defect #7 lived in.
  const selfCollisions: string[] = [];
  const targetText = new Map<string, string>();
  for (const w of corpus.words) targetText.set(`${w.ayah}:${w.position}`, w.text_uthmani);
  for (const d of corpus.distractors) {
    const t = targetText.get(`${d.ayah}:${d.position}`);
    if (t !== undefined && gradeKey(d.text) === gradeKey(t)) {
      selfCollisions.push(`${d.ayah}:${d.position}`);
    }
  }
  checks.push({
    name: "no distractor grades correct against its target (engine equivalence)",
    severity: "hard",
    pass: selfCollisions.length === 0,
    detail:
      selfCollisions.length === 0
        ? `clean (${corpus.meta.droppedCollisions.length} collisions dropped during compile)`
        : `remaining collisions: ${selfCollisions.join(", ")}`,
  });

  // 5b. no two SIBLING foils at one coordinate grade identical (#9). Same
  //     engine equivalence — using the compiler's much broader normalizeArabic
  //     here would delete legitimate option sets (304 rank<=4 pairs in surah 12
  //     collide under the broad fold but are genuinely different words).
  const siblingsByCoord = new Map<string, string[]>();
  for (const d of corpus.distractors) {
    const k = `${d.ayah}:${d.position}`;
    if (!siblingsByCoord.has(k)) siblingsByCoord.set(k, []);
    siblingsByCoord.get(k)!.push(gradeKey(d.text));
  }
  const dupSiblings: string[] = [];
  for (const [k, keys] of siblingsByCoord) {
    if (new Set(keys).size !== keys.length) dupSiblings.push(k);
  }
  checks.push({
    name: "no two foils at one coordinate grade identical (#9)",
    severity: "hard",
    pass: dupSiblings.length === 0,
    detail: dupSiblings.length === 0 ? "clean" : `duplicate siblings at: ${dupSiblings.join(", ")}`,
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

  // 6b. geometry coverage — soft (a surah without vendored geometry yet is
  //     expected, per edge case #63's degraded mode, not a defect). When
  //     geometry IS present, buildCorpus already guarantees every row is
  //     non-null (it throws on any gap at construction time), so this is a
  //     reporting fact, not a second enforcement point.
  checks.push({
    name: "mushaf geometry (page/line)",
    severity: "soft",
    pass: true,
    detail: corpus.meta.hasGeometry
      ? "vendored geometry present — every verse has a page, every word has a line"
      : "no vendored geometry for this surah yet — page/line are null (expected)",
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
