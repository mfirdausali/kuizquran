// THE TRIAL MIRROR-AGREEMENT GUARD.
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
// `config/pricing.php`'s sibling `trial.surahs` key has the identical shape,
// unguarded: `lib/pricing.ts`'s own `TRIAL.surahs` is a THIRD independent
// declaration of the same v3-D07 number ("one surah, or 14 days"), read only
// by `PricingPanel.tsx`'s landing-page copy — never by `gate.ts`, despite
// that component's own prior comment claiming otherwise (corrected
// alongside this fix, v3-D321). `PricingConstantsTest.php` pins
// `trial.surahs` against its own hardcoded `1`, and `test/pricing.test.ts`
// pins `TRIAL.surahs` against its own hardcoded `1`; neither reads the
// other file, so a future change to the trial-surah count landed on only
// one side would silently desync the landing page's own "one surah" promise
// from the number the server actually enforces — not a live divergence
// today (both already agree), a drift-risk fix matching every prior
// instance of this shape.
//
// These tests are the mechanical link: each reads the PHP config file's raw
// text and asserts the parsed value matches this package's own constant
// exactly.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TRIAL_DAYS_MS } from "./gate";
import { TRIAL } from "../pricing";

const PRICING_CONFIG_PATH = path.resolve(__dirname, "../../../../api/config/pricing.php");

function parseTrialField(source: string, field: string): number {
  const match = source.match(new RegExp(`'trial'\\s*=>\\s*\\[[^\\]]*'${field}'\\s*=>\\s*(\\d+)`, "s"));
  if (!match) {
    throw new Error(
      `Could not find trial.${field} in config/pricing.php — has the key been renamed or removed?`,
    );
  }
  return Number(match[1]);
}

describe("trial days — PHP config and TS constant agree", () => {
  it("TRIAL_DAYS_MS is exactly trial.days days, in milliseconds", () => {
    const source = readFileSync(PRICING_CONFIG_PATH, "utf8");
    const days = parseTrialField(source, "days");
    expect(TRIAL_DAYS_MS).toBe(days * 24 * 60 * 60 * 1000);
  });
});

describe("trial surah count — PHP config and TS constant agree", () => {
  it("TRIAL.surahs (lib/pricing.ts) matches trial.surahs", () => {
    const source = readFileSync(PRICING_CONFIG_PATH, "utf8");
    const surahs = parseTrialField(source, "surahs");
    expect(TRIAL.surahs).toBe(surahs);
  });
});
