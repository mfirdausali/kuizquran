// THE TRIAL-DAYS MIRROR-AGREEMENT GUARD.
//
// `config/pricing.php`'s `trial.days` and this package's own `TRIAL_DAYS_MS`
// (gate.ts) each carry the SAME v3-D07-derived number, declared independently
// in two languages with no shared import path between them — the identical
// shape `cache-config-agreement.test.ts` already guards for
// `offline_ttl_days`/`OFFLINE_TTL_MS` (see DECISIONS.md v3-D150). Nothing
// asserted the trial pair agree; a future change to either number would
// silently desync client-side trial enforcement from the server's own
// `PaywallGate::permitsIssuance()` (v3-D07's other half, see
// PaywallBoundaryTest.php).
//
// This test is the mechanical link: it reads the PHP config file's raw text
// and asserts the parsed day count matches this package's own millisecond
// constant exactly.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TRIAL_DAYS_MS } from "./gate";

const PRICING_CONFIG_PATH = path.resolve(__dirname, "../../../../api/config/pricing.php");

function parseTrialDays(source: string): number {
  const match = source.match(/'trial'\s*=>\s*\[[^\]]*'days'\s*=>\s*(\d+)/s);
  if (!match) {
    throw new Error(
      "Could not find trial.days in config/pricing.php — has the key been renamed or removed?",
    );
  }
  return Number(match[1]);
}

describe("trial days — PHP config and TS constant agree", () => {
  it("TRIAL_DAYS_MS is exactly trial.days days, in milliseconds", () => {
    const source = readFileSync(PRICING_CONFIG_PATH, "utf8");
    const days = parseTrialDays(source);
    expect(TRIAL_DAYS_MS).toBe(days * 24 * 60 * 60 * 1000);
  });
});
