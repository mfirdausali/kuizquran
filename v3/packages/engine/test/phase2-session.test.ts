// ROADMAP Phase 2 exit criterion: "a multi-day simulated run advances ayat under
// each mode; BUG-1/BUG-2 regression tests prove pace + make-up now fire live."
//
// v2-BUG-1 was: v1's useSession.ts hardcoded `budgetMin:8` into assembleQueue, so
// Steady and Sprint collapsed to the identical drip. v2-BUG-2 was: the same
// caller hardcoded `lastActiveDay:null`, so the make-up merge (FR3 step 1) never
// fired live. Both callers are fixed in v2 by wiring pace.ts's PaceConfig and
// activity.ts's lastActiveDayMs into assembleQueue — this file proves it at the
// engine level (the real caller, src/session/useSession.ts, does the same thing).

import { describe, expect, it } from "vitest";
import type { DrillEvent } from "../src/types.ts";
import type { AtomState } from "../src/atom.ts";
import { rebuild } from "../src/rebuild.ts";
import { assembleQueue } from "../src/scheduler.ts";
import { gateDue } from "../src/gate.ts";
import { paceConfig, candidatesForPace, type PaceMode } from "../src/pace.ts";
import { lastActiveDayMs } from "../src/activity.ts";
import { DEFAULT_DAY_CONFIG, dayStart } from "../src/daybound.ts";

const DAY = 86_400_000;
const cfg = DEFAULT_DAY_CONFIG;
const CANDIDATE_POOL = Array.from({ length: 20 }, (_, i) => 100 + i); // synthetic ayat 100..119
const wordCounts = new Map<number, number>(CANDIDATE_POOL.map((a) => [a, 15]));

function morningOf(dayEpoch: number): number {
  return dayStart(dayEpoch, cfg) + 3.5 * 3600_000; // 08:00-ish
}

function encodeEvents(ayah: number, t: number): DrillEvent[] {
  return [
    { type: "rung_start", ts: t, surah: 12, ayah, rung: "S1" },
    { type: "rung_complete", ts: t + 1000, surah: 12, ayah, rung: "S1" },
    { type: "rung_complete", ts: t + 2000, surah: 12, ayah, rung: "S2" },
    { type: "rung_complete", ts: t + 3000, surah: 12, ayah, rung: "S3" },
    { type: "ayah_complete", ts: t + 3500, surah: 12, ayah, rung: "S3" },
  ];
}

function gateEvent(ayah: number, t: number): DrillEvent {
  return { type: "gate_result", ts: t, surah: 12, ayah, rung: "S3", correct: true };
}

/** Drive `days` learning-days of a session under one pace mode. Every due gate is
 *  passed, then (v2-D07: "recompute unlockPermitted after an in-session gate
 *  pass") the queue is RE-ASSEMBLED from the post-gate atoms so a gate-day still
 *  delivers today's Learn item instead of freezing until tomorrow. Every Learn
 *  item the re-assembled queue offers (bounded by the mode's ceiling and budget)
 *  gets fully encoded. Returns the count of distinct ayat encoded. */
function runUnderPace(mode: PaceMode, days: number): number {
  const pc = paceConfig(mode);
  const base = new Date(2026, 6, 14, 12, 0, 0, 0).getTime();
  const log: DrillEvent[] = [];

  function learnCandidatesFor(atoms: AtomState[]) {
    const encodedRefs = new Set(atoms.filter((a) => a.kind === "ayah" && a.encoded).map((a) => a.ref));
    const window = CANDIDATE_POOL.filter((a) => !encodedRefs.has(a));
    return candidatesForPace(window, mode);
  }

  for (let d = 0; d < days; d++) {
    const morning = morningOf(base + d * DAY);
    const atomsBeforeGates = [...rebuild(log, cfg).values()];
    const lastActiveDay = lastActiveDayMs(log); // BUG-2 fix: real log, never null-by-default

    // Pass every due gate first (FR3 step 2, ahead of Learn).
    for (const a of atomsBeforeGates) {
      if (gateDue(a, morning)) log.push(gateEvent(a.ref, morning + 500));
    }

    // v2-D07: recompute from the POST-gate atoms so today's pass unlocks today's
    // Learn rather than deferring it to tomorrow.
    const atomsAfterGates = [...rebuild(log, cfg).values()];
    const queue = assembleQueue({
      atoms: atomsAfterGates,
      now: morning,
      lastActiveDay,
      wordCounts,
      cfg: {
        day: cfg,
        learnCandidates: learnCandidatesFor(atomsAfterGates),
        budgetMin: pc.budgetMin,
        gateTolerance: pc.gateTolerance,
      },
    });

    let t = morning + 1000;
    for (const item of queue) {
      if (item.kind !== "learn") continue;
      for (const e of encodeEvents(item.ayah, t)) log.push(e);
      t += 5000;
    }
  }

  const finalAtoms = rebuild(log, cfg);
  let encoded = 0;
  for (const a of finalAtoms.values()) if (a.kind === "ayah" && a.encoded) encoded++;
  return encoded;
}

