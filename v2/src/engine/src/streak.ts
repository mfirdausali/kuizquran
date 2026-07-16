// Streak (FR9). Counts completed-session learning-days. A miss PAUSES the streak
// (it doesn't zero — no punishment); a make-up day repairs a single missed day.
// De-emphasize length (PRD anti-pattern: streak-as-idol) — the model exposes the
// facts; the UI keeps it quiet. Pure; `now` passed in.

import { learningDayIndex, type DayConfig } from "./daybound.ts";
import type { DrillEvent } from "./types.ts";

export interface StreakState {
  /** Current streak length in active learning-days ending today or yesterday. */
  length: number;
  /** True when today has NO activity yet but yesterday did (streak intact, at risk). */
  atRisk: boolean;
  /** True when a day was missed and the streak is paused (repairable by a make-up). */
  pausedOnMiss: boolean;
  /** True when a make-up today would repair a single missed day. */
  makeupAvailable: boolean;
  /** The most recent active learning-day index, or null if never active. */
  lastActiveDay: number | null;
}

/**
 * Compute streak from the set of learning-day indices on which a session was
 * COMPLETED (e.g. from ayah_complete / rung_complete / gate_result events).
 */
export function computeStreak(
  completedDayIndices: Iterable<number>,
  now: number,
  cfg?: DayConfig,
): StreakState {
  const days = new Set<number>(completedDayIndices);
  if (days.size === 0) {
    return { length: 0, atRisk: false, pausedOnMiss: false, makeupAvailable: false, lastActiveDay: null };
  }
  const today = learningDayIndex(now, cfg);
  const lastActive = Math.max(...days);

  // Count consecutive active days ending at the most recent active day.
  let length = 0;
  let d = lastActive;
  while (days.has(d)) {
    length++;
    d--;
  }

  const gap = today - lastActive; // learning-days since last activity
  return {
    length,
    atRisk: gap === 1, // yesterday active, today not yet
    pausedOnMiss: gap >= 2, // ≥1 full day missed → paused (not zeroed)
    // A make-up repairs exactly ONE missed day: yesterday was missed, the day
    // before was active (gap of 2). Beyond that the make-up window has passed.
    makeupAvailable: gap === 2,
    lastActiveDay: lastActive,
  };
}

/** Event types that mark a learning-day as "a session was completed" — see
 *  computeStreak's own doc comment. Deliberately NOT gated on `structured` — a
 *  victory-lap chain (structured:false) or a Test still counts as showing up for
 *  streak/heatmap purposes even though neither moves strength (v2-D11: "records
 *  the run for streak/heatmap, no strength change"; v2-D14 mirrors that for
 *  Test). Bare `tap`/`reconstruct_tap` evidence doesn't count on its own — only
 *  a completed unit does. */
const COMPLETION_TYPES: ReadonlySet<DrillEvent["type"]> = new Set([
  "ayah_complete",
  "rung_complete",
  "ayah_produced",
  "gate_result",
  "chain_step",
  "test_start",
]);

/**
 * Learning-day indices on which a session was completed — feeds computeStreak()
 * and the Progress Report's streak calendar (v2-D17). Pure, no clock.
 */
export function completedDayIndices(events: DrillEvent[], cfg?: DayConfig): number[] {
  const days = new Set<number>();
  for (const e of events) {
    if (!COMPLETION_TYPES.has(e.type)) continue;
    days.add(learningDayIndex(e.ts, cfg));
  }
  return [...days].sort((a, b) => a - b);
}
