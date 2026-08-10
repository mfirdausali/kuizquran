// WIREFRAME.md §16 / build-plan step 14's fold_determinism_check: "A
// nightly job re-folds a sample of the event log from scratch and compares
// it to the live atom cache. It must be 100%; ANY divergence is the
// highest-severity page... Without this check, invariant #2 is a claim;
// with it, it is monitored." This file is the check's pure core (compare +
// re-fold-and-compare); a live deployment's DB adapter (reading a real
// atom_cache table, scheduling the nightly run, paging on divergence) is
// explicitly deferred — see DECISIONS.md v3-D32.

import type { AtomState } from "../../../packages/engine/src/atom.ts";
import type { AtomsMap } from "../../../packages/engine/src/rebuild.ts";
import type { DayConfig } from "../../../packages/engine/src/daybound.ts";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";
import { foldEvents } from "./fold.ts";

export interface DeterminismResult {
  matches: boolean;
  /** Every atom key present in only one cache, or whose AtomState differs —
   *  ANY divergence, however small a field, however few keys. Sorted for a
   *  stable, diffable report. */
  divergentKeys: string[];
}

function atomsEqual(a: AtomState, b: AtomState): boolean {
  // Plain structural equality over a flat, JSON-safe shape (no functions/
  // Dates/Maps inside AtomState) — a key-order-independent deep compare.
  const ar = a as unknown as Record<string, unknown>;
  const br = b as unknown as Record<string, unknown>;
  const aKeys = Object.keys(ar).sort();
  const bKeys = Object.keys(br).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k, i) => k === bKeys[i] && ar[k] === br[k]);
}

/** Key-by-key comparison of two AtomsMaps — the check's core primitive. */
export function compareAtomCaches(a: AtomsMap, b: AtomsMap): DeterminismResult {
  const keys = new Set([...a.keys(), ...b.keys()]);
  const divergentKeys: string[] = [];
  for (const key of keys) {
    const av = a.get(key);
    const bv = b.get(key);
    if (!av || !bv || !atomsEqual(av, bv)) divergentKeys.push(key);
  }
  divergentKeys.sort();
  return { matches: divergentKeys.length === 0, divergentKeys };
}

/**
 * The nightly check itself: re-fold `events` from scratch (via foldEvents,
 * never trusting anything about how `liveCache` was produced) and compare
 * against the live cache. A live deployment supplies `events` from the DB
 * and `liveCache` from the `atom_cache` table; this function stays pure
 * and DB-free either way.
 */
export function foldDeterminismCheck(
  events: DrillEvent[],
  liveCache: AtomsMap,
  cfg?: DayConfig,
): DeterminismResult {
  return compareAtomCaches(foldEvents(events, cfg), liveCache);
}
