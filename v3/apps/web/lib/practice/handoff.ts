// THE `/practice` → `/session` URL CONTRACT — FR6 Door 3's own half of the
// pattern `lib/drill/handoff.ts` established for step 20's continuous drill.
//
// Kept as its OWN small module, not folded into `lib/drill/handoff.ts`: a
// drill selection is a RANGE or PAGE of many ayat with a graded/victory-lap
// CHOICE (step 20); open practice is always exactly ONE ayah, always
// free-play (no graded option — see `run.ts#startOpenPractice`'s own
// header), and picks a DIFFICULTY rather than a stretch. Sharing one contract
// for two shapes that differ this much would invite exactly the kind of
// silent cross-talk `check-boundaries.mjs` clause 5 exists to prevent
// elsewhere.
//
// Pure functions of strings and small records, unit-tested the same way
// `drill-handoff.test.ts` proves its own contract: round-tripping through an
// ACTUAL URL, and a hand-edited/absent query degrading to `null` (an ordinary
// session) rather than a throw (edge case #78).

import type { OpenPracticeDrill } from "@/lib/session/run";

/** A resolved open-practice request: which ayah, at which difficulty. */
export interface PracticeSpec {
  readonly ayah: number;
  readonly drill: OpenPracticeDrill;
}

/** Build the `/session` href for a chosen ayah + difficulty. The picker links
 *  here; `parsePracticeParams` reads it back. */
export function practiceHref(spec: PracticeSpec): string {
  return `/session?practice=1&ayah=${spec.ayah}&drill=${spec.drill.toLowerCase()}`;
}

/** The raw `/session` query params this contract reads. */
export interface PracticeParams {
  practice?: string;
  ayah?: string;
  drill?: string;
}

/**
 * Parse `/session` search params into a `PracticeSpec`, or `null` when this is
 * not a (valid) open-practice request. `practice` must be the literal "1" —
 * an absent or mistyped marker degrades to an ordinary session, the safe
 * default, mirroring `parseDrillParams`'s own "unknown grade means graded"
 * discipline. Bounds against the actual corpus (does this ayah exist?) are
 * NOT checked here — `startOpenPractice` re-derives that off the fold via
 * `openPracticePick`, so a hand-edited `ayah=999` degrades to an honest
 * `invalid-ayah` state rather than a 500.
 */
export function parsePracticeParams(params: PracticeParams): PracticeSpec | null {
  if (params.practice !== "1") return null;
  const ayah = Number(params.ayah);
  if (!Number.isInteger(ayah) || ayah < 1) return null;
  const drill: OpenPracticeDrill | null =
    params.drill === "s3" ? "S3" : params.drill === "s2" ? "S2" : null;
  if (!drill) return null;
  return { ayah, drill };
}
