// PER-WORD TAP ACCURACY — the ayah detail route's "one tap deeper" diagnostic
// (heatmap.ts's own docstring), surfaced for the first time.
//
// `packages/engine/src/heatmap.ts#wordDiagnostics` has been built and tested
// since the heatmap landed, but nothing under `app/`/`components/` ever called
// it — the same "mechanism built and unit-tested, zero production callers"
// shape DECISIONS.md's recent nightly entries (v3-D89..D101) keep finding.
// `wordDiagnostics` already does the one thing that matters (excludes pretest
// taps per invariant #3, aggregates by POSITION not by surface text so a
// repeated word's two instances are never conflated); this module owns only
// the presentation decision, following `rows.ts`'s rule: THE COMPONENT NEVER
// COMPUTES, IT ONLY PRINTS.
//
// A word never tapped is DROPPED, not printed as "0%" or "—" — see `rows.ts`'s
// own unmeasured-vs-zero rule. "0%" on an untouched word would read as a
// measurement; the truth is there is no measurement to show, so it is simply
// absent from the list rather than padded with a claim nobody made.

import type { WordDiagnostic } from "@engine/heatmap.ts";

export interface WordAccuracyRow {
  position: number;
  /** "75%", or "—" for a word that WAS tapped but never graded (taps>0,
   *  accuracy null cannot actually occur from wordDiagnostics today, but the
   *  label stays honest rather than assuming). */
  accuracyLabel: string;
  /** "1 tap" / "4 taps" — never a bare number. */
  tapsLabel: string;
}

/**
 * Only words with at least one graded tap are returned, in position order.
 * An ayah nobody has tapped word-by-word yet returns `[]` — the caller
 * renders the designed empty state, never a table of absent measurements.
 */
export function buildWordAccuracyRows(diagnostics: readonly WordDiagnostic[]): WordAccuracyRow[] {
  return diagnostics
    .filter((d) => d.taps > 0)
    .map((d) => ({
      position: d.position,
      accuracyLabel: d.accuracy === null ? "—" : `${Math.round(d.accuracy * 100)}%`,
      tapsLabel: `${d.taps} tap${d.taps === 1 ? "" : "s"}`,
    }));
}
