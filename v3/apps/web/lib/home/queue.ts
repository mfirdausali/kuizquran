"use client";

// THE DASHBOARD'S ONE NUMBER — WIREFRAME §1, and the reason the boundary exists.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE IS IN lib/ AND NOT IN components/home/
// ---------------------------------------------------------------------------
// `check-boundaries.mjs` clause 5 forbids `assembleQueue` (and any strength
// comparison, and any band test) from appearing under `app/` or `components/`.
// The regex matches the TOKEN, so even the import line would fail the build —
// which is the point: DEFECTS.md#B2 is made impossible by construction rather
// than merely fixed once. The due count therefore has to be DECIDED here and
// arrive at the island as data.
//
// `lib/progress/rows.ts` states the rule this module follows to the letter:
// THE COMPONENT NEVER COMPUTES, IT ONLY PRINTS. Every field of `HomeSurahRow`
// below is already a string or an already-derived number. The island puts them
// on screen and asks no questions.
//
// ---------------------------------------------------------------------------
// WHY THE COUNT COMES FROM `assembleFor` AND NOT FROM A CHEAPER APPROXIMATION
// ---------------------------------------------------------------------------
// It would be easy — and wrong — to walk the atoms here and count the ones that
// look due. `components/plan/PlanIsland.tsx#dueToday` does exactly that, and the
// number it gets is an APPROXIMATION of the queue: it knows nothing about the
// time budget, the make-up merge, the gate tolerance or the Learn interleave,
// all of which change how many items a session actually serves.
//
// A dashboard that says "5 items due" and then hands over a session of 3 has
// broken the one promise this product makes about its numbers (§10: the numbers
// shown must be the numbers the scheduler uses). So the count is `queue.length`
// of the VERY QUEUE the session will assemble, taken from the shared
// `assembleFor` in `lib/session/run.ts`. If the scheduler changes its mind
// tomorrow, this number changes with it, because it is the same number.
//
// ---------------------------------------------------------------------------
// NO ARABIC. The row is labelled from `surahLabel()` — Latin metadata (number,
// name, ayah count). A dashboard has no reason to paint scripture, and an
// incipit authored here would be scripture typed by hand.

import type { Corpus } from "@engine/types.ts";
import { completedDayIndices, computeStreak } from "@engine/streak.ts";
import { DEFAULT_DAY_CONFIG } from "@engine/daybound.ts";

import { assembleFor } from "@/lib/session/run";
import { OFFERED_SURAHS, surahLabel } from "@/lib/onboarding/surahs";
import { currentTz } from "@/lib/idb";

/** The route a learner takes into today's work. Named once so no view spells
 *  it, and so the CTA cannot point somewhere the dashboard did not decide. */
export const SESSION_HREF = "/session";

/**
 * ONE ENROLLED SURAH, FULLY DECIDED.
 *
 * There is no arithmetic left in any field. `dueCount` exists as a number only
 * so a test can compare it against the engine's own queue length; the island
 * renders `dueLabel`.
 */
export interface HomeSurahRow {
  readonly surah: number;
  /** "103 · Al-Asr · 3 ayat". Latin metadata, never Quranic text. */
  readonly label: string;
  /** Items the session will serve. The queue's own length, not an estimate. */
  readonly dueCount: number;
  /** The sentence a learner reads. Never assembled in the view. */
  readonly dueLabel: string;
  /**
   * Whether to offer the route into the session AT ALL.
   *
   * WIREFRAME §12: no "Continue" CTA when there is nothing to continue. A
   * button that starts nothing is the dashboard lying about what it has, so
   * the decision is made here and the view merely obeys it.
   */
  readonly ctaEnabled: boolean;
  /** Where the CTA goes. Only meaningful when `ctaEnabled`. */
  readonly ctaHref: string;
  /**
   * What the CTA says. It names what it STARTS — never a bare "Continue",
   * which describes nothing and is the word §12 objects to.
   */
  readonly ctaLabel: string;
  /**
   * "3-day streak", or `null` when there is nothing to show yet.
   *
   * `packages/engine/src/streak.ts` — FR9's quiet, personal streak (pauses on
   * a miss, never zeroes; no leaderboard, no ranking, no notifications; the
   * landing page's own FAQ describes exactly this, present-tense, as already
   * shipped: "There is a streak, and it is deliberately unimportant"). `null`
   * on a length of zero rather than a "0-day streak" — a fresh learner has no
   * streak yet, and a bare zero reads as a nag, which is the anti-pattern
   * `streak.ts`'s own header names ("streak-as-idol... the UI keeps it
   * quiet"). Deliberately does not surface `atRisk`/`pausedOnMiss` here: a
   * paused streak still counts (it is not punished), and the richer streak
   * calendar/freeze-token UI is BUILD-PLAN M11 social scope (v3-D06),
   * flag-gated and post-launch — this is only the minimal, private count the
   * FAQ promises today.
   */
  readonly streakLabel: string | null;
}

