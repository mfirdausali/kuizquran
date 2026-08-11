#!/usr/bin/env node
// GATE: no QAC morphology may reach a browser (v3-D24, build-plan step 30/M10).
//
// ---------------------------------------------------------------------------
// THE DECISION THIS ENFORCES
// ---------------------------------------------------------------------------
// v3-D24, verbatim:
//
//   "`lemma` / `root` / `class` feed distractor generation and are **stripped
//    from the learner artifact**. 1131/1777 shipped words currently carry
//    `root`, so GPL exposure in a paid bundle is real. Attribution page ships
//    regardless."
//
// The Quranic Arabic Corpus annotations are GPL (see `v1/data/raw/SOURCES.md`).
// The Quran TEXT is not the issue and never was — it may be copied verbatim.
// The issue is the morphological ANALYSIS: lemma, root and part-of-speech class
// are Kais Dukes' copyrighted, GPL-licensed work, and shipping them inside a
// paid, closed bundle is the exposure counsel would be asked about.
//
// ---------------------------------------------------------------------------
// WHY THIS GATE EXISTS RATHER THAN A COMMENT IN THE STAGING SCRIPT
// ---------------------------------------------------------------------------
// v3-D24 was ratified on 2026-08-10 and was STILL NOT IMPLEMENTED when the M10
// launch audit ran: `public/corpus/112.json` carried `lemma`, `root` and
// `class` on all 15 of its words. The decision existed, was cited, and was
// wrong about its own codebase — which is the exact failure mode DECISIONS.md
// v3-D55 describes ("Prose has failed this build five times").
//
// So the strip is enforced where it can fail a build: this gate reads the
// artifacts that are ACTUALLY IN `public/` and greps them for the three field
// names. It asserts the OUTPUT, not the intention — it would still fail if
// someone deleted the strip from `stage-corpus.mjs`, and it would still fail if
// a future second staging path bypassed that script entirely.
//
// ---------------------------------------------------------------------------
// WHAT THIS GATE DELIBERATELY DOES NOT DO
// ---------------------------------------------------------------------------
// It does not touch `packages/corpus-compiler/output/`. Morphology there is
// CORRECT and required: it feeds distractor generation at build time, which is
// precisely the "build-time only" v3-D24 permits. Failing on the compiler's own
// output would be enforcing a rule nobody made.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(dir, "../public");

/** The GPL-licensed QAC annotation fields. */
const FORBIDDEN = ["lemma", "root", "class"];

/** Every .json under public/ — the browser-reachable surface. */
function jsonFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const p = path.join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".json")) out.push(p);
    }
  };
  walk(root);
  return out;
}

const findings = [];
let scanned = 0;
let wordsChecked = 0;

for (const file of jsonFiles(PUBLIC)) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    continue; // not our concern; other gates own malformed JSON
  }

  const words = Array.isArray(parsed?.words) ? parsed.words : null;
  if (!words) continue; // not a corpus artifact

  scanned++;
  const rel = path.relative(path.resolve(dir, ".."), file);

  // Structural check on the ACTUAL word objects, not a substring search over
  // the file: a gloss legitimately containing the English word "root" must not
  // fail this gate, and a field named `root` must not pass it.
  for (const field of FORBIDDEN) {
    const count = words.filter(
      (w) => w && typeof w === "object" && Object.hasOwn(w, field),
    ).length;
    if (count > 0) {
      findings.push({ rel, field, count, total: words.length });
    }
  }
  wordsChecked += words.length;
}

if (findings.length > 0) {
  console.error("\n✗ corpus-morphology gate FAILED — GPL annotations are reachable from a browser.\n");
  for (const f of findings) {
    console.error(`   ✗  ${f.rel}  —  \`${f.field}\` present on ${f.count}/${f.total} words`);
  }
  console.error(
    "\n   v3-D24: QAC `lemma`/`root`/`class` are BUILD-TIME ONLY and must be\n" +
      "   stripped from the learner artifact. The Quranic Arabic Corpus\n" +
      "   annotations are GPL (v1/data/raw/SOURCES.md); this bundle is paid and\n" +
      "   closed. The Quran TEXT is not affected — only the morphological\n" +
      "   analysis.\n\n" +
      "   The strip lives in `scripts/stage-corpus.mjs#stripMorphology`. If a\n" +
      "   new staging path was added, it needs the same strip.\n",
  );
  process.exit(1);
}

console.log(
  `corpus-morphology: OK — ${scanned} corpus artifact(s), ${wordsChecked} words, ` +
    `no QAC ${FORBIDDEN.map((f) => `\`${f}\``).join("/")} reachable from a browser (v3-D24).`,
);
