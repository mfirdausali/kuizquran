// fold_determinism_check's VERDICT layer — the part that turns
// determinism.ts's raw "which keys diverged" into BUILD-PLAN.md's taxonomy:
//
//   "Node fold-runner (sole server-side fold, pinned engine version)
//    re-folds sampled users' server logs in canonical order, byte-compares
//    against atom_cache. Divergence = P1; version skew = WARN."
//
// The whole subtlety is that sentence's two halves are not independent.
// A cached row computed under engine version X and a fresh fold under
// version Y are EXPECTED to differ — that is what a version bump means. If
// the check called that a P1, every engine deploy would page at 3am and the
// pager would be ignored within a week. If instead it called every
// divergence a WARN whenever ANY row anywhere was stale, a genuine
// corruption would hide behind one unrelated stale row.
//
// So the classification is PER ROW, not per run:
//
//   - a divergent key whose cached row carries the CURRENT engine version
//     is a genuine divergence → P1. The cache disagrees with the fold under
//     identical logic; invariant #2 is broken for that learner.
//   - a divergent key whose cached row carries a DIFFERENT engine version
//     is skew → WARN. Re-fold it and the disagreement should vanish.
//   - a key present in the fresh fold but ABSENT from the cache, with no
//     recorded version to judge by, is a genuine divergence → P1. The cache
//     is missing an atom the log says exists. Treating "missing" as
//     benign is exactly how a check reports green over a half-written
//     cache.
//
// A run's severity is the WORST per-row verdict: one P1 row makes the night
// a P1 however many WARN rows accompany it.

import type { AtomsMap } from "../../../packages/engine/src/rebuild.ts";
import type { DayConfig } from "../../../packages/engine/src/daybound.ts";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";
import { compareAtomCaches } from "./determinism.ts";
import { foldEvents } from "./fold.ts";
import type { Severity } from "./severity.ts";

/** One sampled learner's inputs, as a live deployment supplies them. */
export interface SampledUser {
  userId: number | string;
  events: DrillEvent[];
  /** The learner's live `atom_cache` rows, keyed by `atomKey()`. */
  liveCache: AtomsMap;
  /** `engine_version` per atom key, straight off the cached rows. A key
   *  absent here has no recorded version — see the header: that is a
   *  divergence, never an excuse. */
  cachedEngineVersion: Map<string, string>;
}

export interface KeyFinding {
  userId: number | string;
  key: string;
  /** "divergence" (P1-worthy) or "skew" (WARN-worthy). */
  kind: "divergence" | "skew";
  /** The engine version recorded on the cached row, or null when the key
   *  was missing from the cache entirely. */
  cachedVersion: string | null;
}

export interface FoldCheckReport {
  check: "fold_determinism_check";
  severity: Severity;
  /** The engine version this run folded under — the "pinned engine
   *  version" BUILD-PLAN.md names. */
  engineVersion: string;
  usersChecked: number;
  atomsCompared: number;
  divergentCount: number;
  skewCount: number;
  /** Every finding, sorted (userId, key) for a stable, diffable report.
   *  Never truncated silently — a check that hides findings past row 50 is
   *  a check that lies about the fiftieth-first. */
  findings: KeyFinding[];
}

/**
 * The check itself. Pure: takes already-loaded samples, returns a verdict.
 * A live deployment's DB adapter (api/app/Console/Commands) loads the
 * samples and interprets the severity; nothing here touches a database, a
 * clock, or a filesystem.
 */
export function foldDeterminismCheckRun(
  samples: SampledUser[],
  engineVersion: string,
  cfg?: DayConfig,
): FoldCheckReport {
  const findings: KeyFinding[] = [];
  let atomsCompared = 0;

  for (const sample of samples) {
    const fresh = foldEvents(sample.events, cfg);
    // Every key on either side is compared — a key the cache has and the
    // fold does not is as much a divergence as the reverse.
    const allKeys = new Set([...fresh.keys(), ...sample.liveCache.keys()]);
    atomsCompared += allKeys.size;

    const { divergentKeys } = compareAtomCaches(fresh, sample.liveCache);
    for (const key of divergentKeys) {
      const cachedVersion = sample.cachedEngineVersion.get(key) ?? null;
      // Skew ONLY when a version is recorded AND differs. No recorded
      // version means we cannot excuse the difference, so we do not.
      const isSkew = cachedVersion !== null && cachedVersion !== engineVersion;
      findings.push({
        userId: sample.userId,
        key,
        kind: isSkew ? "skew" : "divergence",
        cachedVersion,
      });
    }
  }

  findings.sort(
    (a, b) => String(a.userId).localeCompare(String(b.userId)) || a.key.localeCompare(b.key),
  );

  const divergentCount = findings.filter((f) => f.kind === "divergence").length;
  const skewCount = findings.length - divergentCount;

  // Worst-wins. Any genuine divergence is a P1 regardless of how much skew
  // sits beside it.
  const severity: Severity = divergentCount > 0 ? "p1" : skewCount > 0 ? "warn" : "green";

  return {
    check: "fold_determinism_check",
    severity,
    engineVersion,
    usersChecked: samples.length,
    atomsCompared,
    divergentCount,
    skewCount,
    findings,
  };
}
