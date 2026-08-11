#!/usr/bin/env node
// STAGE THE COMPILED CORPUS INTO public/ — the serving path for surah 112.
//
// ---------------------------------------------------------------------------
// WHY THIS SCRIPT EXISTS AT ALL
// ---------------------------------------------------------------------------
// WIREFRAME §17 screen 2 ("first recall, immediately") and §18 §2 (the landing
// demo) both need Al-Ikhlas 112:1 as a LIVE tap-to-reconstruct, in the browser,
// before any account exists. That is a CLIENT surface — the learner taps tiles
// and the reconstruct state machine advances in their hand.
//
// But `lib/corpus/load.ts` reads the corpus with `node:fs` at request time on
// the SERVER, and deliberately serves exactly one surah (12, the engine's own
// fixture). It cannot serve a client island: `node:fs` does not resolve in a
// browser bundle, which is the guard that file documents.
//
// And per v3-D52 the compiler's `output/` tree is GITIGNORED — the corpus is a
// build artifact, not a source file. So the client cannot import it either: a
// bundler import of a gitignored path builds on this machine and fails in CI on
// a clean checkout, which is the worst possible failure shape (green locally,
// red only where nobody is looking).
//
// So the corpus is STAGED: copied out of the compiler's output into `public/`
// at prebuild time, where Next serves it as a static asset a client island can
// fetch. One directional copy, one owner, no second source of truth.
//
// ---------------------------------------------------------------------------
// WHY IT DOES NOT HARD-FAIL ON A MISSING CORPUS
// ---------------------------------------------------------------------------
// `output/` is gitignored, so a clean checkout that has not run
// `make compile-corpus` legitimately has nothing to stage. Hard-failing the
// build there would make `npm run build` impossible on a fresh clone, which is
// a worse outcome than a build whose demo surface degrades — and degrade is
// exactly what the consuming island is written to do (it renders a designed
// "corpus unavailable" state, never a fabricated ayah).
//
// What it DOES do is say loudly which surahs were staged and which were
// missing, so "the demo is blank" is never a mystery.
//
// It also VERIFIES rather than trusts: a staged corpus whose words or verses
// are empty is not written at all. An empty corpus that reached `public/` would
// let a surface paint a plausible-looking blank ayah, which is the sacred-text
// equivalent of painting `0` while the log is still loading.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(dir, "..");
const OUTPUT_ROOT = path.resolve(WEB_ROOT, "../../packages/corpus-compiler/output");
const PUBLIC_CORPUS = path.join(WEB_ROOT, "public", "corpus");

/** The surahs a CLIENT surface may need. 112 is screen 2 and the landing demo
 *  (WIREFRAME §17 screen 2, §18 §2). Surah 12 stays SERVER-side via
 *  lib/corpus/load.ts — it is 3.4 MB and must never be shipped to a browser.
 *
 *  103 AND 67 WERE ADDED THE DAY THE SESSION LOOP LANDED, and the reason is a
 *  real defect the e2e suite caught in a browser: onboarding's DEFAULT_SURAH is
 *  103, but only 112 was staged, so EVERY learner who accepted the default
 *  finished onboarding and hit "this surah is not available on this device" —
 *  a dead end on the product's main path. Unit tests missed it because they
 *  hardcode 112; only the real walk exercised the enrolled surah.
 *
 *  The rule this encodes: anything `OFFERED_SURAHS` can enroll a learner in
 *  MUST be staged, or enrolling them is a promise the app cannot keep. A test
 *  asserts that correspondence so the two lists cannot drift again. Yusuf (12)
 *  is the deliberate exception — it is offered but served from the server, and
 *  the session loop for it is a separate piece of work. */
const CLIENT_SURAHS = [112, 103, 67];

/** The engine reads exactly these fields (types.ts#Corpus). Everything else the
 *  compiler emits — connections, lookalikes, per-ayah hashes — is server or
 *  admin concern and is NOT shipped to a browser. Narrowing here keeps the
 *  payload honest about what the client actually consumes. */
