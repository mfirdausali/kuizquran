// THE TEST-COUNT FLOOR GATE (build-plan step 30 / M10 hardening —
// HANDOVER.md's own E10, "raise the test floor... or accept that the +63
// margin means a deleted test no longer trips the tripwire", closed here —
// v3-D95).
//
// ---------------------------------------------------------------------------
// WHY THE TESTS SPAWN THE REAL SCRIPT
// ---------------------------------------------------------------------------
// `content-freeze-gate.test.ts` already states this build's rule: "A gate is
// only worth its exit code. Testing an extracted helper would prove the
// helper works while the SCRIPT... could stop calling it." Every test below
// runs `check-test-floor.mjs` the way `make test` runs it — against a
// synthetic log file on disk and a synthetic TEST-FLOOR file — and asserts on
// stdout/exit code only, never on an imported function.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const V3 = path.resolve(__dirname, "../../..");
const SCRIPT = path.join(V3, "scripts/check-test-floor.mjs");

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

function run(args: string[]): { out: string; code: number } {
  const r = spawnSync("node", [SCRIPT, ...args], { encoding: "utf8" });
  return { out: (r.stdout ?? "") + (r.stderr ?? ""), code: r.status ?? 1 };
}

/** Writes a log file + floor file into a fresh temp dir and returns
 *  [logPath, floorFile-args]. `overrides` lets a test drop or shrink one
 *  suite's line without hand-building the whole log every time. */
function fixture(opts: { floor: number; counts?: Partial<Record<Suite, number | null>> }): {
  logPath: string;
  floorArgs: string[];
} {
  const dir = mkdtempSync(path.join(tmpdir(), "test-floor-"));
  temps.push(dir);
  const counts: Record<Suite, number | null> = {
    v2: 255,
    v2api: 47,
    v3api: 272,
    corpus: 111,
    engine: 417,
    fold: 61,
    web: 727,
    ...opts.counts,
  };
  const logPath = path.join(dir, "make-test.log");
  writeFileSync(logPath, buildLog(counts));
  const floorFile = path.join(dir, "TEST-FLOOR");
  writeFileSync(floorFile, `${opts.floor}\n`);
  return { logPath, floorArgs: ["--floor-file", floorFile] };
}

type Suite = "v2" | "v2api" | "v3api" | "corpus" | "engine" | "fold" | "web";

/** Reproduces the REAL make-test log shape, line for line, for every suite —
 *  the exact strings a genuine `TZ=UTC make test` run prints, captured by
 *  hand from a real run of this repo (not invented). A suite whose count is
 *  `null` is OMITTED ENTIRELY — simulating a suite that silently never ran,
 *  as opposed to one that ran and reported fewer tests. */
function buildLog(counts: Record<Suite, number | null>): string {
  const parts: string[] = [];
  if (counts.v2 !== null) {
    parts.push(
      "cd v2 && npm test",
      "",
      " Test Files  38 passed (38)",
      `      Tests  ${counts.v2} passed (${counts.v2})`,
      "",
    );
  }
  if (counts.v2api !== null) {
    parts.push(
      "cd v2/api && php artisan test",
      `{"tool":"phpunit","result":"passed","tests":${counts.v2api},"passed":${counts.v2api},"assertions":144,"duration_ms":1349}`,
      "",
    );
  }
  if (counts.v3api !== null) {
    parts.push(
      "cd v3/api && php artisan test",
      "  ✓ an admin granted the qari role may sign the qari tier                0.02s",
      "",
      `  Tests:    2 incomplete, ${counts.v3api} passed (901 assertions)`,
      "  Duration: 14.09s",
      "",
    );
  }
  if (counts.corpus !== null) {
    parts.push(
      "cd v3/packages/corpus-compiler && npm test",
      "",
      " Test Files  11 passed (11)",
      `      Tests  ${counts.corpus} passed (${counts.corpus})`,
      "",
    );
  }
  if (counts.engine !== null) {
    parts.push(
      "cd v3/packages/engine && npm test",
      "",
      " Test Files  43 passed (43)",
      `      Tests  ${counts.engine} passed (${counts.engine})`,
      "",
    );
  }
  if (counts.fold !== null) {
    parts.push(
      "cd v3/worker/fold-runner && npm test",
      "",
      " Test Files  7 passed (7)",
      `      Tests  ${counts.fold} passed (${counts.fold})`,
      "",
    );
  }
  if (counts.web !== null) {
    parts.push(
      "cd v3/apps/web && npm test",
      "",
      " Test Files  42 passed (42)",
      `      Tests  ${counts.web} passed (${counts.web})`,
      "",
    );
  }
  return parts.join("\n");
}

const REAL_TOTAL = 255 + 47 + 272 + 111 + 417 + 61 + 727; // 1890, v3-D94's own documented number

