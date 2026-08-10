// DEFECTS.md#B2 / v3-D11: `Drill.tsx:203`/`Gate.tsx:100` decided
// `const rung: Rung = item.full ? "S3" : "S2"` — React deciding grading
// (invariant #6 violation). The fix: `GradeClass` is a closed set the
// engine (never a spec id, never a UI component) resolves to a literal
// Rung via `gradeClassToWire()`, so no caller can reintroduce the same
// ternary. No UI exists yet in v3 (M5 is build-plan step 18), so this
// closes the substantive half of B2's criterion now (the function exists
// and owns the mapping); the JSX-grep half is vacuously true until there's
// JSX to grep.
//
// The exact mapping below is the best-evidence interpretation available
// without M4's spec system (which hasn't landed): s2_partial/s3_full/rc are
// direct name correspondences; pretest and gate are the empirical rung
// values the golden log's own pretest tap (g01, rung S1) and gate_result
// events (g09/g22, rung S3) actually carry; ungraded->S4 follows
// rebuild.ts's own comment grouping S4 with S1 ("S4 rolls up as a light
// meaning signal, like S1"). See v3-D26 (DECISIONS.md) for the full
// reasoning trail and its explicit flag for reconsideration once M4 lands.

import { describe, expect, it } from "vitest";
import { gradeClassToWire, type GradeClass } from "../src/gradeClass.ts";

describe("gradeClassToWire — the ONE place grading-rung is decided (v3-D11)", () => {
  it("s2_partial -> S2", () => {
    expect(gradeClassToWire("s2_partial")).toBe("S2");
  });

  it("s3_full -> S3", () => {
    expect(gradeClassToWire("s3_full")).toBe("S3");
  });

  it("rc -> RC (intermediate, non-completing reconstruct taps)", () => {
    expect(gradeClassToWire("rc")).toBe("RC");
  });

  it("gate -> S3 (matches the golden log's own gate_result rung)", () => {
    expect(gradeClassToWire("gate")).toBe("S3");
  });

  it("pretest -> S1 (matches the golden log's own pretest tap rung)", () => {
    expect(gradeClassToWire("pretest")).toBe("S1");
  });

  it("ungraded -> S4 (rebuild.ts's own 'S4 rolls up like S1' grouping)", () => {
    expect(gradeClassToWire("ungraded")).toBe("S4");
  });

  it("is total over the closed set — every GradeClass value resolves", () => {
    const all: GradeClass[] = ["pretest", "ungraded", "s2_partial", "s3_full", "rc", "gate"];
    for (const gc of all) {
      expect(() => gradeClassToWire(gc)).not.toThrow();
    }
  });
});
