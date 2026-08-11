// BUILD-PLAN.md's gate taxonomy, made REAL — a type and an exit code, not a
// string in a log line.
//
//   fold_determinism_check: "Divergence = P1; version skew = WARN."
//   7-consecutive-green-nights: "confirmed P1 resets the window, WARN does
//   not."
//
// The window ledger (api/app/Support/NightlyWindow) decides "reset or not"
// by reading the severity a runner EXITS with. If the taxonomy were only a
// string in stdout, a ledger bug or a log-format change would silently
// convert a P1 into a WARN and the 7-night window would count a night it
// should have reset. So the severity is the process's exit code, the
// narrowest, hardest-to-fake channel available across the Node/PHP boundary.
//
// Exit codes are chosen to be distinguishable from the accidents:
//   0  GREEN — the check ran and found nothing.
//   3  WARN  — the check ran, found only version skew (engine_version on a
//              cached row differs from the folding engine's own version).
//              The cache is stale, not wrong. Does NOT reset the window.
//   4  P1    — the check ran and found a genuine divergence under the SAME
//              engine version. Resets the window. Pages by email (v3-D18).
//   5  ERROR — the check could not run (bad input, missing file, crash).
//              NOT green, and NOT a P1 either: an unrun check is unknown,
//              and edge case #167's rule ("the failure path returns null,
//              not zero") applies to nights as much as to dashboards. A
//              night that errored is not counted green and does not reset.
//
// 1 and 2 are deliberately unused: Node itself exits 1 on an uncaught throw
// and shells use 2 for usage errors, so reusing them would make a crash
// indistinguishable from a verdict.

export type Severity = "green" | "warn" | "p1" | "error";

export const EXIT_CODE: Record<Severity, number> = {
  green: 0,
  warn: 3,
  p1: 4,
  error: 5,
};

/** Inverse of EXIT_CODE — how PHP-side or shell-side callers read a run
 *  back. An unrecognized code is "error", never silently "green". */
export function severityFromExitCode(code: number): Severity {
  for (const [sev, c] of Object.entries(EXIT_CODE)) {
    if (c === code) return sev as Severity;
  }
  return "error";
}

/** Does this severity reset the 7-consecutive-green-nights window?
 *  BUILD-PLAN.md: "confirmed P1 resets the window, WARN does not." Only a
 *  P1 does. An error night is not green (so the streak cannot extend
 *  through it) but is not a CONFIRMED divergence either, so it does not
 *  reset an already-earned streak to zero. */
export function resetsWindow(severity: Severity): boolean {
  return severity === "p1";
}

/** Does this severity COUNT as one of the seven green nights? Only a clean
 *  run, or a run whose sole finding was version skew — BUILD-PLAN.md's
 *  "both determinism checks green nightly" with skew explicitly carved out
 *  as WARN rather than failure. */
export function countsAsGreen(severity: Severity): boolean {
  return severity === "green" || severity === "warn";
}
