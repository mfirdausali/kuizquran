#!/usr/bin/env node
// THE TEST-COUNT FLOOR GATE (build-plan step 30 / M10 hardening — closes
// HANDOVER.md's own E10, "raise the test floor to 1614, or accept that the
// +63 margin means a deleted test no longer trips the tripwire" — v3-D95).
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
// DEFECTS.md#B9 closed the build gate that could never fail (`|| true` plus
// "no test files found" counting as a pass). That fix stops `make test` from
// reporting green on ZERO tests. It does nothing about a suite silently
// shrinking to fewer-but-still-real tests: a test file caught by an errant
// `git rm`, a `describe.skip` left in by accident, or a suite that stops
// discovering half its files still prints PASS for everything that DID run,
// and `make test` still exits 0. Nothing sums the seven suites that make up
// `make test`'s real total (v2 vitest, v2/api PHPUnit, v3/api PHPUnit,
// corpus-compiler, engine, fold-runner, apps/web) and nothing notices if the
// total drops. HANDOVER.md's own audit already widened this into a
// documented +63-test margin ("a single deleted test no longer trips it")
// without closing it.
//
// So this gate parses the exact text `make test` prints — the same seven
// summary lines HANDOVER.md's "COUNTING TRAP" note tells a human reader to
// find by hand ("read the number immediately before the word `passed`...
// sum the seven suites individually — do not trust a grep total") — sums
// them, and fails loudly if the total drops below TEST-FLOOR, or if any of
// the seven expected suite markers is missing outright. A suite that never
// ran is a bigger lie than one that shrank, and must not read as green by
// omission.
//
// ---------------------------------------------------------------------------
// WHAT THIS DELIBERATELY DOES NOT DO
// ---------------------------------------------------------------------------
// It does not re-run the suites — it reads the log `make test` already
// produced, so the count it certifies is the exact run a human or CI just
// watched, not a second, possibly-divergent invocation. It does not judge
// WHICH tests exist, only how many — a suite could delete a meaningful
// assertion and add a trivial one and this gate would not notice; that is
// what the suites' own tests and mutation testing are for, not this one.
//
// Usage:
//   node v3/scripts/check-test-floor.mjs <log-file>                  # human-readable
//   node v3/scripts/check-test-floor.mjs <log-file> --json           # machine-readable
//   node v3/scripts/check-test-floor.mjs <log-file> --floor-file <p> # test-only override
//
// Exit code: 0 when every one of the seven suite markers is found AND the
// summed total is >= the floor in TEST-FLOOR; 1 otherwise.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V3 = path.resolve(HERE, "..");
const DEFAULT_FLOOR_FILE = path.join(V3, "TEST-FLOOR");

const rawArgs = process.argv.slice(2);
const jsonMode = rawArgs.includes("--json");
const floorFlagIdx = rawArgs.indexOf("--floor-file");
const floorFile = floorFlagIdx !== -1 ? rawArgs[floorFlagIdx + 1] : DEFAULT_FLOOR_FILE;
const positional = rawArgs.filter((a, i) => {
  if (a.startsWith("--")) return false;
  if (rawArgs[i - 1] === "--floor-file") return false;
  return true;
});
const logPath = positional[0];

function fail(message) {
  console.error(`check-test-floor: ${message}`);
  process.exit(1);
}

if (!logPath) fail("usage: check-test-floor.mjs <log-file> [--json] [--floor-file <path>]");
if (!existsSync(logPath)) fail(`log file not found: ${logPath}`);
if (!existsSync(floorFile)) fail(`floor file not found: ${floorFile}`);

const log = readFileSync(logPath, "utf8");
const floorRaw = readFileSync(floorFile, "utf8").trim();
const floor = parseInt(floorRaw, 10);
if (!Number.isInteger(floor) || floor <= 0) {
  fail(`${floorFile} does not contain a positive integer (got ${JSON.stringify(floorRaw)})`);
}

