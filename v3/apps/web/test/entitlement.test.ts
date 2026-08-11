// THE ENTITLEMENT ISLAND — client gate + offline TTL.
//
// Mirrors `v3/api/tests/Feature/Billing/PaywallBoundaryTest.php`. The server is
// authoritative; these tests pin the OFFLINE behaviour, which is where the
// never-hostage rule is easiest to break by accident.

import { describe, expect, it } from "vitest";
import { OFFLINE_TTL_MS, freshness } from "../lib/entitlement/cache";
import { permitsIssuance, permitsReview } from "../lib/entitlement/gate";
import type { EntitlementSnapshot } from "../lib/entitlement/types";

const NOW = 1_700_000_000_000;

function snap(over: Partial<EntitlementSnapshot> = {}): EntitlementSnapshot {
  return {
    state: "active",
    tier: "monthly",
    region: "MY",
    trialSurah: null,
    cachedAt: NOW,
    ...over,
  };
}

describe("offline cache freshness", () => {
  it("is fresh inside the TTL and stale outside it", () => {
    expect(freshness(snap({ cachedAt: NOW }), NOW)).toBe("fresh");
    expect(freshness(snap({ cachedAt: NOW - OFFLINE_TTL_MS + 1000 }), NOW)).toBe("fresh");
    expect(freshness(snap({ cachedAt: NOW - OFFLINE_TTL_MS - 1000 }), NOW)).toBe("stale");
    expect(freshness(null, NOW)).toBe("absent");
  });
});

describe("v3-D16 / v3-D54 — review is NEVER gated", () => {
  it("permits review in every state, forever", () => {
    expect(permitsReview().permitted).toBe(true);
  });

  // The signature takes no clock and no surah ON PURPOSE — a function with no
  // time input cannot grow an expiry. This test pins that shape.
  it("takes no arguments, so it cannot grow an expiry or a per-surah lock", () => {
    expect(permitsReview.length).toBe(0);
  });
});

describe("issuance", () => {
  it("permits an active learner any surah", () => {
    expect(permitsIssuance(snap({ state: "active" }), 103, [12], NOW).permitted).toBe(true);
  });

  it("permits a grace learner (a failed payment is not a lockout — #117)", () => {
    expect(permitsIssuance(snap({ state: "grace" }), 103, [12], NOW).permitted).toBe(true);
  });

  it("permits the trial surah and denies others", () => {
    const s = snap({ state: "trial", trialSurah: 12 });
    expect(permitsIssuance(s, 12, [12], NOW).permitted).toBe(true);

    const denied = permitsIssuance(s, 103, [12], NOW);
    expect(denied.permitted).toBe(false);
    expect(denied.code).toBe("trial_surah_exhausted");
  });

  it("denies NEW content to a lapsed learner, indefinitely", () => {
    // NOTE the `cachedAt` moves WITH `now`. An earlier draft of this test held
    // cachedAt fixed and advanced now by ten years, which made the snapshot
    // STALE — so the stale branch answered first (correctly permitting an
    // already-owned surah) and the lapsed branch never ran. The test failed for
    // a reason that had nothing to do with what it was checking.
    //
    // Ten years on, with a FRESH snapshot: still denied for new content.
    const tenYears = NOW + 10 * 365 * 24 * 3600 * 1000;
    const s = snap({ state: "lapsed_review_only", cachedAt: tenYears });
    const decision = permitsIssuance(s, 12, [12], tenYears);
    expect(decision.permitted).toBe(false);
    expect(decision.code).toBe("lapsed_review_only");
    // And review is open the whole time — v3-D16's never-hostage rule.
    expect(permitsReview().permitted).toBe(true);
  });

  it("a lapsed learner is denied identically at day 1 and at year 10 (no timer)", () => {
    // v3-D54 pinned: there is no 7-day hard stop and no elapsed-time branch.
    const day1 = NOW + 24 * 3600 * 1000;
    const year10 = NOW + 10 * 365 * 24 * 3600 * 1000;

    const a = permitsIssuance(snap({ state: "lapsed_review_only", cachedAt: day1 }), 12, [12], day1);
    const b = permitsIssuance(snap({ state: "lapsed_review_only", cachedAt: year10 }), 12, [12], year10);

    expect(a).toEqual(b);
  });
});

describe("THE OFFLINE TTL IS A STALENESS BOUND, NOT A KILL SWITCH", () => {
  // This is the block that matters most. An expired cache must never lock a
  // learner out of content they already own — v3-D07's one ethical obligation.
  const expired = snap({ state: "active", cachedAt: NOW - OFFLINE_TTL_MS - 1 });

  it("keeps OWNED content open when the cache has expired", () => {
    const decision = permitsIssuance(expired, 12, [12, 103], NOW);
    expect(decision.permitted).toBe(true);
    expect(decision.reason).toContain("already owned");
  });

  it("only defers NEW locked content when the cache has expired", () => {
    const decision = permitsIssuance(expired, 999, [12, 103], NOW);
    expect(decision.permitted).toBe(false);
    expect(decision.code).toBe("cache_stale");
  });

  it("permits issuance with NO cached snapshot at all (a fresh offline device)", () => {
    // Denying here would lock out a paying learner whose first action is offline.
    expect(permitsIssuance(null, 12, [], NOW).permitted).toBe(true);
  });
});
