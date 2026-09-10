// THE LEARNER-FACING PLAN SUMMARY — turns a raw `EntitlementSnapshot` into
// human sentences for `/settings`.
//
// `lib/entitlement/sync.ts#readEntitlementSnapshot`/`refreshEntitlementSnapshot`
// have existed since v3-D88/v3-D89, and `components/session/SessionIsland.tsx`'s
// mount effect has kept the snapshot fresh in IndexedDB since the entry right
// after v3-D89 — but nothing under `apps/web` ever RENDERED it. A learner
// thirteen days into a fourteen-day trial, or one who has already paid for
// lifetime access, had no way to see that anywhere in the product: only an
// ADMIN screen (`/settings/billing`) shows entitlement data, and only for
// looking up other users. This module is the pure half of the fix — the
// component only prints what this computes, the same split `rows.ts`/
// `growth.ts`/`frontier.ts` already established.
//
// DISPLAY ONLY. This never decides whether anything is PERMITTED — that stays
// `lib/entitlement/gate.ts#permitsIssuance`/`permitsReview`, an open product
// question this file does not touch (DECISIONS.md v3-D88/v3-D151). `TRIAL_DAYS_MS`
// is imported from `gate.ts` rather than re-declared a third time — a second
// copy of that constant would only recreate the exact "wiring/drift" gap this
// module exists to close.

import { TRIAL_DAYS_MS } from "@/lib/entitlement/gate";
import type { EntitlementSnapshot, EntitlementState, EntitlementTier, Region } from "@/lib/entitlement/types";

export interface PlanSummary {
  readonly state: EntitlementState;
  readonly tier: EntitlementTier;
  readonly region: Region;
  /** A single honest sentence describing the current state — never a bare
   *  enum value; §15's rule against colour/shape-only signalling extended to
   *  plain data-dump wire literals shown verbatim to a learner. */
  readonly stateSentence: string;
  readonly tierLabel: string;
}

const TIER_LABELS: Readonly<Record<EntitlementTier, string>> = {
  none: "no plan yet",
  monthly: "monthly",
  lifetime: "lifetime",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function trialSentence(snapshot: EntitlementSnapshot, now: number): string {
  if (snapshot.trialStartedAt === null) {
    return "Your free trial hasn't started yet — it begins the moment you choose your first surah.";
  }
  const remainingMs = TRIAL_DAYS_MS - (now - snapshot.trialStartedAt);
  if (remainingMs <= 0) {
    return "Your free trial has ended.";
  }
  const daysLeft = Math.ceil(remainingMs / DAY_MS);
  return daysLeft === 1
    ? "You're on a free trial: less than a day left."
    : `You're on a free trial: ${daysLeft} days left.`;
}

/** Pure. `now` is passed in — same purity discipline the engine itself
 *  follows (INVARIANTS.md Absolute A), applied here because a trial's
 *  remaining-days sentence is itself a function of the clock. */
export function buildPlanSummary(snapshot: EntitlementSnapshot, now: number): PlanSummary {
  const stateSentence: string = (() => {
    switch (snapshot.state) {
      case "active": {
        const base = "Your plan is active.";
        // `currentPeriodEnd` is null for a lifetime purchase (nothing to
        // renew) and for any learner not yet on a paid subscription — the
        // renewal clause only ever appears when the server has a real date.
        return snapshot.currentPeriodEnd === null
          ? base
          : `${base} Renews ${new Date(snapshot.currentPeriodEnd).toISOString()}.`;
      }
      case "grace": {
        const base =
          "There was an issue with your last payment — you're in a short grace period. Review of everything you've learned stays open either way.";
        // `graceUntil` is null when the server has not recorded a next
        // payment attempt (a grace row not caused by a payment-failure
        // webhook) — never a fabricated date.
        return snapshot.graceUntil === null
          ? base
          : `${base} The next payment attempt is expected ${new Date(snapshot.graceUntil).toISOString()}.`;
      }
      case "lapsed_review_only":
        return "Your plan has lapsed. Review of everything you've already learned stays open forever — new content needs a renewal.";
      case "trial":
        return trialSentence(snapshot, now);
    }
  })();

  return {
    state: snapshot.state,
    tier: snapshot.tier,
    region: snapshot.region,
    stateSentence,
    tierLabel: TIER_LABELS[snapshot.tier],
  };
}
