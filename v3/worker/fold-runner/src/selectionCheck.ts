// selection_determinism_check's VERDICT layer. BUILD-PLAN.md:
//
//   "Replays a shuffled log (commit-derived seeds, failure-seed pinning) and
//    asserts recorded selection snapshots (siteKey, per-device ordinal,
//    lane/variant) are reproduced; includes the two-device-merge scenario."
//
// packages/engine/test/selection.test.ts already proves this property at
// unit scale. What did not exist until now is a RUNNER: the thing a
// scheduler invokes at 3am, whose exit code the window ledger counts. The
// unit test proves the property; this proves it again nightly, against the
// shuffled golden log, and reports a severity a ledger can count.
//
// Why re-prove what a unit test covers: the unit test runs on the code as
// committed. The nightly runs on the code as DEPLOYED, against fixture
// data as it exists on the host, under whatever engine version is pinned
// there. Those are different claims, and the 7-night window is about the
// second one.
//
// TAXONOMY. Selection has no cache to be stale against, so there is no
// natural analogue of fold's version skew — a shuffle-order divergence is
// always a real divergence. This runner therefore reports only green or P1,
// and says so rather than inventing a WARN it can never emit.

import type { Corpus, DrillEvent } from "../../../packages/engine/src/types.ts";
import { replaySelection, type SelectionResult } from "../../../packages/engine/src/selection.ts";
import type { Severity } from "./severity.ts";

/** Deterministic (seeded) Fisher-Yates. NOT Math.random — INVARIANTS.md
 *  Absolute A, and more practically: a divergence found under seed 7 must
 *  be reproducible by re-running under seed 7 ("failure-seed pinning"). A
 *  check whose failures cannot be reproduced is a rumour. */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export interface SelectionDivergence {
  seed: number;
  /** `${siteKey}:${deviceId}:${visitOrdinal}` — replaySelection's own trace key. */
  traceKey: string;
  baseline: SelectionResult | null;
  replayed: SelectionResult | null;
}

export interface SelectionCheckReport {
  check: "selection_determinism_check";
  severity: Severity;
  /** Seeds actually replayed, in order — so a failing night names the seed
   *  a human re-runs to see it again. */
  seeds: number[];
  eventsReplayed: number;
  tracesCompared: number;
  divergences: SelectionDivergence[];
}

/**
 * Replay `events` under each seed's shuffle and assert every shuffle
 * reproduces the canonical-order trace exactly.
 *
 * The BASELINE is the trace from the log in its given order; each seed's
 * shuffle must reproduce it key-for-key and field-for-field. A key present
 * under one ordering and missing under another is a divergence, not a
 * rounding difference — so the comparison covers the key SETS, not just the
 * values of keys both sides happen to have.
 */
export function selectionDeterminismCheckRun(
  events: DrillEvent[],
  corpusBySurah: Map<number, Corpus>,
  seeds: number[],
): SelectionCheckReport {
  const baseline = replaySelection(events, corpusBySurah);
  const divergences: SelectionDivergence[] = [];

  for (const seed of seeds) {
    const replayed = replaySelection(seededShuffle(events, seed), corpusBySurah);
    const keys = new Set([...baseline.keys(), ...replayed.keys()]);
    for (const traceKey of [...keys].sort()) {
      const a = baseline.get(traceKey) ?? null;
      const b = replayed.get(traceKey) ?? null;
      const hasA = baseline.has(traceKey);
      const hasB = replayed.has(traceKey);
      if (hasA !== hasB || JSON.stringify(a) !== JSON.stringify(b)) {
        divergences.push({ seed, traceKey, baseline: a, replayed: b });
      }
    }
  }

  return {
    check: "selection_determinism_check",
    severity: divergences.length > 0 ? "p1" : "green",
    seeds: [...seeds],
    eventsReplayed: events.length,
    tracesCompared: baseline.size * seeds.length,
    divergences,
  };
}
