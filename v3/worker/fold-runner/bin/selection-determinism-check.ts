// THE RUNNER for selection_determinism_check.
//
//   stdout — the SelectionCheckReport as JSON, one line, always.
//   exit   — severity.ts's EXIT_CODE: 0 green · 4 p1 · 5 error.
//            (Never 3/WARN: selection has no cache to be stale against, so
//            it has no version-skew analogue — see selectionCheck.ts.)
//
// INPUT. By default the committed selection log
// (v3/fixtures/selection-log/events.json) plus the compiled corpus fixture;
// `--events <path>` overrides the log so Laravel can feed a real server log
// through the same runner. Seeds default to a fixed, committed list; pass
// `--seed N` (repeatable) to pin a failure seed and watch it again.
//
// THE MINIMUM-TRACE FLOOR — the reason this file has more logic than "run
// the check and exit". `replaySelection` SKIPS any event lacking siteKey /
// deviceId / visitOrdinal. Point it at a log with none (the golden log has
// exactly zero — measured, see gen-selection-log.ts's header) and it builds
// an empty trace, compares nothing, and reports green. Every night. Forever.
//
// So this runner asserts a floor on what it actually compared BEFORE it is
// allowed to report green, and exits ERROR when the floor is not met. A
// check that cannot fail is not a check, and this build has already shipped
// eight verifications that asserted the ingredient rather than the output.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { selectionDeterminismCheckRun } from "../src/selectionCheck.ts";
import { EXIT_CODE } from "../src/severity.ts";
import type { Corpus, DrillEvent } from "../../../packages/engine/src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const V3 = join(HERE, "..", "..", "..");

/** Committed seeds. Fixed rather than random so a night's result is
 *  reproducible by re-running the same command — BUILD-PLAN.md's
 *  "failure-seed pinning". Twelve shuffles of a 36-event log is enough to
 *  interleave the two-device merge many different ways. */
const DEFAULT_SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];

/** The floor: a run that compared fewer traces than this is a broken input,
 *  not a green night. The committed selection log yields 36 traces per seed;
 *  a floor of 20 total catches an empty or truncated log without being so
 *  tight that a legitimately smaller real log trips it. */
const MIN_TRACES = 20;

function main(): number {
  const argv = process.argv.slice(2);
  try {
    const eventsFlag = argv.indexOf("--events");
    const eventsPath =
      eventsFlag >= 0 && argv[eventsFlag + 1]
        ? argv[eventsFlag + 1]!
        : join(V3, "fixtures", "selection-log", "events.json");

    const seeds: number[] = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--seed" && argv[i + 1]) seeds.push(Number(argv[i + 1]));
    }

    const events: DrillEvent[] = JSON.parse(readFileSync(eventsPath, "utf8"));

    // Corpus per surah, loaded from the compiled fixtures the engine's own
    // tests use. A surah named by the log but absent here would make
    // replaySelection skip those events silently — so we load every surah
    // the log names, and the trace floor below catches the case where a
    // missing corpus emptied the trace.
    const corpusBySurah = new Map<number, Corpus>();
    for (const surah of new Set(events.map((e) => e.surah))) {
      const path = join(V3, "packages", "engine", "test", "fixtures", `${surah}.json`);
      try {
        corpusBySurah.set(surah, JSON.parse(readFileSync(path, "utf8")) as Corpus);
      } catch {
        // Left absent deliberately — reported via the floor, not swallowed.
      }
    }

    const report = selectionDeterminismCheckRun(
      events,
      corpusBySurah,
      seeds.length > 0 ? seeds : DEFAULT_SEEDS,
    );

    if (report.tracesCompared < MIN_TRACES) {
      process.stdout.write(
        JSON.stringify({
          ...report,
          severity: "error",
          error:
            `compared ${report.tracesCompared} traces, floor is ${MIN_TRACES} — ` +
            `the log has ${events.length} events but few or none carry ` +
            `siteKey/deviceId/visitOrdinal, or their surah's corpus is missing. ` +
            `Refusing to report green over an empty comparison.`,
        }) + "\n",
      );
      return EXIT_CODE.error;
    }

    process.stdout.write(JSON.stringify(report) + "\n");
    return EXIT_CODE[report.severity];
  } catch (e) {
    process.stdout.write(
      JSON.stringify({
        check: "selection_determinism_check",
        severity: "error",
        error: e instanceof Error ? e.message : String(e),
      }) + "\n",
    );
    return EXIT_CODE.error;
  }
}

process.exit(main());
