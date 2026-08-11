// The RUNNERS as processes — exit codes, not return values.
//
// The severity taxonomy only means anything if it survives the process
// boundary, because that boundary is exactly where PHP reads it. A unit test
// of `foldDeterminismCheckRun` proves the classification; only spawning the
// binary proves the EXIT CODE a scheduler will actually see.
//
// These tests also pin the two VACUITY FLOORS — the runners' refusal to
// report green over zero comparisons. That refusal is the difference between
// a check and a rubber stamp, and it is not covered by any pure unit test
// because it lives in the CLI layer.

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AtomState } from "../../../packages/engine/src/atom.ts";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const V3 = join(PKG, "..", "..");
const VITE_NODE = join(PKG, "node_modules", ".bin", "vite-node");
const VERSION = "v3-engine-0.1.0";

function run(entry: string, args: string[] = [], stdin?: string) {
  const r = spawnSync(VITE_NODE, [join(PKG, "bin", entry), "--", ...args], {
    cwd: PKG,
    input: stdin ?? "",
    encoding: "utf8",
    timeout: 120_000,
  });
  let report: Record<string, unknown> = {};
  try {
    report = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}");
  } catch {
    /* left empty — asserted on below */
  }
  return { exit: r.status, report, stdout: r.stdout };
}

const GOLDEN = join(V3, "fixtures", "golden-log");
const EVENTS: DrillEvent[] = JSON.parse(readFileSync(join(GOLDEN, "events.json"), "utf8"));
const ORACLE: Record<string, AtomState> = JSON.parse(
  readFileSync(join(GOLDEN, "oracle.json"), "utf8"),
);

function envelope(
  cache: Record<string, AtomState>,
  versions?: Record<string, string>,
): string {
  return JSON.stringify({
    engineVersion: VERSION,
    samples: [{
      userId: 1,
      events: EVENTS,
      liveCache: cache,
      cachedEngineVersion:
        versions ?? Object.fromEntries(Object.keys(cache).map((k) => [k, VERSION])),
    }],
  });
}

describe("fold-determinism-check runner — exit codes ARE the taxonomy", () => {
  it("exits 0 (green) against the committed golden log + oracle", () => {
    const { exit, report } = run("fold-determinism-check.ts", ["--fixture"]);
    expect(exit).toBe(0);
    expect(report.severity).toBe("green");
    expect(report.atomsCompared as number).toBeGreaterThan(0);
  });

  it("exits 4 (P1) on a divergence under the same engine version", () => {
    const corrupt = structuredClone(ORACLE);
    const key = Object.keys(corrupt)[0]!;
    corrupt[key]!.strength += 0.0001;

    const { exit, report } = run("fold-determinism-check.ts", [], envelope(corrupt));

    expect(exit).toBe(4);
    expect(report.severity).toBe("p1");
    expect(report.divergentCount).toBe(1);
  });

  it("exits 3 (WARN) on the SAME divergence under a different engine version", () => {
    const corrupt = structuredClone(ORACLE);
    const key = Object.keys(corrupt)[0]!;
    corrupt[key]!.strength += 0.0001;
    const versions = Object.fromEntries(
      Object.keys(corrupt).map((k) => [k, k === key ? "v3-engine-0.0.9-OLD" : VERSION]),
    );

    const { exit, report } = run("fold-determinism-check.ts", [], envelope(corrupt, versions));

    expect(exit).toBe(3);
    expect(report.severity).toBe("warn");
    expect(report.skewCount).toBe(1);
  });

  it("exits 5 (error) on an EMPTY sample set — never 0", () => {
    // A sampler that returned nothing must not buy a green night.
    const { exit, report } = run(
      "fold-determinism-check.ts",
      [],
      JSON.stringify({ engineVersion: VERSION, samples: [] }),
    );
    expect(exit).toBe(5);
    expect(report.severity).toBe("error");
  });

  it("exits 5 (error) when samples compare ZERO atoms", () => {
    const { exit, report } = run(
      "fold-determinism-check.ts",
      [],
      JSON.stringify({
        engineVersion: VERSION,
        samples: [{ userId: 1, events: [], liveCache: {}, cachedEngineVersion: {} }],
      }),
    );
    expect(exit).toBe(5);
    expect(String(report.error)).toContain("zero");
  });

  it("exits 5 (error) on malformed input, and still prints a JSON report", () => {
    const { exit, report } = run("fold-determinism-check.ts", [], "{not json");
    expect(exit).toBe(5);
    expect(report.severity).toBe("error");
    expect(report.check).toBe("fold_determinism_check");
  });

  it("exits 5 (error) on empty stdin rather than assuming an empty log is fine", () => {
    const { exit } = run("fold-determinism-check.ts", []);
    expect(exit).toBe(5);
  });
});

describe("selection-determinism-check runner", () => {
  it("exits 0 (green) against the committed selection log", () => {
    const { exit, report } = run("selection-determinism-check.ts");
    expect(exit).toBe(0);
    expect(report.severity).toBe("green");
    expect(report.tracesCompared as number).toBeGreaterThan(0);
  });

  it("REFUSES the golden log — 0 selection-bearing events must be an error, not a green night", () => {
    // The trap this floor exists for, asserted directly: the golden log has
    // 24 events and none carry siteKey/deviceId/visitOrdinal, so a runner
    // without a floor would report green over an empty comparison forever.
    const { exit, report } = run("selection-determinism-check.ts", [
      "--events",
      join(GOLDEN, "events.json"),
    ]);
    expect(exit).toBe(5);
    expect(report.severity).toBe("error");
    expect(report.tracesCompared).toBe(0);
    expect(String(report.error)).toContain("Refusing to report green");
  });

  it("honours --seed so a failing night is reproducible", () => {
    const { exit, report } = run("selection-determinism-check.ts", ["--seed", "42"]);
    expect(exit).toBe(0);
    expect(report.seeds).toEqual([42]);
  });

  it("exits 5 (error) when the events file does not exist", () => {
    const { exit, report } = run("selection-determinism-check.ts", ["--events", "/nonexistent.json"]);
    expect(exit).toBe(5);
    expect(report.severity).toBe("error");
  });
});