export interface BuildHomeSurahInput {
  surah: number;
  corpus: Corpus;
  /** Frontend-captured clock (invariant 5 — the engine never reaches for one,
   *  and neither does this module; the island captures it and passes it in). */
  now: number;
}

/**
 * Build the dashboard's row for the enrolled surah.
 *
 * Returns `null` when the queue could not be assembled at all — an unusable
 * corpus. That is NOT the same as a due count of zero, and the caller must
 * paint it differently: "nothing due today" is success and "this surah is not
 * available on this device" is a failure, and a learner cannot tell them apart
 * from one shared empty state (the same distinction `startSession` draws
 * between `nothing-due` and `no-corpus`).
 */
export async function buildHomeSurah(
  input: BuildHomeSurahInput,
): Promise<HomeSurahRow | null> {
  const { surah, corpus, now } = input;

  const assembled = await assembleFor({ surah, now }, corpus);
  if (!assembled) return null;

  const dueCount = assembled.queue.length;

  return {
    surah,
    label: labelFor(surah, corpus),
    dueCount,
    dueLabel: dueSentence(dueCount),
    // §12, decided here rather than in JSX.
    ctaEnabled: dueCount > 0,
    ctaHref: SESSION_HREF,
    ctaLabel: "Start today's session",
    streakLabel: streakLabelFor(assembled.prior, now),
  };
}

/**
 * "3-day streak" from the SAME event log `assembleFor` already read (no
 * second log read, no second source of truth). `null` on zero — see
 * `HomeSurahRow.streakLabel`'s own doc comment for why.
 */
function streakLabelFor(prior: Parameters<typeof completedDayIndices>[0], now: number): string | null {
  const cfg = { ...DEFAULT_DAY_CONFIG, tz: currentTz() };
  const days = completedDayIndices(prior, cfg);
  const streak = computeStreak(days, now, cfg);
  if (streak.length === 0) return null;
  return `${streak.length}-day streak`;
}

/**
 * "4 items due today" / "Nothing due today".
 *
 * The zero case gets WORDS, not a "0". §10's rule is about honesty, and "0" in
 * a row that otherwise shows counts reads as a failure to load rather than as a
 * finished day. The singular is spelled out because "1 items" is the small
 * carelessness that makes a learner distrust the larger number.
 */
function dueSentence(n: number): string {
  if (n === 0) return "Nothing due today.";
  return `${n} item${n === 1 ? "" : "s"} due today.`;
}

/**
 * The row's title.
 *
 * Prefers `surahLabel()` over the corpus so the dashboard reads the same as
 * onboarding's own picker — one spelling of "103 · Al-Asr · 3 ayat", not two
 * that drift. Falls back to the CORPUS META (surah number and ayah count, both
 * metadata) for a surah this build can serve but the picker does not offer, so
 * an enrolled learner never sees an unlabelled row.
 */
function labelFor(surah: number, corpus: Corpus): string {
  const offered = OFFERED_SURAHS.find((s) => s.surah === surah);
  if (offered) return surahLabel(offered);
  const ayat = corpus.meta.ayahCount;
  return `${surah} · ${ayat} ayat`;
}
