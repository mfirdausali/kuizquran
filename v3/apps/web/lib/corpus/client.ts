"use client";

// CLIENT-SIDE CORPUS LOADING — the counterpart to `load.ts`, and deliberately
// a SEPARATE module rather than a branch inside it.
//
//     Corpus is server. Log is client.
//
// That boundary still holds: the corpus is still authored, compiled and owned
// server-side, and this module does not weaken it. What it adds is the one
// case the boundary never covered — a corpus a CLIENT surface must hold in its
// hand because the learner is tapping it.
//
// ---------------------------------------------------------------------------
// THE ONE CASE, NAMED
// ---------------------------------------------------------------------------
// WIREFRAME §17 screen 2 is a live tap-to-reconstruct of Al-Ikhlas 112:1 with
// NO ACCOUNT and no session. The reconstruct state machine advances per tap in
// the browser, so the words and their distractors must be in the browser. The
// same corpus, for the same reason, backs §18 §2's inline landing demo.
//
// Surah 12 is NOT here and must never be: it is 3.4 MB compiled, it is a
// server-rendered surface, and shipping it to a browser to render a table
// would be a straightforward performance defect. `load.ts` keeps serving it
// from disk. This module serves ONLY what a client genuinely taps.
//
// ---------------------------------------------------------------------------
// WHY `null` RATHER THAN A THROW — the same reasoning as load.ts
// ---------------------------------------------------------------------------
// The staged asset can legitimately be absent: `output/` is gitignored (v3-D52)
// so a checkout that has not run `make compile-corpus` has no corpus to stage,
// and `stage-corpus.mjs` warns rather than hard-fails for exactly that reason.
// A caller therefore receives `null` and renders a DESIGNED unavailable state.
//
// It must never render a fabricated ayah. There is no fallback corpus, no
// inline sample, no placeholder text — a surface with no corpus says so. This
// is the sacred-text rule at the failure path: the app would rather show
// nothing than show Quranic text it cannot prove came from the compiler.
//
// This is also edge case #91's mechanism ("offline before first precache →
// onboarding dead-end → explicit 'connect once to begin' screen"): a first
// visit with no network gets `null` here, and the caller has a real state to
// paint instead of an infinite spinner.

import type { Corpus } from "@engine/types.ts";

/** Surahs staged into `public/corpus/` by `scripts/stage-corpus.mjs`. This
 *  list and that script's CLIENT_SURAHS are the same decision written twice;
 *  the test asserts they agree, so a surah added to one and not the other
 *  fails rather than 404s at runtime. */
export const CLIENT_SURAHS: readonly number[] = [112, 103, 67];

/** The surah screen 2 and the landing demo reconstruct (WIREFRAME §17 / §18).
 *  Named once, here, so no surface hardcodes the number in its own JSX. */
export const DEMO_SURAH = 112;
/** The ayah those surfaces reconstruct. 112:1. */
export const DEMO_AYAH = 1;

/** Parsed once per page load. The corpus is static content-addressed data, so
 *  a second surface asking for the same surah re-uses the parse rather than
 *  re-fetching 16 KB and re-parsing it. */
const cache = new Map<number, Corpus>();

/**
 * A corpus is only usable if it can actually produce a pass. An empty or
 * truncated payload is treated as ABSENT, not as an empty corpus — the same
 * distinction `load.ts` draws, for the same reason: an "empty corpus" renders
 * a plausible-looking blank instead of a designed unavailable state.
 */
function usable(value: unknown): value is Corpus {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Partial<Corpus>;
  return (
    Array.isArray(c.verses) &&
    c.verses.length > 0 &&
    Array.isArray(c.words) &&
    c.words.length > 0 &&
    Array.isArray(c.distractors)
  );
}

/**
 * Fetch one surah's corpus for a client surface, or `null` if this build
 * cannot serve it.
 *
 * NOT routed through `lib/sync/apiFetch.ts`: that module is the SINGLE EGRESS
 * for `/api` (check-boundaries clause 6) and carries the bearer token and the
 * 401 re-mint interceptor. This is a static asset under `/corpus/`, fetched by
 * a learner who by definition has no account yet — sending it through an auth
 * interceptor would both be wrong and would drag identity into a surface whose
 * entire premise is that identity has not been asked for.
 */
export async function fetchCorpus(surah: number): Promise<Corpus | null> {
  const cached = cache.get(surah);
  if (cached) return cached;
  if (!CLIENT_SURAHS.includes(surah)) return null;

  try {
    const res = await fetch(`/corpus/${surah}.json`, { cache: "force-cache" });
    if (!res.ok) return null;
    const parsed: unknown = await res.json();
    if (!usable(parsed)) return null;
    cache.set(surah, parsed);
    return parsed;
  } catch {
    // Offline, blocked, or malformed. All three mean the same thing to a
    // caller: there is no corpus to reconstruct, say so honestly.
    return null;
  }
}

/** Test seam ONLY — the module-level cache would otherwise leak one test's
 *  corpus into the next. Not exported from `lib/corpus/index`; nothing in the
 *  app calls it. */
export function __resetCorpusCache(): void {
  cache.clear();
}