// Each suite's section is bounded by the literal recipe line Make echoes for
// it — the root Makefile's test-web/test-api/test-api3/test-v3 targets are
// NOT `@`-silenced, so these exact commands appear in the log verbatim, in
// this exact order. Splitting on them (rather than scanning the whole log
// for a suite's summary shape) is what stops one suite's marker being
// mistaken for another's: five of the seven suites share the identical
// vitest "Tests  N passed (N)" line.
const SUITES = [
  { name: "v2 vitest", marker: "cd v2 && npm test", kind: "vitest" },
  { name: "v2/api PHPUnit", marker: "cd v2/api && php artisan test", kind: "phpunit-json" },
  { name: "v3/api PHPUnit", marker: "cd v3/api && php artisan test", kind: "phpunit-human" },
  { name: "corpus-compiler", marker: "cd v3/packages/corpus-compiler && npm test", kind: "vitest" },
  { name: "engine", marker: "cd v3/packages/engine && npm test", kind: "vitest" },
  { name: "fold-runner", marker: "cd v3/worker/fold-runner && npm test", kind: "vitest" },
  { name: "apps/web", marker: "cd v3/apps/web && npm test", kind: "vitest" },
];

function extractCount(section, kind) {
  if (kind === "vitest") {
    // Anchored on line start so "Test Files  N passed (N)" — printed by
    // every one of these suites too — can never be mistaken for "Tests".
    const m = section.match(/^\s*Tests\s+(\d+) passed \(\d+\)\s*$/m);
    return m ? parseInt(m[1], 10) : null;
  }
  if (kind === "phpunit-json") {
    const m = section.match(/"tool":"phpunit"[^}]*"tests":(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  if (kind === "phpunit-human") {
    // e.g. "Tests:    2 incomplete, 272 passed (901 assertions)", or with no
    // incomplete clause at all: "Tests:    272 passed (...)". Captures the
    // PASSED count only — v3/api's 2 deliberately-incomplete PAY-1 tests
    // (DEFECTS.md's PAY-1, red-by-construction) must never inflate the
    // total, or a real regression could hide behind a growing incomplete
    // count.
    const m = section.match(/Tests:\s*(?:\d+\s+\w+,\s*)*?(\d+)\s+passed/);
    return m ? parseInt(m[1], 10) : null;
  }
  return null;
}

const boundaries = SUITES.map((s) => ({ ...s, at: log.indexOf(s.marker) }));

const results = [];
const missing = [];
for (let i = 0; i < boundaries.length; i++) {
  const s = boundaries[i];
  if (s.at === -1) {
    missing.push(s.name);
    continue;
  }
  const laterStarts = boundaries.slice(i + 1).map((b) => b.at).filter((a) => a !== -1);
  const nextAt = laterStarts.length > 0 ? Math.min(...laterStarts) : undefined;
  const section = log.slice(s.at, nextAt);
  const count = extractCount(section, s.kind);
  if (count === null) {
    missing.push(`${s.name} (marker found, no summary line matched)`);
    continue;
  }
  results.push({ name: s.name, count });
}

const total = results.reduce((sum, r) => sum + r.count, 0);
const ok = missing.length === 0 && total >= floor;

if (jsonMode) {
  console.log(JSON.stringify({ ok, total, floor, results, missing }, null, 2));
} else {
  console.log("");
  console.log("test-count floor (v3-D95 / HANDOVER.md E10)");
  console.log("");
  for (const r of results) {
    console.log(`  ${String(r.count).padStart(5)}  ${r.name}`);
  }
  for (const m of missing) {
    console.log(`  MISSING  ${m}`);
  }
  console.log("");
  console.log(`  total: ${total}   floor: ${floor}`);
  console.log("");
  if (missing.length > 0) {
    console.log(
      `test-floor: FAIL — ${missing.length} suite(s) not found in the log; a suite that silently didn't run must not read as green.`,
    );
  } else if (total < floor) {
    console.log(
      `test-floor: FAIL — ${total} < floor ${floor}. A suite shrank. If this is a deliberate, reviewed test removal, update TEST-FLOOR in the same commit — never silently.`,
    );
  } else {
    const margin = total > floor ? ` (+${total - floor} margin)` : "";
    console.log(`test-floor: OK — ${total} >= floor ${floor}${margin}`);
  }
}

process.exit(ok ? 0 : 1);
