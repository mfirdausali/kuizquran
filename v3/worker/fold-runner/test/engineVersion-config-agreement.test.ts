// THE ENGINE-VERSION MIRROR-AGREEMENT GUARD.
//
// `worker/fold-runner/src/engineVersion.ts#ENGINE_VERSION` (the fold-runner's
// own real, authoritative "pinned engine version" its own header describes)
// and `api/config/nightly.php`'s `engine_version` default (the PHP side's
// independent copy, read by DeterminismCheckCommand and AtomCacheRebuilder to
// stamp every real atom_cache row) declare the SAME string independently, in
// two languages, with no shared source — the identical mirror-drift shape
// `cache-config-agreement.test.ts` (v3-D150), `trial-config-agreement.test.ts`
// and `pricing-config-agreement.test.ts` already guard for other config
// pairs. Nothing asserted this pair agree.
//
// This one is sharper than most: `severity.ts`'s whole P1-vs-WARN taxonomy
// ("Divergence = P1; version skew = WARN") depends on comparing a cached
// row's recorded engine_version against "the engine version this run folds
// under" — and every real (non-`--fixture`) invocation stamps rows from
// PHP's config value, never from this TS constant (`foldCheck.test.ts`'s own
// spy seam is the one place ENGINE_VERSION itself is exercised as "current").
// A future engine bump that updates one side and not the other would not
// merely mis-tag a row — it would turn a stale-cache skew into a false P1,
// or a genuine divergence into a silently-swallowed WARN, exactly the 3am
// false-alarm/deafness risk BUILD-PLAN's own top-risk #6 names.
//
// This test is the mechanical link: it reads the PHP config file's raw text
// (the same technique `PricingConstantsTest`/`pricing-config-agreement.test.ts`
// already use) and asserts the parsed default matches ENGINE_VERSION exactly.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../src/engineVersion.ts";

const NIGHTLY_CONFIG_PATH = path.resolve(__dirname, "../../../api/config/nightly.php");

function parseEngineVersionDefault(source: string): string {
  const match = source.match(
    /'engine_version'\s*=>\s*env\(\s*'NIGHTLY_ENGINE_VERSION'\s*,\s*'([^']+)'\s*\)/,
  );
  if (!match?.[1]) {
    throw new Error(
      "Could not find engine_version's env() default in api/config/nightly.php — has the key been renamed or removed?",
    );
  }
  return match[1];
}

describe("engine version — TS ENGINE_VERSION and PHP config('nightly.engine_version') agree", () => {
  it("the PHP default matches the TS constant exactly", () => {
    const source = readFileSync(NIGHTLY_CONFIG_PATH, "utf8");
    const phpDefault = parseEngineVersionDefault(source);
    expect(ENGINE_VERSION).toBe(phpDefault);
  });
});
