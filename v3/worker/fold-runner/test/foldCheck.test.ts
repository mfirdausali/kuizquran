// BUILD-PLAN.md's fold_determinism_check taxonomy, asserted as behaviour:
// "Divergence = P1; version skew = WARN."
//
// The load-bearing property is that the SAME byte difference yields a
// different severity depending only on the cached row's engine_version.
// Anything less and the taxonomy is decoration.

import { describe, expect, it } from "vitest";
import { foldDeterminismCheckRun, type SampledUser } from "../src/foldCheck.ts";
import { foldEvents } from "../src/fold.ts";
import { EXIT_CODE, countsAsGreen, resetsWindow, severityFromExitCode } from "../src/severity.ts";
import type { AtomState } from "../../../packages/engine/src/atom.ts";
import type { AtomsMap } from "../../../packages/engine/src/rebuild.ts";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";

const VERSION = "v3-engine-0.1.0";

/** Structural coordinates only — no Arabic anywhere (CLAUDE.md rule 1). */
const EVENTS: DrillEvent[] = [
  { type: "rung_complete", ts: 1_767_607_260_000, surah: 12, ayah: 1, rung: "S1", correct: true, structured: true, id: "e1" },
  { type: "rung_complete", ts: 1_767_693_720_000, surah: 12, ayah: 2, rung: "S1", correct: true, structured: true, id: "e2" },
];

function sample(mutate?: (cache: AtomsMap) => void, versions?: Map<string, string>): SampledUser {
  const liveCache = foldEvents(EVENTS);
  // Deep-copy so a mutation touches only the "live cache" side.
  const copy: AtomsMap = new Map(
    [...liveCache.entries()].map(([k, v]) => [k, { ...v } as AtomState]),
  );
  mutate?.(copy);
  return {
    userId: 1,
    events: EVENTS,
    liveCache: copy,
    cachedEngineVersion: versions ?? new Map([...copy.keys()].map((k) => [k, VERSION])),
  };
}

