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

export type EntitlementTier = "none" | "monthly" | "lifetime";

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
  /** Epoch ms. When this snapshot was written locally. */
  readonly cachedAt: number;
}

/** What the gate answers. `reason` is carried so a UI can explain a denial. */
export interface EntitlementDecision {
  readonly permitted: boolean;
  readonly code: string | null;
  readonly reason: string;
}
