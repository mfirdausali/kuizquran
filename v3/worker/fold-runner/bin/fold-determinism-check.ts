// THE RUNNER for fold_determinism_check — the executable a scheduler
// invokes at 3am and whose EXIT CODE the window ledger counts.
//
// Contract with the caller (Laravel's FoldDeterminismCheckCommand):
//
//   stdin  — a JSON envelope:
//     {
//       "engineVersion": "<the pinned version this run folds under>",
//       "samples": [
//         { "userId": 7,
//           "events": [ DrillEvent, ... ],
//           "liveCache": { "<atomKey>": AtomState, ... },
//           "cachedEngineVersion": { "<atomKey>": "<version>", ... } }
//       ]
//     }
//   stdout — the FoldCheckReport as JSON, one line, always (even on error).
//   exit   — severity.ts's EXIT_CODE: 0 green · 3 warn · 4 p1 · 5 error.
//
// WHY STDIN RATHER THAN A DB CONNECTION. v3-D08: the Node fold-runner is the
// sole server-side fold, and Laravel OWNS the tables (see the atom_cache
// migration's own comment: "Laravel OWNS this table but never WRITES the
// folded values"). Giving Node its own DB credentials would create a second
// writer to a table with one owner. Instead PHP reads, Node folds, PHP
// records the verdict — each side does the thing it is the authority for.
// v3-D32 deferred "the DB adapter"; this is the honest minimum that does not
// require one.
//
// The `--fixture` flag replaces stdin with the repo's golden log, so the
// check is runnable ON DEMAND with no database at all — which is how a human
// proves the runner works without waiting for a night, and how CI runs it
// ("runs nightly + in CI against the shuffled golden log").

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { foldDeterminismCheckRun, type SampledUser } from "../src/foldCheck.ts";
import { EXIT_CODE } from "../src/severity.ts";
import type { AtomState } from "../../../packages/engine/src/atom.ts";
import type { AtomsMap } from "../../../packages/engine/src/rebuild.ts";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, "..", "..", "..", "fixtures", "golden-log");

/** The engine version this build folds under. Bump deliberately when engine
 *  semantics change — that bump is what turns a post-deploy divergence into
 *  a WARN instead of a 3am page. */
export const ENGINE_VERSION = "v3-engine-0.1.0";

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function toAtomsMap(obj: Record<string, AtomState>): AtomsMap {
  return new Map(Object.entries(obj));
}

/**
 * The on-demand / CI mode. Folds the committed golden log and compares it
 * against the committed ORACLE — the same fixture pair build-plan step 6
 * pinned. This is a real comparison with a real failure mode: corrupt
 * either file and this exits 4.
 *
 * Note what it does NOT prove: the golden log is one synthetic learner, not
 * "sampled users' server logs". Fixture mode proves the RUNNER works;
 * only the DB-fed mode proves production's cache agrees with production's
 * log. Both are wired; only the first can run on this machine.
 */
function fixtureSamples(): { engineVersion: string; samples: SampledUser[] } {
  const events: DrillEvent[] = JSON.parse(
    readFileSync(join(GOLDEN, "events.json"), "utf8"),
  );
  const oracle: Record<string, AtomState> = JSON.parse(
    readFileSync(join(GOLDEN, "oracle.json"), "utf8"),
  );
  const liveCache = toAtomsMap(oracle);
  // The fixture stands in for a live cache computed under the CURRENT
  // engine — so every key carries this run's version and any difference is
  // a genuine divergence, never excusable as skew.
  const cachedEngineVersion = new Map(
    [...liveCache.keys()].map((k) => [k, ENGINE_VERSION] as const),
  );
  return {
    engineVersion: ENGINE_VERSION,
    samples: [{ userId: "golden-log-fixture", events, liveCache, cachedEngineVersion }],
  };
}

function fromStdin(): { engineVersion: string; samples: SampledUser[] } {
  const raw = readStdin().trim();
  if (!raw) {
    throw new Error(
      "no input on stdin — pass a JSON envelope, or use --fixture to run against the golden log",
    );
  }
  const parsed = JSON.parse(raw) as {
    engineVersion?: string;
    samples?: Array<{
      userId: number | string;
      events: DrillEvent[];
      liveCache: Record<string, AtomState>;
      cachedEngineVersion?: Record<string, string>;
    }>;
  };
  if (!Array.isArray(parsed.samples)) {
    throw new Error("envelope has no `samples` array");
  }
  return {
    engineVersion: parsed.engineVersion ?? ENGINE_VERSION,
    samples: parsed.samples.map((s) => ({
      userId: s.userId,
      events: s.events ?? [],
      liveCache: toAtomsMap(s.liveCache ?? {}),
      cachedEngineVersion: new Map(Object.entries(s.cachedEngineVersion ?? {})),
    })),
  };
}

function main(): number {
  const args = process.argv.slice(2);
  try {
    const { engineVersion, samples } = args.includes("--fixture")
      ? fixtureSamples()
      : fromStdin();

    // EDGE: an empty sample set is NOT green. A night where the sampler
    // returned nothing — because a query broke, or the DB was empty, or a
    // config typo pointed at the wrong table — must never count toward the
    // seven. This is v3-D50's lesson applied to the runner itself: assert
    // the OUTPUT, and refuse to report success over zero comparisons.
    if (samples.length === 0) {
      process.stdout.write(
        JSON.stringify({
          check: "fold_determinism_check",
          severity: "error",
          engineVersion,
          usersChecked: 0,
          atomsCompared: 0,
          divergentCount: 0,
          skewCount: 0,
          findings: [],
          error: "no samples supplied — refusing to report green over zero comparisons",
        }) + "\n",
      );
      return EXIT_CODE.error;
    }

    const report = foldDeterminismCheckRun(samples, engineVersion);

    // Same refusal one level down: samples that between them compared zero
    // atoms (every learner had an empty log AND an empty cache) is a
    // sampler bug, not a green night.
    if (report.atomsCompared === 0) {
      process.stdout.write(
        JSON.stringify({
          ...report,
          severity: "error",
          error: "samples compared zero atoms — refusing to report green over nothing",
        }) + "\n",
      );
      return EXIT_CODE.error;
    }

    process.stdout.write(JSON.stringify(report) + "\n");
    return EXIT_CODE[report.severity];
  } catch (e) {
    process.stdout.write(
      JSON.stringify({
        check: "fold_determinism_check",
        severity: "error",
        error: e instanceof Error ? e.message : String(e),
      }) + "\n",
    );
    return EXIT_CODE.error;
  }
}

process.exit(main());
