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
