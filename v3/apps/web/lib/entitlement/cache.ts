"use client";

// OFFLINE ENTITLEMENT CACHE — TTL + grace (M7 ships: "PaywallGate at session
// assembly with offline entitlement TTL+grace").
//
// ══════════════════════════════════════════════════════════════════════════════
// THE TTL IS A STALENESS BOUND ON NEW GRANTS. IT IS NOT A KILL SWITCH.
//
// An expired cache does NOT hard-fail. It degrades LOCKED content to review-only
// while leaving trial and owned content fully open. A learner on a plane, or with
// a dead connection for a fortnight, is never locked out of material they already
// paid for because a timestamp aged out.
//
// Getting this backwards is the natural implementation — "cache expired, deny" is
// what a cache normally means — and it would take the product's single ethical
// commitment (v3-D07: "the paywall must NEVER hold a learner's memory hostage")
// and break it with a network failure.
// ══════════════════════════════════════════════════════════════════════════════

import type { EntitlementSnapshot } from "./types";

/** Mirrors `config/pricing.php`'s `offline_ttl_days`. */
export const OFFLINE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CacheFreshness = "fresh" | "stale" | "absent";

/**
 * How much to trust a cached snapshot.
 *
 * `now` is passed in, never read from the clock here — the same purity rule the
 * engine follows (INVARIANTS.md Absolute A), so this is testable without faking
 * time.
 */
export function freshness(snapshot: EntitlementSnapshot | null, now: number): CacheFreshness {
  if (!snapshot) return "absent";
  return now - snapshot.cachedAt <= OFFLINE_TTL_MS ? "fresh" : "stale";
}
