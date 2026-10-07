// THE SEVERITY-EXIT-CODE MIRROR-AGREEMENT GUARD.
//
// `worker/fold-runner/src/severity.ts#EXIT_CODE` (the BUILD-PLAN taxonomy —
// green=0/warn=3/p1=4/error=5 — the "narrowest, hardest-to-fake channel
// across the Node/PHP boundary", its own header's words) and
// `App\Console\Commands\DeterminismCheckCommand::SEVERITY_BY_EXIT` (the PHP
// side's own independent copy, used to decode a real nightly run's exit code
// back into a severity before it is written into the ledger row the
// 7-consecutive-green-nights window counts) declare the SAME mapping
// independently, in two languages, with no shared source — the identical
// mirror-drift shape `cache-config-agreement.test.ts` (v3-D150),
// `trial-config-agreement.test.ts`, `pricing-config-agreement.test.ts` and
// this file's own sibling `engineVersion-config-agreement.test.ts` already
// guard for other config/constant pairs. Named by v3-D127 as a real
// cross-runtime duplication and left unguarded through dozens of nightly
// sweeps since ("deliberately not restructured" — correct, since PHP cannot
// import a `.ts` module — but nothing mechanically asserted the two numeric
// maps still agree).
//
// Sharper than a stale label: a future edit to EITHER side's exit-code
// taxonomy that is not mirrored on the other would mis-decode every real
// nightly run from the moment it landed — a genuine P1 silently read back
// as a WARN (never resetting the 7-night window) or the reverse (resetting
// a window over a stale-cache skew that was never a real divergence),
// exactly the false-alarm/deafness risk BUILD-PLAN's own top risk #6 names.
// Both sides already agree today — this is a drift-risk fix, not a live
// divergence.
//
// This test is the mechanical link: it reads the PHP command's raw source
// text (the same technique `engineVersion-config-agreement.test.ts` already
// uses) and asserts every PHP exit-code -> severity entry matches what the
// real TS `severityFromExitCode()` returns for that same code, and that
// neither side declares a code the other does not.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT_CODE, severityFromExitCode } from "../src/severity.ts";

const DETERMINISM_COMMAND_PATH = path.resolve(
  __dirname,
  "../../../api/app/Console/Commands/DeterminismCheckCommand.php",
);

function parseSeverityByExit(source: string): Record<number, string> {
  const match = source.match(/SEVERITY_BY_EXIT\s*=\s*\[([\s\S]*?)\];/);
  if (!match?.[1]) {
    throw new Error(
      "Could not find SEVERITY_BY_EXIT's array body in DeterminismCheckCommand.php — has the constant been renamed or removed?",
    );
  }
  const body = match[1];
  const entries = [...body.matchAll(/(\d+)\s*=>\s*'(\w+)'/g)];
  if (entries.length === 0) {
    throw new Error(
      "SEVERITY_BY_EXIT's array body matched but no `code => 'severity'` entries were parsed — has its shape changed?",
    );
  }
  const out: Record<number, string> = {};
  for (const entry of entries) {
    out[Number(entry[1])] = entry[2]!;
  }
  return out;
}

describe("severity taxonomy — TS EXIT_CODE and PHP SEVERITY_BY_EXIT agree", () => {
  it("every PHP exit-code -> severity entry matches severityFromExitCode()", () => {
    const source = readFileSync(DETERMINISM_COMMAND_PATH, "utf8");
    const phpMap = parseSeverityByExit(source);

    for (const [code, severity] of Object.entries(phpMap)) {
      expect(severityFromExitCode(Number(code))).toBe(severity);
    }
  });

  it("the PHP map declares exactly the codes TS declares — no stray and none missing", () => {
    const source = readFileSync(DETERMINISM_COMMAND_PATH, "utf8");
    const phpMap = parseSeverityByExit(source);

    const tsCodes = Object.values(EXIT_CODE).sort((a, b) => a - b);
    const phpCodes = Object.keys(phpMap)
      .map(Number)
      .sort((a, b) => a - b);

    expect(phpCodes).toEqual(tsCodes);
  });
});
