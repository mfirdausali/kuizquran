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
 *  lib/corpus/load.ts — it is 3.4 MB and must never be shipped to a browser. */
const CLIENT_SURAHS = [112];

/** The engine reads exactly these fields (types.ts#Corpus). Everything else the
 *  compiler emits — connections, lookalikes, per-ayah hashes — is server or
 *  admin concern and is NOT shipped to a browser. Narrowing here keeps the
 *  payload honest about what the client actually consumes. */
function slim(corpus) {
  return {
    meta: corpus.meta,
    verses: corpus.verses,
    words: corpus.words,
    distractors: corpus.distractors,
    ...(corpus.sceneBeats ? { sceneBeats: corpus.sceneBeats } : {}),
  };
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
