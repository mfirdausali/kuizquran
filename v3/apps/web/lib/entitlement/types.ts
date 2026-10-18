// THE ENTITLEMENT ISLAND — types.
//
// This module and its two siblings (`cache.ts`, `gate.ts`) are the ONLY files in
// this app permitted to know what an entitlement is. `check-boundaries.mjs`
// clause 9 enforces that by name, and specifically forbids `lib/idb/append.ts`,
// `lib/sync/outbox.ts`, `lib/sync/merge.ts` and `lib/sync/pull.ts` from
// mentioning it.
//
// WHY THAT LIST: edge case #124 — "Events for an out-of-entitlement surah →
// ALWAYS ACCEPT — log is truth; enforcement at issuance/corpus only." Those four
// files ARE the ingestion path. A paywall check in any of them silently drops
// evidence, and the loss is unrecoverable: no error, no retry, no trace.

/** The four states, mirroring the server enum exactly (see app/Billing). */
export type EntitlementState = "trial" | "active" | "grace" | "lapsed_review_only";

/**
 * Runtime mirror of `EntitlementState` above, so a caller that needs an
 * actual array (a validator, a dropdown) has ONE declaration to import
 * instead of re-typing the literal — `lib/entitlement/sync.ts`'s own
 * `fetchEntitlementSnapshot()` validator is the one real caller this was
 * built for. `entitlement-enum-agreement.test.ts` is what proves this
 * agrees with the server's own `App\Billing\EntitlementState` enum; this
 * comment does not.
 */
export const ENTITLEMENT_STATES: readonly EntitlementState[] = ["trial", "active", "grace", "lapsed_review_only"];

export type EntitlementTier = "none" | "monthly" | "lifetime";

/** Runtime mirror of `EntitlementTier` above — see `ENTITLEMENT_STATES`'s
 *  own comment; the same reasoning, one type over. */
export const ENTITLEMENT_TIERS: readonly EntitlementTier[] = ["none", "monthly", "lifetime"];

/** v3-D07: region is account-stored and editable. IP only sets the default. */
export type Region = "MY" | "INTL";

export interface EntitlementSnapshot {
  readonly state: EntitlementState;
  readonly tier: EntitlementTier;
  readonly region: Region;
  /** Edge case #121/#122: the surah that consumed the trial, if any. */
  readonly trialSurah: number | null;
  /**
   * Epoch ms. When `TrialAttribution::apply()` first stamped the trial (i.e.
   * when the learner actually chose a surah) — null if the trial has not
   * started yet. v3-D07's "OR 14 days" half needs this to compare against.
   */
  readonly trialStartedAt: number | null;
  /**
   * Epoch ms. `WebhookHandler::onSubscriptionUpdated`'s `current_period_end`
   * — when a MONTHLY subscription next renews. Null for `tier: "lifetime"`
   * (a one-time purchase never renews) and for any learner not yet on a
   * paid subscription.
   */
  readonly currentPeriodEnd: number | null;
  /**
   * Epoch ms. `WebhookHandler::onPaymentFailed`'s `next_payment_attempt` —
   * when Stripe will next retry a failed charge. Null outside `state:
   * "grace"` (and for a grace row not caused by a payment-failure webhook).
   */
  readonly graceUntil: number | null;
  /** Epoch ms. When this snapshot was written locally. */
  readonly cachedAt: number;
}

/** What the gate answers. `reason` is carried so a UI can explain a denial. */
export interface EntitlementDecision {
  readonly permitted: boolean;
  readonly code: string | null;
  readonly reason: string;
}
