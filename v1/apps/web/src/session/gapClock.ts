// Gap clock — tracks the time since the last retrieval and classifies re-entry
// via the engine's pure resumePolicy. The clock owns "now" (Date.now lives here
// in the app shell, never in the engine).

import { resumePolicy, type DayConfig, type ResumeDecision } from "engine";

export class GapClock {
  private lastActivity: number;
  constructor(private cfg?: DayConfig, now: number = Date.now()) {
    this.lastActivity = now;
  }

  /** Mark a retrieval/tap as just happened. */
  touch(now: number = Date.now()): void {
    this.lastActivity = now;
  }

  /** Classify a re-entry after a gap (e.g. on visibilitychange/focus). */
  classify(now: number = Date.now()): ResumeDecision {
    return resumePolicy(this.lastActivity, now, this.cfg);
  }

  get last(): number {
    return this.lastActivity;
  }
}
