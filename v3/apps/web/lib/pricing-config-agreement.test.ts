// THE PRICE-AMOUNT MIRROR-AGREEMENT GUARD.
//
// `config/pricing.php` and this package's own `lib/pricing.ts` each declare
// the SAME v3-D07 amounts independently, in two languages, with no shared
// import path between them — the identical shape `cache-config-agreement
// .test.ts` (v3-D150) and `trial-config-agreement.test.ts` already guard for
// `offline_ttl_days`/`OFFLINE_TTL_MS` and `trial.days`/`TRIAL_DAYS_MS`. The
// actual money amounts never got the same guard: `PricingConstantsTest.php`
// and `test/pricing.test.ts` each assert their OWN file's numbers against
// the same hardcoded v3-D07 prose string, but neither reads the other file,
// so a change to `config/pricing.php`'s real Stripe amounts that is not
// mirrored into `lib/pricing.ts`'s DISPLAY amounts leaves both suites green
// while a learner sees one price and is charged another — the same
// mirror-drift shape as v3-D149/D150, here on the number that matters most.
//
// This test is the mechanical link: it reads the PHP config file's raw text
// (the same technique `PricingConstantsTest::
// test_no_price_literal_exists_outside_the_pricing_config` already uses to
// scan PHP source from a test) and asserts every PRICING amount, currency
// and rail set matches the parsed PHP source exactly.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRICING } from "./pricing";

const PRICING_CONFIG_PATH = path.resolve(__dirname, "../../../api/config/pricing.php");

type Region = "MY" | "INTL";

interface ParsedRegion {
  currency: string;
  monthly: number;
  lifetime: number;
}

function parseRegionBlock(source: string, region: Region): ParsedRegion {
  const block = source.match(new RegExp(`'${region}'\\s*=>\\s*\\[([^\\]]*)\\]`, "s"))?.[1];
  if (block === undefined) {
    throw new Error(`Could not find the '${region}' block in config/pricing.php.`);
  }

  const currency = block.match(/'currency'\s*=>\s*'([A-Z]{3})'/)?.[1];
  const monthly = block.match(/'monthly'\s*=>\s*(\d+)/)?.[1];
  const lifetime = block.match(/'lifetime'\s*=>\s*(\d+)/)?.[1];
  if (currency === undefined || monthly === undefined || lifetime === undefined) {
    throw new Error(`Could not parse currency/monthly/lifetime out of the '${region}' block.`);
  }

  return { currency, monthly: Number(monthly), lifetime: Number(lifetime) };
}

interface ParsedRails {
  monthly: string[];
  lifetime: string[];
}

function parseRailList(block: string, plan: "monthly" | "lifetime", label: string): string[] {
  const list = block.match(new RegExp(`'${plan}'\\s*=>\\s*\\[([^\\]]*)\\]`))?.[1];
  if (list === undefined) {
    throw new Error(`Could not parse rails.${label}.${plan} in config/pricing.php.`);
  }
  return Array.from(list.matchAll(/'([a-z]+)'/g))
    .map((m) => m[1])
    .filter((rail): rail is string => rail !== undefined);
}

/**
 * `rails` is the ONLY top-level key whose value nests a per-region object
 * (`'MY' => [...]`, `'INTL' => [...]`) inside another `[...]`, so a single
 * bracket-matching regex can't safely bound it without also matching the
 * top-level `'MY'`/`'INTL'` price blocks above it. Splitting the rails
 * section's own text on the literal `'INTL'` marker avoids nested-bracket
 * regex entirely — each half then contains exactly one flat `'monthly'`/
 * `'lifetime'` array, which a simple non-nested regex parses safely.
 */
function parseRails(source: string): Record<Region, ParsedRails> {
  const railsBlock = source.match(/'rails'\s*=>\s*\[([\s\S]*?)\n\s*\],\n\n\s*\/\/ v3-D07/)?.[1];
  if (railsBlock === undefined) {
    throw new Error("Could not find the 'rails' block in config/pricing.php.");
  }

  const intlIndex = railsBlock.indexOf("'INTL'");
  if (intlIndex === -1) {
    throw new Error("Could not find 'INTL' inside the 'rails' block in config/pricing.php.");
  }
  const myBlock = railsBlock.slice(0, intlIndex);
  const intlBlock = railsBlock.slice(intlIndex);

  return {
    MY: {
      monthly: parseRailList(myBlock, "monthly", "MY"),
      lifetime: parseRailList(myBlock, "lifetime", "MY"),
    },
    INTL: {
      monthly: parseRailList(intlBlock, "monthly", "INTL"),
      lifetime: parseRailList(intlBlock, "lifetime", "INTL"),
    },
  };
}

describe("price amounts — PHP config and TS PRICING agree", () => {
  const source = readFileSync(PRICING_CONFIG_PATH, "utf8");

  it.each(["MY", "INTL"] as const)("%s currency/monthly/lifetime match config/pricing.php", (region) => {
    const parsed = parseRegionBlock(source, region);
    expect(PRICING[region].currency).toBe(parsed.currency);
    expect(PRICING[region].monthly).toBe(parsed.monthly);
    expect(PRICING[region].lifetime).toBe(parsed.lifetime);
  });

  it("MY/INTL monthly/lifetime rails match config/pricing.php", () => {
    const rails = parseRails(source);
    expect([...PRICING.MY.monthlyRails]).toEqual(rails.MY.monthly);
    expect([...PRICING.MY.lifetimeRails]).toEqual(rails.MY.lifetime);
    expect([...PRICING.INTL.monthlyRails]).toEqual(rails.INTL.monthly);
    expect([...PRICING.INTL.lifetimeRails]).toEqual(rails.INTL.lifetime);
  });
});
