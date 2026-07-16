// Resume policy (FR5). Given the gap since the last activity (and whether the day
// boundary was crossed), decide how to re-enter. Pure.
//
//   <2 min      → resume in place
//   <1 hr       → restart the current drill
//   >1 hr       → re-plan the queue with a warm-up
//   past the day boundary (Fajr→secular rollover) → make-up merge
//
// Interrupted latencies are discarded; same-hour restarts are weighted as massed
// (that weighting is applied in update() via same-learning-day detection; here we
// only classify the re-entry).

import { isSameLearningDay, type DayConfig } from "./daybound.ts";

export type ResumeAction = "resume" | "restart" | "replan" | "makeup";

export const TWO_MIN = 2 * 60_000;
export const ONE_HOUR = 60 * 60_000;

export interface ResumeDecision {
  action: ResumeAction;
  /** True when latency for the interrupted item should be discarded. */
  discardLatency: boolean;
  /** True when the restart should be weighted as a massed (same-hour) rep. */
  massed: boolean;
}

/**
 * Classify a re-entry. `lastActivity` and `now` are epoch-ms; if the day boundary
 * was crossed since lastActivity, a make-up merge takes precedence over the raw
 * gap classification.
 */
export function resumePolicy(
  lastActivity: number,
  now: number,
  cfg?: DayConfig,
): ResumeDecision {
  const gap = Math.max(0, now - lastActivity);

  // Past the day boundary → make-up merge, regardless of raw gap size.
  if (!isSameLearningDay(lastActivity, now, cfg)) {
    return { action: "makeup", discardLatency: true, massed: false };
  }

  if (gap < TWO_MIN) {
    return { action: "resume", discardLatency: false, massed: false };
  }
  if (gap < ONE_HOUR) {
    // Restart the drill; a same-hour restart is weighted massed.
    return { action: "restart", discardLatency: true, massed: true };
  }
  // >1 hr but same learning-day → re-plan with a warm-up.
  return { action: "replan", discardLatency: true, massed: false };
}