describe("check-test-floor.mjs — the gate", () => {
  it("passes on a log whose real seven-suite total meets a floor set to it exactly", () => {
    const { logPath, floorArgs } = fixture({ floor: REAL_TOTAL });
    const { out, code } = run([logPath, ...floorArgs]);
    expect(code).toBe(0);
    expect(out).toContain(String(REAL_TOTAL));
    expect(out).toMatch(/OK/);
  });

  it("passes with margin when the total exceeds the floor", () => {
    const { logPath, floorArgs } = fixture({ floor: REAL_TOTAL - 10 });
    const { out, code } = run([logPath, ...floorArgs]);
    expect(code).toBe(0);
    expect(out).toContain("margin");
  });

  it("FAILS when exactly one suite shrinks below the floor — this is the load-bearing case", () => {
    // The floor is set to the real total; apps/web loses 5 tests (a plausible
    // accidental deletion), everything else is unchanged.
    const { logPath, floorArgs } = fixture({
      floor: REAL_TOTAL,
      counts: { web: 727 - 5 },
    });
    const { out, code } = run([logPath, ...floorArgs]);
    expect(code).toBe(1);
    expect(out).toContain(String(REAL_TOTAL - 5));
    expect(out).toMatch(/FAIL/);
  });

  it("FAILS, never silently passes, when a whole suite's marker never appears in the log — a suite that didn't run is not zero tests missing, it's a bigger lie", () => {
    const { logPath, floorArgs } = fixture({
      floor: 1,
      counts: { fold: null },
    });
    const { out, code } = run([logPath, ...floorArgs]);
    expect(code).toBe(1);
    expect(out.toLowerCase()).toContain("missing");
    expect(out).toMatch(/fold-runner/);
  });

  it("attributes a shrink to the RIGHT suite by name, not just a bare total — five suites share the identical vitest summary line shape, so ordinal position (bounded by each suite's own `cd ... && npm test` marker) must not be confused", () => {
    const { logPath, floorArgs } = fixture({
      floor: REAL_TOTAL,
      counts: { engine: 417 - 1 },
    });
    const { out } = run([logPath, ...floorArgs]);
    // engine's own reported count appears in the per-suite breakdown...
    expect(out).toContain(String(417 - 1));
    // ...specifically attributed to "engine", not corpus-compiler or fold-runner
    // (all three are vitest and would print an identical-shaped summary line).
    const engineLine = out.split("\n").find((l) => l.includes("engine") && !l.includes("engine's"));
    expect(engineLine).toBeTruthy();
    expect(engineLine).toContain(String(417 - 1));
  });

  it("counts v3/api's PASSED total only, never inflated by its 2 deliberately-incomplete PAY-1 tests", () => {
    // v3/api's real summary line is "Tests:    2 incomplete, 272 passed
    // (901 assertions)". A parser that summed 2+272 would silently mask a
    // real regression the day PAY-1's fixtures land and the "incomplete"
    // count changes shape.
    const { logPath, floorArgs } = fixture({ floor: REAL_TOTAL });
    const { out } = run(["--json", logPath, ...floorArgs]);
    const parsed = JSON.parse(out);
    const v3apiResult = parsed.results.find((r: { name: string }) => r.name.includes("v3/api"));
    expect(v3apiResult.count).toBe(272);
  });

  it("MUTATION CHECK — a floor-checker that always reports ok:true would fail the shrink test above; confirms the shrink test is not vacuous", () => {
    // This is not a test of the script — it is a manual trace proving the
    // shrink-detection test three cases above actually bites. Reproduced by
    // hand rather than shipped as a real mutation, per this file's own
    // discipline of never leaving an unproven "closed" claim: set the floor
    // ABOVE the real total artificially and confirm a genuinely-full log
    // still fails, i.e. the floor comparison is a real `<`, not a stub.
    const { logPath, floorArgs } = fixture({ floor: REAL_TOTAL + 1 });
    const { code, out } = run([logPath, ...floorArgs]);
    expect(code).toBe(1);
    expect(out).toContain(String(REAL_TOTAL));
  });

  it("fails loudly, not silently, on a missing floor file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "test-floor-nofloor-"));
    temps.push(dir);
    const logPath = path.join(dir, "log.txt");
    writeFileSync(logPath, buildLog({ v2: 1, v2api: 1, v3api: 1, corpus: 1, engine: 1, fold: 1, web: 1 }));
    const { code, out } = run([logPath, "--floor-file", path.join(dir, "does-not-exist")]);
    expect(code).toBe(1);
    expect(out.toLowerCase()).toContain("floor file not found");
  });

  it("reads the REAL repo TEST-FLOOR file and passes against a log whose total exactly meets it", () => {
    // Every literal summary line in buildLog() above (the vitest "Tests  N
    // passed (N)" shape, v2/api's own JSON line, v3/api's "Tests:  N
    // incomplete, M passed" shape) was captured by hand from real runs of
    // this repo's seven suites, not invented — see this run's own report.
    // This test additionally proves the parser against the REPO'S OWN
    // TEST-FLOOR file (no --floor-file override). It reads that file's
    // CURRENT value rather than hardcoding a total, deliberately: TEST-FLOOR
    // is expected to move forward as suites grow (this file's own 9 tests
    // moved it from 1890 to 1899), and a hardcoded expectation here would go
    // stale on every future bump the same way the pre-fix `make test` gate
    // itself went stale — the exact failure mode this gate exists to catch.
    const dir = mkdtempSync(path.join(tmpdir(), "test-floor-realfloor-"));
    temps.push(dir);
    const logPath = path.join(dir, "log.txt");
    const realFloor = parseInt(readFileSync(path.join(V3, "TEST-FLOOR"), "utf8").trim(), 10);
    const fixedSuitesTotal = 255 + 47 + 272 + 111 + 417 + 61; // every suite but apps/web
    const web = Math.max(1, realFloor - fixedSuitesTotal); // exactly meets or (if apps/web alone can't) at least approaches the real floor
    writeFileSync(logPath, buildLog({ v2: 255, v2api: 47, v3api: 272, corpus: 111, engine: 417, fold: 61, web }));
    const { out, code } = run([logPath]); // real repo TEST-FLOOR, no override
    expect(code).toBe(0);
    expect(out).toMatch(/OK/);
  });
});
