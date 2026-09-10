// `buildPlanSummary` — the pure half of the /settings plan display (see this
// module's own header for why it exists: `readEntitlementSnapshot`/
// `refreshEntitlementSnapshot` have had zero renderers since v3-D88/v3-D89).

import { describe, expect, it } from "vitest";
import { buildPlanSummary } from "./planSummary";
import type { EntitlementSnapshot } from "@/lib/entitlement/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function snapshot(overrides: Partial<EntitlementSnapshot>): EntitlementSnapshot {
  return {
    state: "trial",
    tier: "none",
    region: "MY",
    trialSurah: null,
    trialStartedAt: null,
    currentPeriodEnd: null,
    graceUntil: null,
    cachedAt: NOW,
    ...overrides,
  };
}

describe("buildPlanSummary", () => {
  it("carries state/tier/region through verbatim", () => {
    const summary = buildPlanSummary(snapshot({ state: "active", tier: "lifetime", region: "INTL" }), NOW);
    expect(summary.state).toBe("active");
    expect(summary.tier).toBe("lifetime");
    expect(summary.region).toBe("INTL");
    expect(summary.tierLabel).toBe("lifetime");
  });

  it("a trial that has not started yet reads honestly, not as a day count", () => {
    const summary = buildPlanSummary(snapshot({ state: "trial", trialStartedAt: null }), NOW);
    expect(summary.stateSentence).toMatch(/hasn't started yet/);
  });

  it("a trial 3 days in reports 11 days left (14-day window)", () => {
    const summary = buildPlanSummary(
      snapshot({ state: "trial", trialStartedAt: NOW - 3 * DAY_MS }),
      NOW,
    );
    expect(summary.stateSentence).toMatch(/11 days left/);
  });

  it("a trial in its last day says 'less than a day left', not '1 days'", () => {
    const summary = buildPlanSummary(
      snapshot({ state: "trial", trialStartedAt: NOW - (14 * DAY_MS - 60_000) }),
      NOW,
    );
    expect(summary.stateSentence).toBe("You're on a free trial: less than a day left.");
  });

  it("a trial past 14 days reports ended, never a negative day count", () => {
    const summary = buildPlanSummary(
      snapshot({ state: "trial", trialStartedAt: NOW - 20 * DAY_MS }),
      NOW,
    );
    expect(summary.stateSentence).toBe("Your free trial has ended.");
  });

  it("active never mentions the trial clock", () => {
    const summary = buildPlanSummary(snapshot({ state: "active" }), NOW);
    expect(summary.stateSentence).not.toMatch(/trial/i);
  });

  it("grace explains itself without alarm and says review stays open", () => {
    const summary = buildPlanSummary(snapshot({ state: "grace" }), NOW);
    expect(summary.stateSentence).toMatch(/grace period/);
    expect(summary.stateSentence).toMatch(/review.*stays open/i);
  });

  // `grace_until` (`WebhookHandler::onPaymentFailed`'s `next_payment_attempt`)
  // is genuinely written by the real webhook handler but, before this fix,
  // never reached this sentence — a learner in grace could not tell WHEN the
  // next retry was expected. Absent when the server has not recorded one yet
  // (e.g. a grace row seeded by something other than a payment-failure
  // webhook) — never a fabricated date.
  it("grace names the next payment attempt when the server has recorded one", () => {
    const withDate = buildPlanSummary(
      snapshot({ state: "grace", graceUntil: 1_700_600_000_000 }),
      NOW,
    );
    expect(withDate.stateSentence).toContain(new Date(1_700_600_000_000).toISOString());

    const withoutDate = buildPlanSummary(snapshot({ state: "grace", graceUntil: null }), NOW);
    expect(withoutDate.stateSentence).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  // `current_period_end` (`WebhookHandler::onSubscriptionUpdated`) is only
  // ever set for a real subscription (never a one-time lifetime purchase —
  // `checkout.session.completed`'s `mode: "payment"` branch never touches
  // it), so an active LIFETIME learner must see no renewal date at all.
  it("active names the renewal date for a subscription, never for a lifetime purchase", () => {
    const monthly = buildPlanSummary(
      snapshot({ state: "active", tier: "monthly", currentPeriodEnd: 1_700_800_000_000 }),
      NOW,
    );
    expect(monthly.stateSentence).toContain(new Date(1_700_800_000_000).toISOString());

    const lifetime = buildPlanSummary(
      snapshot({ state: "active", tier: "lifetime", currentPeriodEnd: null }),
      NOW,
    );
    expect(lifetime.stateSentence).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("lapsed_review_only says review stays open forever, new content needs renewal", () => {
    const summary = buildPlanSummary(snapshot({ state: "lapsed_review_only" }), NOW);
    expect(summary.stateSentence).toMatch(/review.*stays open forever/i);
    expect(summary.stateSentence).toMatch(/renewal/);
  });

  it("tier 'none' reads as 'no plan yet', never the bare wire literal", () => {
    const summary = buildPlanSummary(snapshot({ tier: "none" }), NOW);
    expect(summary.tierLabel).toBe("no plan yet");
  });
});
