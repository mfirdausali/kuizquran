// THE NIGHTLY-WINDOW "CONFIRMED P1 RESETS THE WINDOW" MIRROR-AGREEMENT GUARD.
//
// `worker/fold-runner/src/severity.ts#resetsWindow` ("Does this severity
// reset the 7-consecutive-green-nights window? ... Only a P1 does", its own
// header's words, quoting BUILD-PLAN.md directly) and
// `App\Support\NightlyWindowLedger::status()` (the PHP side's own
// independent re-derivation of the SAME rule — scanning backward from the
// most recent night, the first non-green night's own severities are
// checked with the inline literal `if ($sev === 'p1') { $lastP1 = ... }`,
// the one place that decides WHICH check caused a confirmed-P1 window
// reset rather than merely an unrun/errored night) declare the identical
// rule independently, in two languages, with no shared source — the same
// mirror-drift shape `cache-config-agreement.test.ts` (v3-D150),
// `engineVersion-config-agreement.test.ts`,
// `severity-exitcode-agreement.test.ts` (v3-D288) and
// `nightlyWindow-countsAsGreen-agreement.test.ts` (v3-D291) already guard
// for other config/constant pairs on this exact Node/PHP boundary.
// `resetsWindow` itself has zero production callers anywhere (only
// `foldCheck.test.ts` exercises it, as a unit test of the function in
// isolation) — PHP re-derives its rule inline instead of being backed by
// any agreement test.
//
// Sharper than a stale label: a future edit to the Severity taxonomy (e.g.
// adding a new variant that should also reset the window, or renaming
// "p1") landed in `severity.ts` alone would silently desync from this PHP
// literal, with nothing catching it — the one fact this mechanism exists to
// report (whether a confirmed divergence actually reset the 7-night launch
// gate) could then disagree with what the fold-runner itself believes,
// exactly the false-alarm/deafness risk BUILD-PLAN's own top risk #6 names.
// Both sides already agree today (only "p1" resets, on both sides) — this
// is a drift-risk fix, not a live divergence.
//
// This test is the mechanical link: it reads the PHP ledger's raw source
// text (the same technique the three sibling agreement tests above already
// use) and asserts, for every real `Severity` value, that whether PHP's
// inline check treats it as the window-resetting severity agrees with
// `resetsWindow()`.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resetsWindow, type Severity } from "../src/severity.ts";

const LEDGER_PATH = path.resolve(
  __dirname,
  "../../../api/app/Support/NightlyWindowLedger.php",
);

const ALL_SEVERITIES: Severity[] = ["green", "warn", "p1", "error"];

/** Parses the PHP ledger's own inline "does this severity cause a
 *  confirmed-P1 window reset" condition (`if ($sev === '...') { $lastP1 =
 *  ... }`) and returns the severity literal it checks against. */
function parsePhpResetSeverity(source: string): string {
  const match = source.match(
    /if\s*\(\s*\$sev\s*===\s*'(\w+)'\s*\)\s*\{\s*\$lastP1\s*=/,
  );
  if (!match?.[1]) {
    throw new Error(
      "Could not find NightlyWindowLedger.php's inline window-reset check (`if ($sev === '...') { $lastP1 = ... }`) — has it been refactored?",
    );
  }
  return match[1];
}

describe("nightly window ledger — PHP's inline lastP1 check agrees with resetsWindow()", () => {
  it("every severity PHP's inline check treats as window-resetting matches resetsWindow()", () => {
    const source = readFileSync(LEDGER_PATH, "utf8");
    const phpResetSeverity = parsePhpResetSeverity(source);

    for (const sev of ALL_SEVERITIES) {
      expect(resetsWindow(sev)).toBe(sev === phpResetSeverity);
    }
  });

  it("PHP's reset literal is exactly the one TS severity where resetsWindow is true — no stray and none missing", () => {
    const source = readFileSync(LEDGER_PATH, "utf8");
    const phpResetSeverity = parsePhpResetSeverity(source);

    const tsResetSeverities = ALL_SEVERITIES.filter(resetsWindow);
    expect(tsResetSeverities).toEqual([phpResetSeverity]);
  });
});
