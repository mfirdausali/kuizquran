#!/usr/bin/env node
// THE CONTENT-FREEZE-BEFORE-QARI GATE (build-plan step 28 / M9 entry criteria).
//
//     "Blocks: booking-confirmed qari sessions — a sign-off collected before
//      this gate WILL be invalidated and re-paid in scholar hours."
//
// ---------------------------------------------------------------------------
// WHY THIS IS A COMMAND AND NOT A CHECKLIST IN A DOC
// ---------------------------------------------------------------------------
// M9's entry criteria already exist as prose in BUILD-PLAN.md. Prose has failed
// this build repeatedly (v3-D38/D45/D49/D50/D53/D57/D58 are seven vacuous
// verifications), and the specific failure this one guards is not a bug: it is
// a CALENDAR event. A qari session booked against an unfrozen corpus does not
// go red. It goes GREEN, produces signatures, and then the next compile ambers
// every one of them at once (edge case #155). The cost is scholar hours,
// re-paid, and a slipped launch — no test suite anywhere catches that, because
// nothing is broken in code.
//
// So the criteria are evaluated against ARTIFACTS ON DISK and printed as
// MET / NOT MET with the evidence that decided it. The point is that booking a
// session against an unfrozen corpus becomes a VISIBLE mistake — someone has to
// read "NOT MET" and book anyway.
//
// ---------------------------------------------------------------------------
// WHAT THIS COMMAND DELIBERATELY DOES NOT DO
// ---------------------------------------------------------------------------
// It does not freeze anything. It REPORTS. Freezing is a human act (a tagged
// commit, a booked calendar slot); a script that flipped a "frozen" bit would
// be the same lie as a checklist that checks itself.
//
// It also does not judge CONTENT. It cannot tell whether a scene-beat label is
// a good one or whether a distractor is fair — that is exactly the human
// judgement M9 buys with scholar hours. It checks that the content EXISTS, is
// SAMPLED, and is STABLE. See `distractor-qa.mjs` for the sampling half.
//
// Usage:
//   node v3/scripts/content-freeze.mjs                 # human-readable report
//   node v3/scripts/content-freeze.mjs --json          # machine-readable
//   node v3/scripts/content-freeze.mjs --surahs 12,112 # override launch set
//
// Exit code: 0 when every criterion is MET, 1 otherwise. Non-zero means
// "do not book the qari".

import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V3 = path.resolve(HERE, "..");
const OUTPUT = path.join(V3, "packages/corpus-compiler/output");

// ---------------------------------------------------------------------------
// THE LAUNCH SURAH SET
// ---------------------------------------------------------------------------
// BUILD-PLAN: "Scope = ALL launch-serving surahs (12 + 112 + 103 + second
// surah), including seam renders". The second surah is Q3, still OPEN in
// BUILD-PLAN's own open-questions list ("Al-Mulk or a Juz Amma batch"), so it
// cannot be enumerated here. That is itself reported — an unanswered scope
// question is a freeze blocker, because a surah added after the freeze is a
// surah the qari did not sign.
const LAUNCH_SURAHS = [12, 103, 112];

// v3-D21: ATOMIC is <= 8 ayat and renders NO PANEL — "at 3-8 ayat the list is
// already the macro view". So "scene beats authored for every launch surah"
// does NOT mean every surah has beat rows; it means every surah that RENDERS a
// macro panel has them. Demanding beats for surah 112 would demand authoring
// content that no screen displays, and the honest gate must not manufacture
// work the design explicitly removed. The threshold is duplicated from
// corpus-compiler/src/macro.ts#ATOMIC_MAX_AYAT and cross-checked below, so the
// two cannot drift silently.
const ATOMIC_MAX_AYAT = 8;

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const surahArg = args.indexOf("--surahs");
const surahs =
  surahArg >= 0 && args[surahArg + 1]
    ? args[surahArg + 1].split(",").map((s) => Number(s.trim())).filter(Number.isInteger)
    : LAUNCH_SURAHS;

