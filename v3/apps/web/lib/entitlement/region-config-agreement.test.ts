// THE REGION-SET MIRROR-AGREEMENT GUARD, ONE COPY OVER.
//
// `lib/entitlement/types.ts`'s own `REGIONS` (the runtime mirror of `Region`,
// the one place `sync.ts#fetchEntitlementSnapshot()` validates a real server
// response's `region` field) and `config/pricing.php`'s own `'regions'` key
// are two independent declarations of the IDENTICAL v3-D07 region set, with
// no shared source between them — the exact "two implementations of one
// decision, no shared source" shape `pricing-config-agreement.test.ts`
// already guards for `lib/pricing.ts`'s own `PRICING` key set, on the SAME
// PHP config key. `types.ts`'s own `REGIONS` is a THIRD independent copy
// that test never touches, since it lives in a different file entirely.
//
// Not a live divergence today — both sides already agree (`["MY", "INTL"]`)
// — a drift-risk fix: a future region added or retired in
// `config/pricing.php` alone would silently desync what
// `fetchEntitlementSnapshot()`'s own validator accepts as a well-formed
// server response from what the server actually sends, degrading every
// learner in the new region to a dropped/`null` entitlement snapshot.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REGIONS } from "./types";

const PRICING_CONFIG_PATH = path.resolve(__dirname, "../../../../api/config/pricing.php");

function parseRegionsList(source: string): string[] {
  const list = source.match(/'regions'\s*=>\s*\[([^\]]*)\]/)?.[1];
  if (list === undefined) {
    throw new Error("Could not find the 'regions' key in config/pricing.php.");
  }
  return Array.from(list.matchAll(/'([A-Z]+)'/g))
    .map((m) => m[1])
    .filter((region): region is string => region !== undefined);
}

describe("lib/entitlement/types.ts's REGIONS agrees with config/pricing.php's 'regions'", () => {
  it("the same set, no stray, none missing", () => {
    const source = readFileSync(PRICING_CONFIG_PATH, "utf8");
    const parsed = parseRegionsList(source);
    expect([...REGIONS].sort()).toEqual([...parsed].sort());
  });
});