describe("severity — the taxonomy is a type and an exit code, not a log string", () => {
  it("maps each severity to a distinct exit code", () => {
    const codes = Object.values(EXIT_CODE);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("never reuses 1 or 2 — a Node crash or a shell usage error must not read as a verdict", () => {
    expect(Object.values(EXIT_CODE)).not.toContain(1);
    expect(Object.values(EXIT_CODE)).not.toContain(2);
  });

  it("round-trips every severity through its exit code", () => {
    for (const [sev, code] of Object.entries(EXIT_CODE)) {
      expect(severityFromExitCode(code)).toBe(sev);
    }
  });

  it("decodes an UNKNOWN exit code as error, never as green", () => {
    expect(severityFromExitCode(137)).toBe("error"); // SIGKILL / OOM
    expect(severityFromExitCode(1)).toBe("error");
  });

  it("only a P1 resets the 7-night window; WARN and error do not", () => {
    expect(resetsWindow("p1")).toBe(true);
    expect(resetsWindow("warn")).toBe(false);
    expect(resetsWindow("error")).toBe(false);
    expect(resetsWindow("green")).toBe(false);
  });

  it("green and WARN count toward the seven; P1 and error do not", () => {
    expect(countsAsGreen("green")).toBe(true);
    expect(countsAsGreen("warn")).toBe(true);
    expect(countsAsGreen("p1")).toBe(false);
    expect(countsAsGreen("error")).toBe(false);
  });
});

describe("foldDeterminismCheckRun — divergence vs skew", () => {
  it("an intact cache is green, and reports how many atoms it actually compared", () => {
    const report = foldDeterminismCheckRun([sample()], VERSION);
    expect(report.severity).toBe("green");
    expect(report.atomsCompared).toBeGreaterThan(0);
    expect(report.findings).toEqual([]);
  });

  it("a divergence under the SAME engine version is a P1", () => {
    const report = foldDeterminismCheckRun(
      [sample((c) => {
        const a = c.get("12:ayah:1")!;
        c.set("12:ayah:1", { ...a, strength: a.strength + 0.0001 });
      })],
      VERSION,
    );
    expect(report.severity).toBe("p1");
    expect(report.divergentCount).toBe(1);
    expect(report.findings[0]!.kind).toBe("divergence");
  });

  it("THE SAME divergence under a DIFFERENT engine version is a WARN", () => {
    // This is the pair that proves the taxonomy is real: identical byte
    // difference, different verdict, decided solely by engine_version.
    const s = sample((c) => {
      const a = c.get("12:ayah:1")!;
      c.set("12:ayah:1", { ...a, strength: a.strength + 0.0001 });
    });
    s.cachedEngineVersion = new Map([...s.liveCache.keys()].map((k) =>
      [k, k === "12:ayah:1" ? "v3-engine-0.0.9-OLD" : VERSION],
    ));

    const report = foldDeterminismCheckRun([s], VERSION);

    expect(report.severity).toBe("warn");
    expect(report.divergentCount).toBe(0);
    expect(report.skewCount).toBe(1);
    expect(report.findings[0]!.cachedVersion).toBe("v3-engine-0.0.9-OLD");
  });

  it("one genuine divergence beside any amount of skew is still a P1 — worst wins", () => {
    const s = sample((c) => {
      for (const k of [...c.keys()]) {
        const a = c.get(k)!;
        c.set(k, { ...a, strength: a.strength + 0.0001 });
      }
    });
    // Every key stale EXCEPT 12:ayah:1, which is current → one real divergence.
    s.cachedEngineVersion = new Map([...s.liveCache.keys()].map((k) =>
      [k, k === "12:ayah:1" ? VERSION : "v3-engine-0.0.9-OLD"],
    ));

    const report = foldDeterminismCheckRun([s], VERSION);

    expect(report.severity).toBe("p1");
    expect(report.divergentCount).toBe(1);
    expect(report.skewCount).toBeGreaterThan(0);
  });

  it("an atom MISSING from the cache with no recorded version is a divergence, not an excuse", () => {
    // A half-written cache must page, not shrug. Deleting the version entry
    // too is the realistic shape: the row simply is not there.
    const s = sample((c) => c.delete("12:ayah:1"));
    s.cachedEngineVersion.delete("12:ayah:1");

    const report = foldDeterminismCheckRun([s], VERSION);

    expect(report.severity).toBe("p1");
    expect(report.findings[0]!.cachedVersion).toBeNull();
  });

  it("an atom in the cache that the log does NOT produce is also a divergence", () => {
    const s = sample((c) =>
      c.set("12:ayah:99", {
        surah: 12, kind: "ayah", ref: 99, strength: 1, stability: 1, difficulty: 0.3,
        lastRetrieval: null, reps: 1, lapses: 0, encoded: false,
        gateDueAt: null, gatePassed: false, gateFails: 0,
      }),
    );
    s.cachedEngineVersion.set("12:ayah:99", VERSION);

    const report = foldDeterminismCheckRun([s], VERSION);

    expect(report.severity).toBe("p1");
    expect(report.findings.some((f) => f.key === "12:ayah:99")).toBe(true);
  });

  it("findings are sorted and never truncated — every divergent key is named", () => {
    const s = sample((c) => {
      for (const k of [...c.keys()]) {
        const a = c.get(k)!;
        c.set(k, { ...a, reps: a.reps + 1 });
      }
    });
    const report = foldDeterminismCheckRun([s], VERSION);
    const keys = report.findings.map((f) => f.key);
    expect(keys).toEqual([...keys].sort());
    expect(keys.length).toBe(s.liveCache.size);
  });

  it("reports per-user, so a P1 names WHICH learner diverged", () => {
    const clean = sample();
    const dirty = { ...sample((c) => {
      const a = c.get("12:ayah:2")!;
      c.set("12:ayah:2", { ...a, lapses: 9 });
    }), userId: 42 };

    const report = foldDeterminismCheckRun([clean, dirty], VERSION);

    expect(report.severity).toBe("p1");
    expect(report.usersChecked).toBe(2);
    expect(report.findings[0]!.userId).toBe(42);
  });
});