/** A criterion result. `evidence` is the whole value of this report — a bare
 *  MET/NOT MET is a checklist, and a checklist is what already failed. */
function criterion(name, met, evidence, blocking = true) {
  return { name, met, evidence, blocking };
}

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function loadCorpora() {
  const out = new Map();
  for (const s of surahs) {
    const file = path.join(OUTPUT, String(s), "corpus.json");
    if (!existsSync(file)) continue;
    try {
      out.set(s, readJson(file));
    } catch {
      // A corrupt corpus is a MISSING corpus for gate purposes — never a
      // silently skipped one that leaves a criterion looking satisfied.
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CRITERION 1 — MS DECISION EXECUTED
// ---------------------------------------------------------------------------
// v3-D15 chose "EN-only, gloss.ms EXCLUDED from hash v1, MS toggle hidden".
// EXECUTED means three verifiable things, not one ratified sentence:
//   (a) the decision is recorded in DECISIONS.md;
//   (b) the qari hash genuinely does not read gloss.ms — checked against the
//       compiler SOURCE, because the hash function is the thing that decides
//       whether an ms edit ambers a signature;
//   (c) no ms gloss has leaked into a compiled corpus that a learner is served
//       (a populated ms field outside the flagged draft table is edge case
//       #189's failure, and it would mean the "excluded" decision is only true
//       of the hash and not of the artifact).
function checkMsDecision(corpora) {
  const decisions = readFileSync(path.join(V3, "DECISIONS.md"), "utf8");
  const recorded = /v3-D15/.test(decisions) && /excluded from hash v1/i.test(decisions);

  const hashSrc = readFileSync(path.join(V3, "packages/corpus-compiler/src/hash.ts"), "utf8");
  // The qari-hash function body only. Reading the whole file would match the
  // docblock that DESCRIBES the exclusion and pass even if the code stopped
  // honouring it — the exact shape of a vacuous check.
  const fnStart = hashSrc.indexOf("export function ayahQariHash(");
  const fnEnd = hashSrc.indexOf("\n}", fnStart);
  const body = fnStart >= 0 ? hashSrc.slice(fnStart, fnEnd) : "";
  const readsEn = /gloss\.en/.test(body);
  const readsMs = /gloss\.ms/.test(body);

  const leaked = [];
  for (const [s, c] of corpora) {
    const n = (c.words ?? []).filter((w) => w.gloss?.ms != null && w.gloss.ms !== "").length;
    if (n > 0) leaked.push(`surah ${s}: ${n} word(s) carry a non-null gloss.ms`);
  }

  const met = recorded && readsEn && !readsMs && leaked.length === 0;
  const evidence = [
    recorded
      ? "DECISIONS.md records v3-D15 (gloss.ms excluded from hash v1)"
      : "DECISIONS.md does NOT record v3-D15's exclusion",
    readsMs
      ? "ayahQariHash READS gloss.ms — an ms edit would amber every signature (edge case #155)"
      : readsEn
        ? "ayahQariHash reads gloss.en only — an ms value cannot move the qari digest"
        : "ayahQariHash reads NEITHER gloss.en nor gloss.ms — the hash shape is not what v3-D13 describes",
    leaked.length === 0
      ? `no compiled corpus carries an ms gloss (${corpora.size} checked)`
      : leaked.join("; "),
  ];
  return criterion("MS decision executed (v3-D15)", met, evidence);
}

// ---------------------------------------------------------------------------
// CRITERION 2 — SCENE BEATS AUTHORED FOR EVERY LAUNCH SURAH
// ---------------------------------------------------------------------------
// Two failure modes, and the second is the one a naive count misses:
//   (a) a non-ATOMIC surah with no beats at all;
//   (b) a surah WITH beats whose labels are still the compiler's own
//       "TODO: author scene-beat label for act N" placeholder. Those rows COUNT
//       as scene beats and they HASH into the qari tier — a qari would sign a
//       TODO string, and replacing it later ambers that ayah. A placeholder is
//       therefore worse than an absence, and this check treats it as such.
function checkSceneBeats(corpora) {
  const evidence = [];
  let met = true;

  for (const s of surahs) {
    const c = corpora.get(s);
    if (!c) {
      evidence.push(`surah ${s}: NO COMPILED CORPUS — cannot assess`);
      met = false;
      continue;
    }
    const ayahCount = c.meta.ayahCount;
    const beats = c.sceneBeats ?? [];
    const todo = beats.filter((b) => typeof b.label === "string" && b.label.startsWith("TODO"));

    if (ayahCount <= ATOMIC_MAX_AYAT) {
      // v3-D21 ATOMIC: no panel renders, so no beats are owed. Reported
      // explicitly rather than skipped, so nobody reads a short list of
      // checked surahs as an oversight.
      evidence.push(
        `surah ${s}: ATOMIC (${ayahCount} ayat <= ${ATOMIC_MAX_AYAT}) — v3-D21 renders no macro panel, no beats owed` +
          (beats.length > 0 ? `; ${beats.length} present anyway` : ""),
      );
      // A TODO placeholder still hashes even on an ATOMIC surah.
      if (todo.length > 0) {
        evidence.push(`surah ${s}: ${todo.length} TODO placeholder label(s) WOULD HASH — must not be signed`);
        met = false;
      }
      continue;
    }

    if (beats.length === 0) {
      evidence.push(`surah ${s}: ${ayahCount} ayat, NOT atomic, and ZERO scene beats — macro content unauthored`);
      met = false;
      continue;
    }
    if (todo.length > 0) {
      evidence.push(
        `surah ${s}: ${beats.length} beats but ${todo.length} still carry the compiler's TODO placeholder — ` +
          `those strings hash into the qari tier and would be SIGNED as content`,
      );
      met = false;
      continue;
    }
    evidence.push(`surah ${s}: ${beats.length} scene beats, all authored (no TODO placeholders)`);
  }

  return criterion("Scene beats authored for every launch surah", met, evidence);
}

// ---------------------------------------------------------------------------
// CRITERION 3 — DISTRACTOR QA SAMPLED
// ---------------------------------------------------------------------------
// M9 wants a 10% sample per new surah, SPOT-CHECKED BY A HUMAN. The sampling is
// mechanical (distractor-qa.mjs); the SIGN-OFF is not. This criterion is met
// only when a signed-off sample record exists for the CURRENT corpus hash of
// each surah — a sample taken against an older corpus proves nothing about the
// one about to be frozen, which is the same staleness logic the verification
// frontier applies to signatures.
function checkDistractorQa(corpora) {
  const evidence = [];
  let met = true;
  const dir = path.join(V3, "docs/qa-samples");

  const manifestPath = path.join(OUTPUT, "manifest.json");
  const manifest = existsSync(manifestPath) ? readJson(manifestPath) : { surahs: {} };

  for (const s of surahs) {
    const c = corpora.get(s);
    if (!c) {
      evidence.push(`surah ${s}: no compiled corpus — nothing to sample`);
      met = false;
      continue;
    }
    const currentHash = manifest.surahs?.[String(s)]?.corpusHash ?? null;
    const distractorCount = (c.distractors ?? []).length;

    if (distractorCount === 0) {
      evidence.push(`surah ${s}: ZERO distractors compiled — every option set would be degenerate`);
      met = false;
      continue;
    }

    const record = existsSync(dir)
      ? readdirSync(dir).find((f) => f === `${s}.json`)
      : undefined;
    if (!record) {
      evidence.push(
        `surah ${s}: ${distractorCount} distractors, NO signed QA sample on record ` +
          `(expected docs/qa-samples/${s}.json — generate with scripts/distractor-qa.mjs)`,
      );
      met = false;
      continue;
    }

    let signed;
    try {
      signed = readJson(path.join(dir, `${s}.json`));
    } catch {
      evidence.push(`surah ${s}: QA sample record is unreadable`);
      met = false;
      continue;
    }

    if (currentHash && signed.corpusHash !== currentHash) {
      evidence.push(
        `surah ${s}: QA sample was taken against corpus ${signed.corpusHash}, current is ${currentHash} — STALE`,
      );
      met = false;
      continue;
    }
    if (signed.signedBy == null || signed.signedBy === "") {
      evidence.push(`surah ${s}: QA sample exists but carries no human sign-off (signedBy is empty)`);
      met = false;
      continue;
    }
    evidence.push(
      `surah ${s}: ${signed.sampled ?? "?"} of ${distractorCount} sampled ` +
        `(${signed.pct ?? "?"}%), signed by ${signed.signedBy} against corpus ${signed.corpusHash}`,
    );
  }

  return criterion("Distractor QA sampled (10% per surah, human-signed)", met, evidence);
}

// ---------------------------------------------------------------------------
// CRITERION 4 — hashSpecVersion FROZEN
// ---------------------------------------------------------------------------
// Edge case #26: a hash-spec change re-hashes everything and ambers every row
// at once. Frozen here means: one single version across every launch surah AND
// agreement with the compiler's own HASH_SPEC_VERSION constant. A surah
// compiled at a different spec version than its siblings is a partial re-hash
// waiting to happen.
function checkHashSpecFrozen(corpora) {
  const evidence = [];
  const hashSrc = readFileSync(path.join(V3, "packages/corpus-compiler/src/hash.ts"), "utf8");
  const m = /HASH_SPEC_VERSION\s*=\s*(\d+)/.exec(hashSrc);
  const compilerVersion = m ? Number(m[1]) : null;
  evidence.push(
    compilerVersion == null
      ? "could not read HASH_SPEC_VERSION from hash.ts"
      : `compiler HASH_SPEC_VERSION = ${compilerVersion}`,
  );

  const seen = new Set();
  let met = compilerVersion != null;
  for (const s of surahs) {
    const c = corpora.get(s);
    if (!c) {
      evidence.push(`surah ${s}: no compiled corpus`);
      met = false;
      continue;
    }
    const v = c.meta.hashSpecVersion;
    seen.add(v);
    if (v !== compilerVersion) {
      evidence.push(`surah ${s}: compiled at hashSpecVersion ${v}, compiler is at ${compilerVersion} — RECOMPILE NEEDED`);
      met = false;
    } else {
      evidence.push(`surah ${s}: hashSpecVersion ${v}`);
    }
  }
  if (seen.size > 1) {
    evidence.push(`MIXED hashSpecVersions across launch surahs: ${[...seen].join(", ")}`);
    met = false;
  }
  return criterion("hashSpecVersion frozen (edge case #26)", met, evidence);
}

// ---------------------------------------------------------------------------
// CRITERION 5 — CORPUS + SPECS FROZEN
// ---------------------------------------------------------------------------
// "Frozen" is a claim about the FUTURE, which no script can verify. What IS
// verifiable is whether the corpus on disk still matches what the manifest
// says was compiled — i.e. whether an uncommitted recompile or a hand-edit has
// already moved content out from under the manifest. If they disagree today,
// nothing is frozen and the qari would sign an artifact the build does not
// serve.
//
// The second half: a stale corpus.json. Every surah dir keeps
// content-addressed corpus.<hash16>.json files plus a corpus.json pointer.
// If the pointer's content-hash is not the manifest's currentHash, the
// unhashed file — the one lib/corpus reads — is a DIFFERENT artifact from the
// one recorded. That is edge case #27's shape one layer up.
function checkCorpusFrozen(corpora) {
  const evidence = [];
  let met = true;
  const manifestPath = path.join(OUTPUT, "manifest.json");
  if (!existsSync(manifestPath)) {
    return criterion("Corpus + specs frozen", false, ["no output/manifest.json — nothing has been compiled"]);
  }
  const manifest = readJson(manifestPath);

  for (const s of surahs) {
    const entry = manifest.surahs?.[String(s)];
    if (!entry) {
      evidence.push(`surah ${s}: absent from the manifest — it is not part of the compiled build`);
      met = false;
      continue;
    }
    const addressed = path.join(OUTPUT, String(s), `corpus.${entry.corpusHash}.json`);
    if (!existsSync(addressed)) {
      evidence.push(`surah ${s}: manifest names corpus ${entry.corpusHash} but that file is MISSING`);
      met = false;
      continue;
    }
    // The pointer file and the addressed file must be the same bytes. If they
    // differ, `corpus.json` (what the app loads) is not what the manifest
    // recorded, and the freeze is over an artifact nobody is serving.
    const a = readFileSync(addressed, "utf8");
    const pointerPath = path.join(OUTPUT, String(s), "corpus.json");
    const b = existsSync(pointerPath) ? readFileSync(pointerPath, "utf8") : null;
    if (b === null) {
      evidence.push(`surah ${s}: no corpus.json pointer file`);
      met = false;
    } else if (a !== b) {
      evidence.push(
        `surah ${s}: corpus.json DIFFERS from the manifest's corpus.${entry.corpusHash}.json — ` +
          `the served artifact is not the recorded one`,
      );
      met = false;
    } else {
      evidence.push(`surah ${s}: corpus.json matches manifest hash ${entry.corpusHash} (${entry.ayahCount} ayat)`);
    }
  }

  // The second-surah scope question (BUILD-PLAN Q3). An open scope is an open
  // freeze: a surah chosen after the freeze is a surah the qari did not sign,
  // and #176 is precisely that failure ("launch gate scoped to Yusuf while
  // first screens serve 112/103/second surah").
  const plan = readFileSync(path.join(V3, "docs/BUILD-PLAN.md"), "utf8");
  if (/Q3 \(blocks M1 scope/.test(plan)) {
    evidence.push(
      "BUILD-PLAN Q3 (launch surah set — Al-Mulk vs a Juz Amma batch) is still listed OPEN. " +
        "The freeze scope cannot be final while the surah list is not (edge case #176).",
    );
    met = false;
  }

  return criterion("Corpus + specs frozen", met, evidence);
}

// ---------------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------------
const corpora = loadCorpora();
const results = [
  checkMsDecision(corpora),
  checkSceneBeats(corpora),
  checkDistractorQa(corpora),
  checkHashSpecFrozen(corpora),
  checkCorpusFrozen(corpora),
];

const allMet = results.every((r) => r.met || !r.blocking);

if (asJson) {
  console.log(
    JSON.stringify(
      { surahs, allMet, bookable: allMet, criteria: results },
      null,
      2,
    ),
  );
} else {
  console.log("");
  console.log("CONTENT-FREEZE-BEFORE-QARI GATE — M9 entry criteria");
  console.log(`launch surahs checked: ${surahs.join(", ")}`);
  console.log("");
  // HARD ORDER, printed every run. M9 is a SEQUENCE: shipping out of order
  // re-buys scholar hours, so the order is on the screen next to the verdict
  // rather than in a document someone would have to remember to open.
  console.log("HARD ORDER (BUILD-PLAN M9):");
  console.log("  MS decision executed  ->  scene beats authored for EVERY launch surah");
  console.log("  ->  distractor QA 10% sample  ->  hashSpecVersion frozen");
  console.log("  ->  corpus + spec freeze  ->  qari sessions");
  console.log("");
  for (const r of results) {
    console.log(`${r.met ? "MET    " : "NOT MET"}  ${r.name}`);
    for (const e of r.evidence) console.log(`         - ${e}`);
    console.log("");
  }
  console.log(
    allMet
      ? "GATE OPEN — the criteria are met. A qari session booked against this corpus\n" +
          "will not be invalidated by a pending content change."
      : "GATE CLOSED — do NOT book a booking-confirmed qari session.\n" +
          "A sign-off collected now WILL be invalidated and re-paid in scholar hours\n" +
          "(BUILD-PLAN, Content-freeze-before-qari gate).",
  );
  console.log("");
}

process.exit(allMet ? 0 : 1);
