// DEFECTS.md#B2 / v3-D11: `Drill.tsx:203` and `Gate.tsx:100` (v2's UI layer,
// never ported — v3 has no UI yet, M5 is build-plan step 18) decided
// `const rung: Rung = item.full ? "S3" : "S2"` — invariant #6's exact leak,
// React deciding what should be an engine decision. The fix: `GradeClass`
// is a closed set; `gradeClassToWire()` is the ONE function that resolves
// it to a literal `Rung`, at emit time, so no future caller (UI component
// or spec) can reintroduce the same ternary — there is structurally nowhere
// else for that decision to live.
//
// See v3-D26 (DECISIONS.md) for the full reasoning behind each mapping
// below and its explicit flag for reconsideration once M4's spec-driven
// question compiler lands and gives this abstraction a real second caller.

import type { Rung } from "./types.ts";

export type GradeClass = "pretest" | "ungraded" | "s2_partial" | "s3_full" | "rc" | "gate";

const GRADE_CLASS_TO_RUNG: Record<GradeClass, Rung> = {
  s2_partial: "S2",
  s3_full: "S3",
  rc: "RC",
  gate: "S3", // gates only ever apply to S3-encoded ayat (golden log: every gate_result carries rung S3)
  pretest: "S1", // the golden log's own pretest tap (g01) carries rung S1
  ungraded: "S4", // rebuild.ts's own comment: "S4 rolls up as a light meaning signal, like S1"
};

/** Resolve a GradeClass to the literal Rung that belongs on the wire
 * (DrillEvent.rung). Total over the closed set — every GradeClass value
 * has a defined mapping. */
export function gradeClassToWire(gradeClass: GradeClass): Rung {
  return GRADE_CLASS_TO_RUNG[gradeClass];
}
