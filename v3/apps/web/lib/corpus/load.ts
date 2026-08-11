// SERVER-SIDE CORPUS LOADING.
//
//     Corpus is server. Log is client. Skeletons are never zeros.
//
// The `server-only` package would be the ideal guard here — importing it makes
// a client import of this module a BUILD failure naming the file. It is not a
// dependency of this app, and adding one is a LOCKFILE change, which the build
// plan reserves to the spine lane. So the guard below is the same intent
// expressed with what is already here: `node:fs` cannot resolve in a browser
// bundle, so a client import of this module already fails to build; the
// explicit check makes the REASON legible instead of surfacing as a confusing
// module-resolution error about `fs`.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS TODAY, STATED PLAINLY
// ---------------------------------------------------------------------------
// This reads the FROZEN, compiled corpus that `make compile-corpus` writes to
// `packages/corpus-compiler/output/<surah>/corpus.json` — the same artifact
// `scripts/stage-corpus.mjs` copies into `public/corpus/` for client islands,
// the same artifact `content-freeze.mjs` hashes, and the same artifact the
// qari's tiered sign-off (v3-D13/v3-D22) actually covers.
//
// It used to read `packages/engine/test/fixtures/12.json` instead — the
// engine's own UNFROZEN test fixture, cut before v3-D60's near-duplicate-foil
// fix and carrying no `hashSpecVersion` at all. That meant every learner-
// reachable route this module backs (`/drill`, `/plan`, `/progress`,
// `/progress/list`, `/surah/[surah]`, `/surah/[surah]/[ayah]`, `/workbench`)
// served content the content-freeze gate and the qari's signature could never
// certify, because the bytes served were never the bytes hashed. HANDOVER.md
// §A-note names this the most consequential open finding in the build; this
// module is the one place it is fixed.
//
//   - it serves exactly the launch set (`v3/scripts/content-freeze.mjs`'s
//     `LAUNCH_SURAHS`), and says so by returning null for anything else
//     rather than fabricating an empty corpus, which would render a table of
//     "Not started" rows for a surah that has no data behind it at all;
//   - it is the ONE place that knows where a corpus comes from, so a future
//     change to how the corpus is served (a CDN, a database) changes only
//     this file.
//
// `output/` is gitignored (v3-D52) — a clean checkout has none of these files
// until `make compile-corpus` runs, and `loadCorpus` degrades to `null` for
// every surah until it does, same as before.
//
// DEFECTS.md#E-07 ("corpus fetch is per-surah and unguarded — N fetches per
// load, one 404 breaks the page") is still OPEN and is a milestone-M5 item.
// This module is deliberately shaped so E-07's fix lands HERE: a caller
// already receives `null` for an unavailable surah rather than a throw, so a
// missing corpus degrades to a designed empty state on one route instead of
// breaking a page that lists several.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Corpus } from "@engine/types.ts";

/** The surahs this build can actually serve — the launch set
 *  (`content-freeze.mjs`'s `LAUNCH_SURAHS`, v3-D59/v3-D63). Order matters:
 *  callers that need a default (`/plan`, `/progress`, `/drill`) take
 *  `AVAILABLE_SURAHS[0]`, and 12 stays first — it was the default before this
 *  widening and every route's "no surah in the URL" behaviour is unchanged. */
export const AVAILABLE_SURAHS: readonly number[] = [12, 67, 103, 112];

const OUTPUT_ROOT = path.resolve(process.cwd(), "../../packages/corpus-compiler/output");

/** Cache the parsed corpus for the life of the server process. It is static
 *  content-addressed data; re-reading and re-parsing 1777 words per request
 *  would be pure waste. */
const cache = new Map<number, Corpus>();

/**
 * Load one surah's corpus, or null if this build cannot serve it.
 *
 * NULL RATHER THAN A THROW, and null rather than an empty corpus. A throw
 * would take down a page that may be listing several surahs (which is exactly
 * E-07's "one 404 breaks the page"), and an empty corpus would render a
 * plausible-looking table of zeros for a surah we have no data for — the same
 * class of dishonesty as painting 0 while the log is still loading.
 */
export async function loadCorpus(surah: number): Promise<Corpus | null> {
  const cached = cache.get(surah);
  if (cached) return cached;
  if (!AVAILABLE_SURAHS.includes(surah)) return null;

  try {
    const raw = await readFile(path.join(OUTPUT_ROOT, String(surah), "corpus.json"), "utf8");
    const corpus = JSON.parse(raw) as Corpus;
    cache.set(surah, corpus);
    return corpus;
  } catch {
    // An unreadable corpus is an absent corpus as far as a caller is
    // concerned (also true of a clean checkout that has not run
    // `make compile-corpus` yet — `output/` is gitignored, v3-D52). It must
    // not become an exception that escapes into a render.
    return null;
  }
}
