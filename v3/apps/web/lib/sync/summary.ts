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

import { useEffect, useState } from "react";
import type { CycleResult } from "./sync.ts";

export interface SyncSummary {
  /** Events that can never sync (#110 oversize). */
  cannotSync: number;
  /** #50 payload divergences observed on the last pull. */
  divergences: number;
}

const ZERO: SyncSummary = { cannotSync: 0, divergences: 0 };

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
   * Re-appending the identical counts is a no-op (no listener re-render for
   * an unchanged value).
   */
  report(result: Pick<CycleResult, "quarantined" | "divergences">): void {
    const next: SyncSummary = {
      cannotSync: result.quarantined.length,
      divergences: result.divergences.length,
    };
    if (next.cannotSync === this.value.cannotSync && next.divergences === this.value.divergences) {
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
