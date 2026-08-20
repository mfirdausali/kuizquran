// THE HANDOFF FROM `/drill` TO `/session` — step 20's missing seam.
//
// The picker (`components/drill/DrillPicker.tsx`) knows the learner's chosen
// RANGE or PAGE and their graded-vs-victory-lap mode; the session loop
// (`lib/session/run.ts#startDrillSession`) knows how to run one. Between them
// sits the `/session` URL, which is the only thing that survives the
// navigation. This module is the two halves of that URL contract, kept
// together so a link the picker WRITES can never drift from what the session
// route READS.
//
// Everything here is a pure function of strings and small records — no corpus,
// no log — so both directions are unit-tested in isolation
// (`test/drill-handoff.test.ts`). The one product decision it encodes: an
// unparseable or absent drill query is `null` (an ordinary session), never a
// throw, because a learner can hand-edit this URL (edge case #78).

import type { DrillMode } from "./preview";
import type { DrillSelection } from "./sites";

/** A resolved drill request: what to drill and how it counts. `mode` is carried
 *  (not a bare boolean) so the ONE mapping to `structured` stays in
 *  `preview.ts#structuredFor`, the same place the picker's radio labels come
 *  from. */
export interface DrillSpec {
  selection: DrillSelection;
  mode: DrillMode;
}

/** The `grade` query value for a mode. `victory` ⇒ victory lap; anything else
 *  (including absent) ⇒ graded, the safe default — a mistyped grade must never
 *  silently turn a graded review into an un-damaging one. */
function gradeParam(mode: DrillMode): "graded" | "victory" {
  return mode === "victory-lap" ? "victory" : "graded";
}

/** Build the `/session` href for a drill selection + mode. The picker links
 *  here; `parseDrillParams` reads it back. */
export function drillHref(selection: DrillSelection, mode: DrillMode): string {
  const grade = gradeParam(mode);
  if (selection.kind === "range") {
    return `/session?drill=range&from=${selection.from}&to=${selection.to}&grade=${grade}`;
  }
  return `/session?drill=page&page=${selection.page}&grade=${grade}`;
}

/** The raw `/session` query params this contract reads. */
export interface DrillParams {
  drill?: string;
  from?: string;
  to?: string;
  page?: string;
  grade?: string;
}

/**
 * Parse `/session` search params into a `DrillSpec`, or `null` when this is not
 * a (valid) drill request. Validation is deliberately strict on the coordinates
 * — a range must be a real ascending integer interval, a page a positive
 * integer — but forgiving on `grade` (an unknown value means graded, the safe
 * side). Bounds against the actual corpus (does this ayah/page exist?) are NOT
 * checked here — `ayatForSelection` resolves an out-of-range or non-existent
 * selection to an empty drill, and `startDrillSession` reports `none-ready`, so
 * a hand-edited `from=999` degrades to an honest empty state rather than a 500.
 */
export function parseDrillParams(params: DrillParams): DrillSpec | null {
  const mode: DrillMode = params.grade === "victory" ? "victory-lap" : "graded";

  if (params.drill === "range") {
    const from = Number(params.from);
    const to = Number(params.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
      return null;
    }
    return { selection: { kind: "range", from, to }, mode };
  }

  if (params.drill === "page") {
    const page = Number(params.page);
    if (!Number.isInteger(page) || page < 1) return null;
    return { selection: { kind: "page", page }, mode };
  }

  return null;
}
