#!/usr/bin/env node
// DISTRACTOR QA SAMPLING (build-plan step 27 / M9: "distractor QA 10% sample").
//
//     "it is how a human spot-checks generated content before a freeze."
//
// ---------------------------------------------------------------------------
// WHY A SAMPLE AND NOT A FULL REVIEW
// ---------------------------------------------------------------------------
// Surah 12 alone carries 8,877 distractor rows. Nobody reviews that by hand,
// and a review nobody performs is worse than no review, because the checklist
// still gets ticked. M9 asks for 10% per new surah — enough to catch a
// SYSTEMATIC defect in a generator, which is the actual risk. The foil kernels
// (foilKernels.ts) derive every foil from real corpus bytes, so the failure
// mode is not "invented Arabic" (structurally impossible there) but
// "systematically unfair or systematically trivial foils" — which a sample
// surfaces and a full read would not surface any better.
//
// ---------------------------------------------------------------------------
// THE SAMPLE IS DETERMINISTIC. NO Math.random.
// ---------------------------------------------------------------------------
// v3's purity lints forbid Math.random, and here the reason is not only the
// lint: a re-run must produce the SAME sample, or a reviewer who is
// interrupted cannot resume, and two people cannot review "the sample". So
// selection is a stable stride over a deterministic ordering derived from the
// corpus hash. Re-running against the same corpus yields byte-identical rows;
// a recompile that changes content changes the sample, which is correct — it
// is a different corpus.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCRIPT DOES NOT DO
// ---------------------------------------------------------------------------
// It does not JUDGE a distractor. An agent cannot decide whether a foil is
// religiously or pedagogically acceptable — that judgement is the human's, and
// it is exactly what the 10% sample buys. This script SELECTS, computes the
// mechanical signals a human wants beside each row, and writes a worksheet with
// an EMPTY verdict column. `signedBy` stays empty until a person fills it in;
// content-freeze.mjs refuses to count an unsigned sample.
//
// Usage:
//   node v3/scripts/distractor-qa.mjs --surah 112            # print worksheet
//   node v3/scripts/distractor-qa.mjs --surah 112 --write    # write docs/qa-samples/112.json
//   node v3/scripts/distractor-qa.mjs --surah 12 --pct 10
//
// The written record carries the corpus hash it was drawn from, so
// content-freeze.mjs can tell a current sample from a stale one — the same
// staleness logic the verification frontier applies to a qari's signature.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V3 = path.resolve(HERE, "..");
const OUTPUT = path.join(V3, "packages/corpus-compiler/output");
const SAMPLE_DIR = path.join(V3, "docs/qa-samples");

