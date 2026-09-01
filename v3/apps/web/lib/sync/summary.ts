"use client";

// The "cannot sync" / "needs review" escalation counts — SyncStatus.tsx's own
// header names them (#110 quarantine, #50 divergence) and has offered props
// for them since it was built. `syncCycle()` (sync.ts) has computed both on
// every single cycle since build-plan step 21. Nothing ever carried one to
// the other: `SyncTrigger` — the ONE place a real cycle runs — read only
// `result.push?.degraded`/`result.pull?.degraded` and discarded
// `result.quarantined`/`result.divergences` entirely; `home/page.tsx` renders
// `<SyncStatus />` with no props at all, so the escalation branch has never
// once painted outside a test that hands it a literal.
//
// This module is the missing wire, not a new decision: SyncTrigger owns the
// only running cycle and REPORTS into it; SyncStatus (via `useSyncSummary`)
// reads it. Neither imports the other — SyncTrigger's own header is right
// that "no session, drill or grading path may... read its state, because it
// has none to read"; this is a dedicated side-channel for exactly the one
// user-facing purpose #103/#50/#110 already named, not an exception to that
// rule. Same "module-level singleton + subscribe" shape as
// `lib/idb/writeLock.ts`'s `WriteLock` — deliberately reused, not reinvented.
//
// v3-D162 ADDS A THIRD FACT: `authDead`, from `token.ts#isTokenDead()`. That
// function has answered "has a 401 been observed and not yet recovered from"
// since B8 closed, unit-tested, with zero production callers — the same
// zero-caller shape v3-D161 closed for `quarantined`/`divergences` one layer
// over. `SyncTrigger` is still the only place a real cycle runs, so it is
// still the only place that can observe the token's live state at the moment
// a cycle finishes; `isTokenDead()` is read there, not derived from
// `CycleResult` (which carries no token state), and reported alongside the
// existing two counts. "Sync is stuck because this device's bearer token
// died and a re-mint hasn't recovered it" is a DIFFERENT fact from ordinary
// offline/pending — a dead token stops EVERY future cycle from doing
// anything at all, not just this one — so it gets its own field, same
// discipline as keeping `cannotSync` and `divergences` from sharing a number.

import { useEffect, useState } from "react";
import type { CycleResult } from "./sync.ts";

export interface SyncSummary {
  /** Events that can never sync (#110 oversize). */
  cannotSync: number;
  /** #50 payload divergences observed on the last pull. */
  divergences: number;
  /** True once a 401 has been observed and not yet recovered from
   *  (`token.ts#isTokenDead()`). Every future cycle is wedged until a
   *  re-mint succeeds. */
  authDead: boolean;
}

const ZERO: SyncSummary = { cannotSync: 0, divergences: 0, authDead: false };

class SyncSummaryStore {
  private value: SyncSummary = ZERO;
  private listeners = new Set<(s: SyncSummary) => void>();

  get current(): SyncSummary {
    return this.value;
  }

  subscribe(fn: (s: SyncSummary) => void): () => void {
    this.listeners.add(fn);
    fn(this.value);
    return () => this.listeners.delete(fn);
  }

  /**
   * Called once per completed cycle. OVERWRITES, never accumulates: each
   * cycle's counts are the CURRENT state of the log, not a delta —
   * `outbox.ts#selectPending` re-scans and re-reports every still-quarantined
   * row on every call, and a divergence is only ever current-pull-scoped.
   * `authDead` is likewise the CURRENT token state at the moment this cycle
   * finished, never latched — a later cycle whose re-mint succeeded must
   * report `false` again, not leave a stale `true` behind. Re-appending
   * identical values is a no-op (no listener re-render for an unchanged
   * value).
   */
  report(result: Pick<CycleResult, "quarantined" | "divergences">, authDead: boolean): void {
    const next: SyncSummary = {
      cannotSync: result.quarantined.length,
      divergences: result.divergences.length,
      authDead,
    };
    if (
      next.cannotSync === this.value.cannotSync &&
      next.divergences === this.value.divergences &&
      next.authDead === this.value.authDead
    ) {
      return;
    }
    this.value = next;
    for (const fn of this.listeners) fn(next);
  }

  /** Test-only: module singletons leak across tests in the same file
   *  otherwise — same discipline as `resetApiFetchForTests`/
   *  `resetTokenForTests`. */
  resetForTests(): void {
    this.value = ZERO;
    this.listeners.clear();
  }
}

export const syncSummary = new SyncSummaryStore();

/** Live escalation counts, kept in sync with the last completed cycle. */
export function useSyncSummary(): SyncSummary {
  const [state, setState] = useState<SyncSummary>(syncSummary.current);
  useEffect(() => syncSummary.subscribe(setState), []);
  return state;
}

/** Test-only. */
export function resetSyncSummaryForTests(): void {
  syncSummary.resetForTests();
}
