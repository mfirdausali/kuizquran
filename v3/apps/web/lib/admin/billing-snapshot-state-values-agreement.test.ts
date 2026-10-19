// `lib/admin/billingAudit.ts`'s own `isBillingSnapshot()` validator — the
// gate every real `GET /api/admin/billing/{userId}` response passes through
// before `loadBillingSnapshot()` will call it `"ready"` — decides whether a
// server-sent `state`/`tier` is well-formed against two module-PRIVATE
// runtime arrays, `STATE_VALUES`/`TIER_VALUES`, hand-declared on that file's
// own lines (currently `["trial","active","grace","lapsed_review_only"]` /
// `["none","monthly","lifetime"]`).
//
// `entitlement-enum-agreement.test.ts` (v3-D325) already pins this file's
// `BillingStateValue`/`BillingTierValue` TYPES against the canonical
// `EntitlementState`/`EntitlementTier` types at the type level (the
// `Equal<A,B>` trick) — but a TYPE-level union and a RUNTIME value array are
// two different declarations with no mechanical link between them:
// TypeScript cannot derive `STATE_VALUES` FROM `BillingStateValue`, so a
// future edit that correctly widens the type (satisfying that type guard)
// while forgetting to widen the separate `STATE_VALUES`/`TIER_VALUES`
// literal would still compile clean and still pass that test — and would
// make `isBillingSnapshot()` silently REJECT a real, well-formed server
// response carrying the new state/tier, degrading it to
// `{state: "unavailable", reason: "the API's answer carried no billing
// snapshot"}` for every admin who looks up that learner's billing. That is
// exactly the "two implementations of one decision, no shared source" shape
// this build has repeatedly closed (`ADMIN_ROLE_VALUES` v3-D324,
// `REVEAL_REASON_CODES` v3-D311, `ENTITLEMENT_STATES`/`ENTITLEMENT_TIERS`
// themselves v3-D325) — here one level deeper than v3-D325 reached: the
// VALUE mirror `entitlement-enum-agreement.test.ts`'s own comment names but
// never actually guards.
//
// `billingAudit.ts` cannot import `lib/entitlement/types.ts` to close this
// by sharing a source (the same `check-boundaries.mjs` clause 9 boundary
// `entitlement-enum-agreement.test.ts` already explains — a production file
// outside the allowlist may not spell the gated word), and `STATE_VALUES`/
// `TIER_VALUES` are deliberately module-private, so this file cannot import
// them directly either. Instead this test drives the REAL, exported
// `loadBillingSnapshot()` — the one place `isBillingSnapshot()` is actually
// called — with a full, otherwise-valid server response for EVERY member of
// the canonical `ENTITLEMENT_STATES`/`ENTITLEMENT_TIERS` sets, and asserts
// each one is accepted (`state: "ready"`), never silently downgraded to
// `"unavailable"`. This is a behavioral proof of VALUE agreement, not a
// second type-level assertion.
//
// Not a live divergence today — `STATE_VALUES`/`TIER_VALUES` already agree
// with `ENTITLEMENT_STATES`/`ENTITLEMENT_TIERS` byte-for-byte — a drift-risk
// fix, same discipline as every precedent named above.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { ENTITLEMENT_STATES, ENTITLEMENT_TIERS } from "@/lib/entitlement/types";
import { loadBillingSnapshot } from "./billingAudit";

/** A full, otherwise-valid `BillingSnapshot` wire payload, varying only the
 *  one field under test — mirrors `billingAudit.test.ts`'s own "requests
 *  /api/admin/billing/{userId}" fixture shape exactly, so this is the same
 *  real response shape the server actually sends, not a narrowed stand-in. */
function snapshotBody(overrides: { state: string; tier: string }): string {
  return JSON.stringify({
    exists: true,
    state: overrides.state,
    tier: overrides.tier,
    region: "MY",
    trialSurah: 12,
    trialStartedAt: 1_700_000_000_000,
    currentPeriodEnd: 1_700_500_000_000,
    graceUntil: 1_700_600_000_000,
    provider: "stripe",
    providerCustomerId: "cus_abc123",
    providerSubscriptionId: "sub_def456",
    stateVersion: 3,
    lastProviderEventAt: 1_700_700_000_000,
  });
}

describe("loadBillingSnapshot's real validator accepts every canonical state/tier", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it.each(ENTITLEMENT_STATES)("accepts state=%s (no silent rejection)", async (state) => {
    globalThis.fetch = vi.fn(
      async () => new Response(snapshotBody({ state, tier: "none" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await loadBillingSnapshot(1);

    expect(result.state).toBe("ready");
    if (result.state === "ready") {
      expect(result.snapshot.state).toBe(state);
    }
  });

  it.each(ENTITLEMENT_TIERS)("accepts tier=%s (no silent rejection)", async (tier) => {
    globalThis.fetch = vi.fn(
      async () => new Response(snapshotBody({ state: "trial", tier }), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await loadBillingSnapshot(1);

    expect(result.state).toBe("ready");
    if (result.state === "ready") {
      expect(result.snapshot.tier).toBe(tier);
    }
  });

  it("sanity: the canonical sets are non-empty, so the loops above are non-vacuous", () => {
    expect(ENTITLEMENT_STATES.length).toBeGreaterThan(0);
    expect(ENTITLEMENT_TIERS.length).toBeGreaterThan(0);
  });
});
