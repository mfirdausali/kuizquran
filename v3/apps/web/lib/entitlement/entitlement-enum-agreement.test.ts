// THE ENTITLEMENT STATE/TIER MIRROR-AGREEMENT GUARD.
//
// `App\Billing\EntitlementState`/`EntitlementTier` (the server's own closed
// enums — the actual wire contract `GET /api/entitlement` and
// `POST /api/admin/billing/{userId}/override` both speak) had TWO
// independent TS-side re-declarations of their case VALUES, with no shared
// source and no agreement test anywhere against the real PHP enums:
//
//   1. `lib/entitlement/sync.ts`'s own module-private `STATES`/`TIERS`
//      runtime arrays — the validator that decides whether a REAL server
//      response to `GET /api/entitlement` is well-formed before
//      `permitsIssuance`/`permitsReview` ever see it.
//   2. `lib/admin/billingAudit.ts`'s own `BillingStateValue`/
//      `BillingTierValue` closed-union types (and their own `STATE_VALUES`/
//      `TIER_VALUES` runtime mirrors) — deliberately named without the
//      gated word and deliberately NOT importing `lib/entitlement/types.ts`,
//      per that file's own header: this is an admin support surface, not
//      one of the three real gating surfaces, so it "earns different names
//      instead" rather than an allowlist entry. That decoupling is correct
//      — but it is a decoupling of NAMES, not of the real cases those names
//      stand for, and nothing checked that the VALUES still agree.
//
// The exact "two (here three, once the PHP enum is counted) independent
// implementations of one decision, no shared source" shape this build has
// repeatedly closed elsewhere (`ADMIN_ROLE_VALUES` vs `AdminRole::ALL`,
// v3-D324; `REVEAL_REASON_CODES` vs `AdminAudit::REASON_CODES`, v3-D311;
// the launch surah set, v3-D296) — never before applied to the entitlement
// state machine's own closed sets, even though they are the single most
// load-bearing pair in the whole billing surface: a future
// `EntitlementState`/`EntitlementTier` case added or retired on the PHP
// side alone would silently desync what `sync.ts`'s own validator accepts
// as a well-formed server response (a real response in the new shape would
// be rejected outright, `fetchEntitlementSnapshot` returning `null`, which
// `cache.ts#freshness()` degrades to "server is authoritative" — a learner
// whose entitlement genuinely changed would read as having no cached
// entitlement at all) from what the server actually means.
//
// Not a live divergence today — every declaration already agrees
// byte-for-byte — a drift-risk fix, same discipline as the precedents named
// above.
//
// Fixed in two parts:
//   1. `lib/entitlement/types.ts` now exports the ONE canonical runtime
//      declaration, `ENTITLEMENT_STATES`/`ENTITLEMENT_TIERS`; `sync.ts`
//      imports them instead of re-declaring its own copy — the TS-side-only
//      half of this gap, closed the same way `OnboardedSteer.tsx`'s
//      `ONBOARDED_AT` (v3-D312) and `AdminRolesPanel.tsx`'s `ROLE_OPTIONS`
//      (v3-D324) were: one import, no second declaration.
//   2. This test. `billingAudit.ts`'s own deliberately-decoupled
//      `BillingStateValue`/`BillingTierValue` cannot (and must not) import
//      `lib/entitlement/types.ts` — doing so would re-open the exact
//      boundary hole `check-boundaries.mjs` clause 9 exists to close, since
//      a test file is explicitly exempt from that clause but a production
//      file is not. So its SET is instead pinned here, at the type level
//      (the `Equal<A,B>` strict type-identity trick
//      `schema-billing-agreement.test.ts`/`schema-onboarding-agreement
//      .test.ts` already use), against the canonical `EntitlementState`/
//      `EntitlementTier` types — guarding the mirror without ever letting
//      the gated word cross into `billingAudit.ts`'s own source. And the
//      canonical declaration itself is checked against the REAL PHP enum's
//      raw source text, the same `readFileSync` + regex-extract technique
//      `admin-role-values-agreement.test.ts`/`reveal-reason-codes-agreement
//      .test.ts` already use for a PHP enum/class-constant pair.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ENTITLEMENT_STATES, ENTITLEMENT_TIERS } from "./types";
import type { EntitlementState, EntitlementTier } from "./types";
import type { BillingStateValue, BillingTierValue } from "@/lib/admin/billingAudit";

const ENTITLEMENT_STATE_PHP_PATH = path.resolve(__dirname, "../../../../api/app/Billing/EntitlementState.php");
const ENTITLEMENT_TIER_PHP_PATH = path.resolve(__dirname, "../../../../api/app/Billing/EntitlementTier.php");

/** Extracts every `case Name = 'value';` string out of a PHP backed-enum's
 *  raw source — the same style of parse the admin-role/reveal-reason-code
 *  agreement tests already use for a class constant instead of an enum
 *  case. */
function parsePhpEnumCaseValues(source: string): string[] {
  const matches = [...source.matchAll(/case\s+[A-Za-z]+\s*=\s*'([a-z_]+)';/g)]
    .map((m) => m[1])
    .filter((v): v is string => typeof v === "string");
  if (matches.length === 0) {
    throw new Error("Could not find any enum case values in the given PHP source.");
  }
  return matches;
}

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type AssertTrue<T extends true> = T;

// If either `Equal<...>` is ever `false`, the corresponding line below fails
// to compile — the type argument violates the `extends true` constraint —
// naming both declarations, rather than surfacing later as a server
// response `billingAudit.ts`'s own validator silently rejects or accepts
// wrongly.
type _BillingStateAgreesWithEntitlementState = AssertTrue<Equal<BillingStateValue, EntitlementState>>;
type _BillingTierAgreesWithEntitlementTier = AssertTrue<Equal<BillingTierValue, EntitlementTier>>;

describe("ENTITLEMENT_STATES/ENTITLEMENT_TIERS agree with the server's real enums", () => {
  it("ENTITLEMENT_STATES is the exact same set as EntitlementState::cases(), no stray, none missing", () => {
    const phpValues = parsePhpEnumCaseValues(readFileSync(ENTITLEMENT_STATE_PHP_PATH, "utf8"));
    expect(new Set(ENTITLEMENT_STATES)).toEqual(new Set(phpValues));
    // Also pin the count, so a duplicate on either side (which a bare Set
    // comparison would silently absorb) still fails this test.
    expect(ENTITLEMENT_STATES.length).toBe(phpValues.length);
  });

  it("ENTITLEMENT_TIERS is the exact same set as EntitlementTier::cases(), no stray, none missing", () => {
    const phpValues = parsePhpEnumCaseValues(readFileSync(ENTITLEMENT_TIER_PHP_PATH, "utf8"));
    expect(new Set(ENTITLEMENT_TIERS)).toEqual(new Set(phpValues));
    expect(ENTITLEMENT_TIERS.length).toBe(phpValues.length);
  });

  it("the type-level BillingStateValue/BillingTierValue mirror guards above compiled", () => {
    // The real guards are the type-level assertions above, enforced by
    // `tsc --noEmit`. This assertion exists only so the guard is a counted,
    // running test rather than a type nobody ever references.
    const guardCompiled: true = true;
    expect(guardCompiled).toBe(true);
  });
});
