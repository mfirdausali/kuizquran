// Session summary (v0.9 session-end screen). Pure — turns the append-only event
// log into the facts the completion screen shows: duration, recall (accuracy),
// ayat completed, and a time-of-day greeting. All arithmetic lives here so React
// only formats (invariant #6). Honors invariant #1 (whole-ayah count only) and
// invariant #3 (first-pass meaning errors are pretest, excluded from recall).

import type { DrillEvent } from "./types.ts";
import { DEFAULT_DAY_CONFIG, type DayConfig } from "./daybound.ts";

/** Hour-of-day (0-23) `ts` displays as, AS OBSERVED IN `cfg.tz` — never the
 *  machine's own zone (build-plan step 8's tz-explicit rewrite). */
function hourInTz(ts: number, cfg: DayConfig): number {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: cfg.tz, hour: "2-digit", hour12: false }).format(
    new Date(ts),
  );
  const n = Number(hour);
  return n === 24 ? 0 : n;
}

export type Greeting = "morning" | "afternoon" | "evening" | "night";

export interface SessionSummary {
  /** Wall-clock ms from the session's start to its last recorded tap. */
  durationMs: number;
  /** Correct graded taps ÷ total graded taps, 0..1. Pretest & free-play excluded.
   *  Null when there were no graded taps (e.g. a pure gate/chain session). */
  recall: number | null;
  /** Whole ayat completed this session (the graded unit — invariant #1). */
  ayatCompleted: number;
  /** Distinct ayah numbers completed this session (in completion order). */
  ayatRefs: number[];
  /** Total taps recorded this session (for reference; not the graded count). */
  taps: number;
  /** Time-of-day bucket from the session's start, for the greeting line. */
  greeting: Greeting;
}

/** Greeting bucket from an hour (0–23) in the user's local day. */
export function greetingForHour(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/**
 * Summarize ONE session's worth of events. Pass the events from the most recent
 * `session_start` onward (the caller slices the log). `hourOf` maps a ts to an
 * hour; the default resolves it in `cfg.tz` (build-plan step 8 — never the
 * machine's own zone), and stays overridable so tests can inject an
 * hour directly without needing a real epoch/tz pair. Duration is
 * (last tap ts − session_start ts); a session with no taps has duration 0.
 */
export function summarizeSession(
  events: DrillEvent[],
  cfg: DayConfig = DEFAULT_DAY_CONFIG,
  hourOf: (ts: number) => number = (ts) => hourInTz(ts, cfg),
): SessionSummary {
  const start = events.find((e) => e.type === "session_start");
  const startTs = start?.ts ?? events[0]?.ts ?? 0;

  let lastTapTs = startTs;
  let taps = 0;
  let graded = 0;
  let gradedCorrect = 0;
  const ayatRefs: number[] = [];

  for (const e of events) {
    // The v2 drill emits `reconstruct_tap` per blank and `ayah_produced` per
    // finished pass (v2 Phase 1); the legacy `tap`/`ayah_complete` names are kept
    // so historical logs still summarize. Both vocabularies fold identically here.
    if (e.type === "tap" || e.type === "reconstruct_tap") {
      taps++;
      if (e.ts > lastTapTs) lastTapTs = e.ts;
      // Graded taps: structured session only (free play is evidence-only,
      // invariant #4/#5) and NOT a first-pass meaning error (pretest, #3).
      const isFreePlay = e.structured === false;
      const isPretest = e.pretest === true;
      if (!isFreePlay && !isPretest && e.correct !== undefined) {
        graded++;
        if (e.correct) gradedCorrect++;
      }
    } else if (e.type === "ayah_complete" || e.type === "ayah_produced") {
      if (e.ts > lastTapTs) lastTapTs = e.ts;
      if (!ayatRefs.includes(e.ayah)) ayatRefs.push(e.ayah);
    } else if (e.type === "gate_result" && e.correct === true) {
      // A PASSED cold gate is the whole point of a gate-only session (B11) —
      // it commits no ayah_produced/ayah_complete of its own (rebuild.ts:88),
      // so without this branch a learner who did nothing but pass their gate
      // saw "0 ayat" on the summary screen for real, graded work.
      if (e.ts > lastTapTs) lastTapTs = e.ts;
      if (!ayatRefs.includes(e.ayah)) ayatRefs.push(e.ayah);
    }
  }

  return {
    durationMs: Math.max(0, lastTapTs - startTs),
    recall: graded > 0 ? gradedCorrect / graded : null,
    ayatCompleted: ayatRefs.length,
    ayatRefs,
    taps,
    greeting: greetingForHour(hourOf(startTs)),
  };
}

/** Format a duration (ms) as m:ss, e.g. 492000 → "8:12". Sub-minute shows 0:ss. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