const args = process.argv.slice(2);
function arg(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const surah = Number(arg("--surah", "112"));
const pct = Number(arg("--pct", "10"));
const write = args.includes("--write");
const asJson = args.includes("--json");

if (!Number.isInteger(surah)) {
  console.error("--surah must be an integer");
  process.exit(2);
}

const corpusPath = path.join(OUTPUT, String(surah), "corpus.json");
if (!existsSync(corpusPath)) {
  console.error(`no compiled corpus for surah ${surah} at ${corpusPath}`);
  process.exit(2);
}
const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
const manifestPath = path.join(OUTPUT, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { surahs: {} };
const corpusHash = manifest.surahs?.[String(surah)]?.corpusHash ?? null;

// ---------------------------------------------------------------------------
// THE UNIT OF REVIEW IS THE OPTION SET, NOT THE ROW
// ---------------------------------------------------------------------------
// A reviewer cannot judge one distractor in isolation: "is this a fair foil"
// only means something beside the correct answer and its siblings. So the
// sample is drawn over WORD COORDINATES (ayah, position) and each sampled unit
// carries the whole option set. Sampling 10% of ROWS would hand a reviewer
// fragments of ~10% of sets and no complete set at all.
const byCoord = new Map();
for (const d of corpus.distractors ?? []) {
  const key = `${d.ayah}:${d.position}`;
  if (!byCoord.has(key)) byCoord.set(key, []);
  byCoord.get(key).push(d);
}

const words = new Map();
for (const w of corpus.words ?? []) words.set(`${w.ayah}:${w.position}`, w);

// Deterministic ordering: sort coordinates by a digest of (corpusHash, coord).
// A plain ayah-order stride would over-sample the surah's opening (a reviewer
// reads the first ayat anyway) and systematically miss the long tail where
// generated foils are thinnest. Hash-ordering spreads the sample across the
// whole surah while staying reproducible.
const coords = [...byCoord.keys()].sort((a, b) => {
  const ha = createHash("sha256").update(`${corpusHash ?? ""}:${a}`).digest("hex");
  const hb = createHash("sha256").update(`${corpusHash ?? ""}:${b}`).digest("hex");
  return ha < hb ? -1 : ha > hb ? 1 : a < b ? -1 : 1;
});

const targetCount = Math.max(1, Math.ceil((coords.length * pct) / 100));
const chosen = coords.slice(0, targetCount).sort((a, b) => {
  const [aa, ap] = a.split(":").map(Number);
  const [ba, bp] = b.split(":").map(Number);
  return aa - ba || ap - bp;
});

// ---------------------------------------------------------------------------
// THE MECHANICAL SIGNALS THAT SIT BESIDE EACH SET
// ---------------------------------------------------------------------------
// These are the things a script CAN judge, computed so the human spends their
// attention only on what a script cannot. Deliberately NOT a verdict — each is
// a fact, and `flags` names the ones that historically preceded a real defect.
function analyse(key) {
  const rows = byCoord.get(key).slice().sort((a, b) => a.rank - b.rank);
  const word = words.get(key) ?? null;
  const [ayah, position] = key.split(":").map(Number);

  const flags = [];

  // #1 — a degenerate option set. D51's own defect: surah 112 compiled with
  // ZERO distractors, so every tile bank contained only the correct answer.
  // Fewer than 3 foils means the learner picks by elimination.
  if (rows.length < 3) flags.push(`only ${rows.length} foil(s) — option set is near-degenerate`);

  // #2 — duplicate surfaces inside one set (#9's shape). The FoilSet
  // accumulator makes this structurally impossible for kernel rows; checking
  // anyway is how we would learn the accumulator was bypassed.
  const surfaces = rows.map((r) => r.text);
  if (new Set(surfaces).size !== surfaces.length) {
    flags.push("DUPLICATE foil surfaces within one option set — the accumulator was bypassed");
  }

  // #3 — a foil equal to the correct answer under the ENGINE's grading
  // equivalence. This is the live-defect class (three surah-12 tatweel rows):
  // byte-different, grade-identical, so the set has two correct answers.
  // Recomputed here from corpus bytes with the same NFC + tatweel-strip rule
  // the engine grades with, because a QA sample that trusted the compiler to
  // have caught it would never catch the compiler being wrong.
  const TATWEEL = String.fromCodePoint(0x0640);
  const gradeKey = (t) => t.normalize("NFC").split(TATWEEL).join("");
  if (word) {
    const target = gradeKey(word.text_uthmani);
    const collide = rows.filter((r) => gradeKey(r.text) === target);
    if (collide.length > 0) {
      flags.push(
        `${collide.length} foil(s) GRADE-EQUAL to the correct answer (rank ${collide.map((c) => c.rank).join(", ")}) — two correct answers`,
      );
    }
  }

  // #4 — provenance. A kernel-derived set and an authored set warrant
  // different reviewer attention, so it is stated rather than inferred.
  const origins = [...new Set(rows.map((r) => r.origin))];

  // #5 — a single-kernel set. All four foils from one kernel means the
  // learner faces one axis of confusion (all visual, or all rhyme), which is
  // a systematically easier and less instructive item than a mixed set.
  const kinds = [...new Set(rows.map((r) => r.src_type))];
  if (kinds.length === 1 && rows.length >= 3) {
    flags.push(`all ${rows.length} foils are '${kinds[0]}' — one axis of confusion only`);
  }

  return {
    ayah,
    position,
    // The Arabic surfaces are NOT written into this file by this script's own
    // source — they are read from the corpus at runtime and passed through.
    // v3/CLAUDE.md rule 1 forbids a literal; carrying a value is the whole job.
    correct: word?.text_uthmani ?? null,
    glossEn: word?.gloss?.en ?? null,
    foils: rows.map((r) => ({
      rank: r.rank,
      text: r.text,
      prdRank: r.prd_rank,
      srcType: r.src_type,
      why: r.why,
      origin: r.origin,
    })),
    origins,
    flags,
    // THE HUMAN'S COLUMN. Empty by construction — an agent filling this in is
    // an agent certifying religious content, which v3/CLAUDE.md forbids.
    verdict: null, // "ok" | "reject" | "needs-change", set by a human
    reviewerNote: null,
  };
}

const sample = chosen.map(analyse);
const flagged = sample.filter((s) => s.flags.length > 0);

const record = {
  surah,
  corpusHash,
  // Which corpus this sample describes. content-freeze.mjs compares this to
  // the manifest's current hash and calls a mismatch STALE.
  generatedAt: null, // filled at write time; null keeps re-runs byte-comparable
  totalCoordinates: coords.length,
  totalDistractorRows: (corpus.distractors ?? []).length,
  pct,
  sampled: sample.length,
  distractorOrigin: corpus.meta?.distractorOrigin ?? null,
  kernelYield: corpus.meta?.kernelYield ?? null,
  // THE SIGN-OFF. Never written by this script. content-freeze.mjs treats an
  // empty signedBy as "not sampled", because an unsigned worksheet is a
  // worksheet nobody read.
  signedBy: null,
  signedAt: null,
  mechanicalFlags: flagged.length,
  items: sample,
};

if (write) {
  mkdirSync(SAMPLE_DIR, { recursive: true });
  const dest = path.join(SAMPLE_DIR, `${surah}.json`);
  if (existsSync(dest)) {
    // NEVER clobber a signed record. Overwriting one would silently discard a
    // human's sign-off and reset the freeze evidence to unsigned — or worse,
    // keep the signature over a different sample.
    const prior = JSON.parse(readFileSync(dest, "utf8"));
    if (prior.signedBy) {
      console.error(
        `refusing to overwrite ${dest}: it carries a sign-off by ${prior.signedBy}. ` +
          `Delete it deliberately if the corpus really changed.`,
      );
      process.exit(2);
    }
  }
  writeFileSync(dest, JSON.stringify({ ...record, generatedAt: Date.now() }, null, 2) + "\n");
  console.error(`wrote ${dest} — ${sample.length} option sets, ${flagged.length} mechanically flagged.`);
  console.error("SIGN-OFF REQUIRED: a human sets `verdict` per item and fills `signedBy`/`signedAt`.");
} else if (asJson) {
  console.log(JSON.stringify(record, null, 2));
} else {
  console.log("");
  console.log(`DISTRACTOR QA SAMPLE — surah ${surah} @ corpus ${corpusHash ?? "unknown"}`);
  console.log(
    `${sample.length} of ${coords.length} option sets (${pct}%), drawn from ${record.totalDistractorRows} distractor rows.`,
  );
  console.log(
    `provenance: ${JSON.stringify(record.distractorOrigin)} · mechanically flagged: ${flagged.length}`,
  );
  console.log("");
  if (flagged.length > 0) {
    console.log("MECHANICALLY FLAGGED (a script found these; the rest need human eyes):");
    for (const item of flagged) {
      console.log(`  ${surah}:${item.ayah} p${item.position} — ${item.flags.join("; ")}`);
    }
    console.log("");
  }
  console.log("Every sampled item still needs a HUMAN verdict — a script cannot judge whether");
  console.log("a foil is fair or instructive. Write the worksheet with --write, then fill in");
  console.log("`verdict` per item and `signedBy`. content-freeze.mjs ignores an unsigned sample.");
  console.log("");
}
