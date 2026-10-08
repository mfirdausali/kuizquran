// THE NIGHTLY-WINDOW GREEN-OR-WARN MIRROR-AGREEMENT GUARD.
//
// `worker/fold-runner/src/severity.ts#countsAsGreen` ("Does this severity
// COUNT as one of the seven green nights? Only a clean run, or a run whose
// sole finding was version skew", its own header's words) and
// `App\Support\NightlyWindowLedger::nights()` (the PHP side's own
// independent re-derivation, `if ($sev !== 'green' && $sev !== 'warn') {
// $green = false; }`, the one place BUILD-PLAN's 7-consecutive-green-nights
// launch gate decides whether a given night counts) declare the SAME rule
// independently, in two languages, with no shared source — the identical
// mirror-drift shape `cache-config-agreement.test.ts` (v3-D150),
// `engineVersion-config-agreement.test.ts` and this file's own sibling
// `severity-exitcode-agreement.test.ts` (v3-D288, the commit immediately
// preceding this one) already guard for other config/constant pairs on
// this exact Node/PHP boundary. `countsAsGreen` itself has zero production
// callers anywhere (only `foldCheck.test.ts` exercises it, as a unit test
// of the function in isolation) — PHP re-derives its rule inline instead of
// being backed by any agreement test.
//
// Sharper than a stale label: a future edit to the Severity taxonomy (e.g.
// widening what counts as green, or renaming a variant) landed in
// `severity.ts` alone would silently desync from this PHP re-derivation,
// with nothing catching it — the night's own green/red verdict and the
// launch-gate streak could then disagree with what the fold-runner itself
// believes, exactly the false-alarm/deafness risk BUILD-PLAN's own top
// risk #6 names. Both sides already agree today (green/warn on both sides)
// — this is a drift-risk fix, not a live divergence.
//
// This test is the mechanical link: it reads the PHP ledger's raw source
// text (the same technique `severity-exitcode-agreement.test.ts` already
// uses) and asserts, for every real `Severity` value, that whether PHP's
// inline check treats it as green-or-warn agrees with `countsAsGreen()`.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { countsAsGreen, type Severity } from "../src/severity.ts";

const LEDGER_PATH = path.resolve(
  __dirname,
  "../../../api/app/Support/NightlyWindowLedger.php",
);

const ALL_SEVERITIES: Severity[] = ["green", "warn", "p1", "error"];

/** Parses the PHP ledger's own inline "does this severity break a green
 *  night" condition and returns the set of severities it treats as
 *  green-or-warn-equivalent — the negation of what trips `$green = false`. */
function parsePhpGreenOrWarnSet(source: string): Set<string> {
  const match = source.match(
    /if\s*\(\s*\$sev\s*!==\s*'(\w+)'\s*&&\s*\$sev\s*!==\s*'(\w+)'\s*\)\s*\{\s*\$green\s*=\s*false;/,
  );
  if (!match?.[1] || !match?.[2]) {
    throw new Error(
      "Could not find NightlyWindowLedger.php's inline green-or-warn check (`if ($sev !== '...' && $sev !== '...') { $green = false; }`) — has it been refactored?",
    );
  }
  return new Set([match[1], match[2]]);
}

describe("nightly window ledger — PHP's inline green-or-warn check agrees with countsAsGreen()", () => {
  it("every severity PHP's inline check treats as green-or-warn matches countsAsGreen()", () => {
    const source = readFileSync(LEDGER_PATH, "utf8");
    const phpSet = parsePhpGreenOrWarnSet(source);

    for (const sev of ALL_SEVERITIES) {
      expect(countsAsGreen(sev)).toBe(phpSet.has(sev));
    }
  });

  it("PHP's green-or-warn set is exactly the TS severities where countsAsGreen is true — no stray and none missing", () => {
    const source = readFileSync(LEDGER_PATH, "utf8");
    const phpSet = parsePhpGreenOrWarnSet(source);

    const tsGreenSeverities = ALL_SEVERITIES.filter(countsAsGreen).sort();
    const phpGreenSeverities = [...phpSet].sort();

    expect(phpGreenSeverities).toEqual(tsGreenSeverities);
  });
});
