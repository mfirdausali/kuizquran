// THE TEST HISTORY SUMMARY — v2-D17 Progress Report's per-Test history list,
// rendered.
//
// `packages/engine/src/test.ts#testHistory` has been real and unit-tested
// (`test.test.ts`) since the Test self-quiz feature landed (v3-D104) but had
// ZERO production callers — v3-D104's own header names it explicitly: "a
// learner who completes a Test sees the immediate score screen but no later
// record of it on /progress... the natural next increment, not a correctness
// gap: `test_result` events are already durable and readable... only a new
// small `lib/progress` panel in the same shape as `RetentionPanel`/
// `GrowthPanel`." This module is that panel's data half, following
// `retention.ts`/`growth.ts`'s own rule: THE COMPONENT NEVER COMPUTES, IT
// ONLY PRINTS.
//
// PURE. `(surah, events, tz)` in, data out. No `Date.now`, no IO — `tz` is
// passed explicitly, the same convention `lib/plan/forecast.ts#dateLabel`
// and the `/plan` page already use, never read from the machine here.
// See DECISIONS.md v3-D105.

import type { DrillEvent } from "@engine/types.ts";
import { testHistory, type TestResultSummary } from "@engine/test.ts";

export interface TestHistoryRow {
  ts: number;
  /** "12:1–12:10" — the range a Test drilled. Latin digits, an LTR island,
   *  the same `${surah}:${ayah}` shape `retention.ts`'s `DecayRow.reference`
   *  already uses for a single site, extended with an en-dash for a range. */
  rangeLabel: string;
  /** "4 / 5 correct (80%)" — mirrors `TestIsland`'s own result-screen
   *  wording exactly (`components/test/TestIsland.tsx`'s result phase), so a
   *  learner reads the identical sentence on the day and later on /progress. */
  scoreLabel: string;
  /** A real calendar date, `tz`-explicit — never the browser's or server's
   *  ambient zone (Absolute A's spirit, applied outside the engine). */
  dateLabel: string;
  sentToReviews: boolean;
}

export interface TestHistorySummary {
  surah: number;
  count: number;
  /** "3 Tests taken" / "No Tests taken yet". */
  countLabel: string;
  /** Most recent first — a history reads newest-to-oldest, same order v2's
   *  own Progress Report used. */
  rows: TestHistoryRow[];
  /** True when no Test has ever been completed — the view's designed
   *  zero-state, never a bare empty list. */
  unmeasured: boolean;
}

export interface TestHistoryInput {
  surah: number;
  events: readonly DrillEvent[];
  tz: string;
}

/** `score` is `correct ÷ total` (types.ts's own documented 0..1 range, and
 *  exactly what `TestIsland.tsx#finishTest` writes: `correct /
 *  results.length`) — never a raw count. The count is recovered here, once,
 *  so no view re-derives it. */
function correctCountOf(r: TestResultSummary): number {
  return Math.round(r.score * r.total);
}

function rowFrom(surah: number, r: TestResultSummary, tz: string): TestHistoryRow {
  const correct = correctCountOf(r);
  const pct = r.total > 0 ? Math.round((correct / r.total) * 100) : 0;
  return {
    ts: r.ts,
    rangeLabel: `${surah}:${r.from}–${r.to}`,
    scoreLabel: `${correct} / ${r.total} correct (${pct}%)`,
    dateLabel: new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: tz,
    }).format(new Date(r.ts)),
    sentToReviews: r.sentToReviews,
  };
}

export function buildTestHistorySummary(input: TestHistoryInput): TestHistorySummary {
  const { surah, events, tz } = input;
  // Newest first — the same reversal v2's own Progress Report applied at
  // render time; done here instead, once, so no view re-derives the order.
  const rows = testHistory(events as DrillEvent[])
    .slice()
    .reverse()
    .map((r) => rowFrom(surah, r, tz));

  return {
    surah,
    count: rows.length,
    countLabel: rows.length === 0 ? "No Tests taken yet" : `${rows.length} Test${rows.length === 1 ? "" : "s"} taken`,
    rows,
    unmeasured: rows.length === 0,
  };
}