describe("Phase 2 exit criterion: multi-day simulated run advances ayat under each mode", () => {
  const DAYS = 5;

  it("Steady encodes new ayat at its 1/day ceiling", () => {
    const encoded = runUnderPace("steady", DAYS);
    expect(encoded).toBe(DAYS); // exactly one new ayah per day, budget permitting
  });

  it("Sprint encodes strictly more ayat than Steady over the same span (v2-BUG-1 fixed)", () => {
    const steady = runUnderPace("steady", DAYS);
    const sprint = runUnderPace("sprint", DAYS);
    expect(sprint).toBeGreaterThan(steady);
  });

  it("Maintain never encodes a new ayah, no matter how many days pass", () => {
    const encoded = runUnderPace("maintain", DAYS);
    expect(encoded).toBe(0);
  });
});

describe("v2-BUG-1 regression: budgetMin is genuinely wired (Steady ≠ Sprint on the SAME day)", () => {
  it("identical atom state, different pace mode ⇒ different learn-item count in the queue", () => {
    const now = morningOf(new Date(2026, 6, 14, 12, 0, 0, 0).getTime());
    const learnCandidatesFull = CANDIDATE_POOL.slice(0, 5);

    const steadyQueue = assembleQueue({
      atoms: [],
      now,
      lastActiveDay: null,
      wordCounts,
      cfg: {
        day: cfg,
        learnCandidates: candidatesForPace(learnCandidatesFull, "steady"),
        budgetMin: paceConfig("steady").budgetMin,
      },
    });
    const sprintQueue = assembleQueue({
      atoms: [],
      now,
      lastActiveDay: null,
      wordCounts,
      cfg: {
        day: cfg,
        learnCandidates: candidatesForPace(learnCandidatesFull, "sprint"),
        budgetMin: paceConfig("sprint").budgetMin,
      },
    });

    const steadyLearns = steadyQueue.filter((i) => i.kind === "learn").length;
    const sprintLearns = sprintQueue.filter((i) => i.kind === "learn").length;
    expect(steadyLearns).toBe(1);
    expect(sprintLearns).toBeGreaterThan(steadyLearns);
    // The old bug hardcoded budgetMin:8 for every mode — assert the modes actually
    // carry distinct budgets into the call, not just distinct candidate windows.
    expect(paceConfig("sprint").budgetMin).not.toBe(paceConfig("steady").budgetMin);
  });
});

describe("v2-BUG-2 regression: lastActiveDay is wired from the real event log, not hardcoded null", () => {
  it("a real log's lastActiveDayMs makes a skipped-day make-up fire live", () => {
    const base = new Date(2026, 6, 14, 12, 0, 0, 0).getTime();
    const log: DrillEvent[] = encodeEvents(100, morningOf(base));
    const returnDay = base + 2 * DAY; // day 1 (the gate day) was skipped
    const atoms = [...rebuild(log, cfg).values()];

    const realLastActive = lastActiveDayMs(log); // the fix: derived from the log
    expect(realLastActive).not.toBeNull();

    const queueWithFix = assembleQueue({
      atoms,
      now: morningOf(returnDay),
      lastActiveDay: realLastActive,
      wordCounts,
      cfg: { day: cfg, budgetMin: 8 },
    });
    expect(queueWithFix.some((q) => q.kind === "makeup")).toBe(true);

    // The OLD bug: hardcoding null suppresses the make-up merge entirely (step 1
    // of FR3 never fires) — demonstrate the concrete behavioral gap being closed.
    const queueWithOldBug = assembleQueue({
      atoms,
      now: morningOf(returnDay),
      lastActiveDay: null,
      wordCounts,
      cfg: { day: cfg, budgetMin: 8 },
    });
    expect(queueWithOldBug.some((q) => q.kind === "makeup")).toBe(false);
  });
});