function slim(corpus) {
  return {
    meta: corpus.meta,
    verses: corpus.verses,
    words: (corpus.words ?? []).map(stripMorphology),
    distractors: corpus.distractors,
    ...(corpus.sceneBeats ? { sceneBeats: corpus.sceneBeats } : {}),
  };
}

/** The QAC morphology fields. GPL — see `v1/data/raw/SOURCES.md`. */
const QAC_MORPHOLOGY_FIELDS = ["lemma", "root", "class"];

/**
 * STRIP QAC MORPHOLOGY BEFORE IT REACHES A BROWSER (v3-D24, M10 launch audit).
 *
 * v3-D24, verbatim: "`lemma` / `root` / `class` feed distractor generation and
 * are **stripped from the learner artifact**. 1131/1777 shipped words currently
 * carry `root`, so GPL exposure in a paid bundle is real."
 *
 * That decision was RATIFIED BUT NEVER IMPLEMENTED. Before this change, the
 * staged `public/corpus/112.json` carried `lemma`, `root` and `class` on all 15
 * of its words — a public, unauthenticated static asset inside a paid bundle,
 * carrying GPL-licensed annotations. The compiler's own output legitimately
 * keeps them (they feed distractor generation at BUILD time, which is exactly
 * the "build-time only" the decision permits); the leak was here, at the one
 * boundary where corpus data crosses into the browser, and `slim()` copied
 * `corpus.words` through wholesale.
 *
 * Stripping is safe: nothing outside the compiler reads these fields. The
 * engine's `types.ts` declares all three `| null`, and no engine module, lib or
 * component dereferences them — verified by grep across `packages/engine/src`,
 * `apps/web/lib`, `apps/web/components` and `apps/web/app`. Distractors arrive
 * pre-computed in `corpus.distractors`, which is what the client actually
 * consumes.
 *
 * `check-corpus-morphology.mjs` now fails the build if these fields reappear in
 * `public/`, so the decision is enforced mechanically rather than by memory.
 */
function stripMorphology(word) {
  const out = {};
  for (const [key, value] of Object.entries(word)) {
    if (!QAC_MORPHOLOGY_FIELDS.includes(key)) out[key] = value;
  }
  return out;
}

const staged = [];
const missing = [];

mkdirSync(PUBLIC_CORPUS, { recursive: true });

for (const surah of CLIENT_SURAHS) {
  const src = path.join(OUTPUT_ROOT, String(surah), "corpus.json");
  if (!existsSync(src)) {
    missing.push(`${surah} (no ${path.relative(WEB_ROOT, src)})`);
    continue;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(src, "utf8"));
  } catch (err) {
    missing.push(`${surah} (unparseable: ${err.message})`);
    continue;
  }

  // VERIFY, don't trust. A corpus with no words or no verses cannot produce a
  // reconstruct pass, and staging it would let the demo paint an empty ayah.
  const words = Array.isArray(parsed.words) ? parsed.words.length : 0;
  const verses = Array.isArray(parsed.verses) ? parsed.verses.length : 0;
  if (words === 0 || verses === 0) {
    missing.push(`${surah} (staged nothing: ${verses} verses, ${words} words)`);
    continue;
  }

  const payload = slim(parsed);
  writeFileSync(path.join(PUBLIC_CORPUS, `${surah}.json`), JSON.stringify(payload));
  staged.push(`${surah} (${verses} ayat, ${words} words, ${payload.distractors?.length ?? 0} distractors)`);
}

if (staged.length > 0) console.log(`corpus staged → public/corpus: ${staged.join(", ")}`);
if (missing.length > 0) {
  console.warn(
    `corpus NOT staged: ${missing.join(", ")}\n` +
      `   → run \`make compile-corpus\` (output/ is gitignored — v3-D52).\n` +
      `   → surfaces needing it will render their designed unavailable state.`,
  );
}
