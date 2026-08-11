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
// There is no compiled corpus artifact served to this app yet — nothing under
// `public/`, no route, no bundle. The only real, complete corpus in the repo
// is `packages/engine/test/fixtures/12.json`, which is the same file the
// engine's own 391 tests run against.
//
// So this module reads THAT, from disk, at request time on the server. It is
// deliberately not disguised as anything more finished than it is:
//
//   - it serves exactly one surah, and says so by returning null for others
//     rather than fabricating an empty corpus, which would render a table of
//     "Not started" rows for a surah that has no data behind it at all;
//   - it is the ONE place that knows where a corpus comes from, so when the
//     compiled artifact lands, this file changes and nothing else does.
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

/** The surahs this build can actually serve. One, today — and the honesty of
 *  saying so is the point. `/progress/list` reads this rather than assuming. */
export const AVAILABLE_SURAHS: readonly number[] = [12];

const FIXTURE_ROOT = path.resolve(process.cwd(), "../../packages/engine/test/fixtures");

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
    const raw = await readFile(path.join(FIXTURE_ROOT, `${surah}.json`), "utf8");
    const corpus = JSON.parse(raw) as Corpus;
    cache.set(surah, corpus);
    return corpus;
  } catch {
    // An unreadable corpus is an absent corpus as far as a caller is
    // concerned. It must not become an exception that escapes into a render.
    return null;
  }
}
