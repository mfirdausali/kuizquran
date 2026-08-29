// THE OFFLINE-TTL MIRROR-AGREEMENT GUARD.
//
// `config/pricing.php`'s `offline_ttl_days` and this package's own
// `OFFLINE_TTL_MS` (cache.ts) each carry the SAME v3-D07-derived number,
// declared independently in two languages with no shared import path between
// them (there is no established Next→Laravel config-sharing pattern in this
// codebase — see DECISIONS.md v3-D149's own "not addressed" note). Nothing
// asserted they agree; `config('pricing.offline_ttl_days')` has zero
// Laravel-side readers of its own (it exists purely so this file's docblock
// claim — "Mirrors `config/pricing.php`'s `offline_ttl_days`" — has
// something real to mirror), so a future change to either number would
// silently desync the other with no test anywhere noticing. Same shape as
// v3-D137's `MacroFacts` mirror-agreement gap, applied to a runtime value
// instead of a compile-time type.
//
// This test is the mechanical link: it reads the PHP config file's raw text
// (the same technique `PricingConstantsTest::
// test_no_price_literal_exists_outside_the_pricing_config` already uses to
// scan PHP source from a test) and asserts the parsed day count matches this
// package's own millisecond constant exactly.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OFFLINE_TTL_MS } from "./cache";

const PRICING_CONFIG_PATH = path.resolve(__dirname, "../../../../api/config/pricing.php");

function parseOfflineTtlDays(source: string): number {
  const match = source.match(/'offline_ttl_days'\s*=>\s*(\d+)/);
  if (!match) {
    throw new Error(
      "Could not find 'offline_ttl_days' in config/pricing.php — has the key been renamed or removed?",
    );
  }
  return Number(match[1]);
}

describe("offline TTL — PHP config and TS constant agree", () => {
  it("OFFLINE_TTL_MS is exactly offline_ttl_days days, in milliseconds", () => {
    const source = readFileSync(PRICING_CONFIG_PATH, "utf8");
    const days = parseOfflineTtlDays(source);
    expect(OFFLINE_TTL_MS).toBe(days * 24 * 60 * 60 * 1000);
  });
});
