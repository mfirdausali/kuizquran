// The RUNNER for the admin rebuild action, as a PROCESS — exit code and
// stdout, not a function return value, because that boundary is exactly what
// RebuildAtomCacheJob reads (see DECISIONS.md: SystemHealthController's
// rebuild endpoint never actually invoked a fold-runner at all before this).
//
// The rows this prints are checked against the PURE ENGINE'S OWN rebuild()
// (via fold.ts#foldEvents) — never a hand-computed expectation — the same
// discipline runners.test.ts already applies to the determinism checks.

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { foldEvents } from "../src/fold.ts";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const V3 = join(PKG, "..", "..");
const VITE_NODE = join(PKG, "node_modules", ".bin", "vite-node");

function run(stdin?: string) {
  const r = spawnSync(VITE_NODE, [join(PKG, "bin", "rebuild-atom-cache.ts")], {
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
  return { exit: r.status, report };
}

const GOLDEN = join(V3, "fixtures", "golden-log");
const EVENTS: DrillEvent[] = JSON.parse(readFileSync(join(GOLDEN, "events.json"), "utf8"));

describe("rebuild-atom-cache runner", () => {
  it("exits 0 and re-derives one user's atoms byte-identical to the engine's own rebuild()", () => {
    const { exit, report } = run(JSON.stringify({ users: [{ userId: 7, events: EVENTS }] }));

    expect(exit).toBe(0);
    expect(report.severity).toBe("green");
    expect(report.usersProcessed).toBe(1);

    const expected = foldEvents(EVENTS);
    const rows = report.rows as Array<Record<string, unknown>>;
    expect(rows.length).toBe(expected.size);

    for (const row of rows) {
      expect(row.userId).toBe(7);
      const atom = expected.get(`${row.surah}:${row.kind}:${row.ref}`);
      expect(atom, `no engine atom for ${row.surah}:${row.kind}:${row.ref}`).toBeDefined();
      expect(row).toMatchObject({
        strength: atom!.strength,
        stability: atom!.stability,
        difficulty: atom!.difficulty,
        lastRetrieval: atom!.lastRetrieval,
        reps: atom!.reps,
        lapses: atom!.lapses,
        encoded: atom!.encoded,
        gateDueAt: atom!.gateDueAt,
        gatePassed: atom!.gatePassed,
        gateFails: atom!.gateFails,
      });
    }
  });

  it("keeps two users' rows separate and correctly attributed", () => {
    const { exit, report } = run(
      JSON.stringify({
        users: [
          { userId: 1, events: EVENTS },
          { userId: 2, events: [] },
        ],
      }),
    );

    expect(exit).toBe(0);
    expect(report.usersProcessed).toBe(2);
    const rows = report.rows as Array<Record<string, unknown>>;
    expect(rows.every((r) => r.userId === 1)).toBe(true);
    expect(rows.length).toBe(foldEvents(EVENTS).size);
  });

  it("a user with an empty log re-derives to ZERO atoms — not an error", () => {
    const { exit, report } = run(JSON.stringify({ users: [{ userId: 1, events: [] }] }));
    expect(exit).toBe(0);
    expect(report.severity).toBe("green");
    expect(report.atomsWritten).toBe(0);
  });

  it("zero users is a completed rebuild, not a failure — there was genuinely nothing to fold", () => {
    const { exit, report } = run(JSON.stringify({ users: [] }));
    expect(exit).toBe(0);
    expect(report.usersProcessed).toBe(0);
    expect(report.atomsWritten).toBe(0);
  });

  it("exits 5 (error) on malformed JSON, and still prints a JSON report", () => {
    const { exit, report } = run("{not json");
    expect(exit).toBe(5);
    expect(report.severity).toBe("error");
  });

  it("exits 5 (error) when the envelope has no `users` array", () => {
    const { exit, report } = run(JSON.stringify({ engineVersion: "x" }));
    expect(exit).toBe(5);
    expect(String(report.error)).toContain("users");
  });

  it("exits 5 (error) on empty stdin", () => {
    const { exit, report } = run();
    expect(exit).toBe(5);
    expect(report.severity).toBe("error");
  });

  it("stamps every row with the engine version — default, or the envelope's override", () => {
    const { report: withDefault } = run(JSON.stringify({ users: [{ userId: 1, events: EVENTS }] }));
    const rows1 = withDefault.rows as Array<{ engineVersion: string }>;
    expect(rows1.length).toBeGreaterThan(0);
    expect(new Set(rows1.map((r) => r.engineVersion)).size).toBe(1);

    const { report: withOverride } = run(
      JSON.stringify({ engineVersion: "v3-engine-9.9.9-TEST", users: [{ userId: 1, events: EVENTS }] }),
    );
    const rows2 = withOverride.rows as Array<{ engineVersion: string }>;
    expect(rows2.every((r) => r.engineVersion === "v3-engine-9.9.9-TEST")).toBe(true);
  });
});
