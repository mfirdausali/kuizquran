// FETCH A STAGED CORPUS FROM THE BROWSER — the client half of the corpus path.
//
// `lib/corpus/load.ts` is the SERVER loader: it reads the compiler's output
// with `node:fs` at request time, and says so. It cannot serve a client island,
// because `node:fs` does not resolve in a browser bundle — that is the guard
// that file documents, and it is correct.
//
// The demo IS a client island: the visitor taps tiles and the reconstruct state
// machine advances in their hand, with no server round trip per tap. So it
// needs the corpus as a fetched static asset. `scripts/stage-corpus.mjs` copies
// the compiled 112 corpus into `public/corpus/112.json` at prebuild/dev time
// (v3-D52: `output/` is gitignored, so the corpus is a build artifact and must
// never be imported by the bundler or committed as a second source of truth).
//
// This module is the ONE place that knows the served path, mirroring the way
// `lib/corpus/load.ts` is the one place that knows the fixture path.
//
// ---------------------------------------------------------------------------
// EVERY FAILURE RETURNS NULL. NONE THROWS.
// ---------------------------------------------------------------------------
// A clean checkout that has not run `make compile-corpus` has no staged corpus
// at all, and that is a legitimate state — not an exception. A throw here would
// take down the landing page for a missing build artifact, which is the worst
// possible trade: the page's job is to convert a visitor, and a blank page
// converts nobody. Null degrades to a designed unavailable state instead.
//
// The same reasoning covers a 404, an offline fetch, and a corpus that parses
// but holds nothing: all of them mean "no drill is possible here", and all of
// them must reach the surface as that one fact.

import type { Corpus } from "@engine/types.ts";

/** Where `scripts/stage-corpus.mjs` writes. One place, one owner. */
export function clientCorpusUrl(surah: number): string {
  return `/corpus/${surah}.json`;
}

/**
 * Fetch one staged surah, or null if this build cannot serve it.
 *
 * VERIFIES rather than trusts. A JSON body that parses is not yet a corpus:
 * `words` and `verses` must both be non-empty, or a surface could paint an
 * empty ayah line and a bank of nothing — which reads as a finished, blank
 * drill rather than as a missing one.
 */
export async function loadClientCorpus(surah: number, signal?: AbortSignal): Promise<Corpus | null> {
  try {
    const res = await fetch(clientCorpusUrl(surah), { signal });
    if (!res.ok) return null;
    const parsed: unknown = await res.json();
    return isServeable(parsed) ? parsed : null;
  } catch {
    // Offline, aborted, 404, malformed JSON. All the same fact to a caller.
    return null;
  }
}

/** Structural check on a fetched body. Narrow on purpose: it asserts only what
 *  a reconstruct pass actually consumes, so it cannot go stale against fields
 *  the compiler adds for the server or the admin console. */
function isServeable(value: unknown): value is Corpus {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Partial<Corpus>;
  return (
    Array.isArray(c.words) &&
    c.words.length > 0 &&
    Array.isArray(c.verses) &&
    c.verses.length > 0 &&
    Array.isArray(c.distractors)
  );
}
