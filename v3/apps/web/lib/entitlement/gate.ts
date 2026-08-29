"use client";

// THE CLIENT-SIDE PAYWALL GATE — session assembly only.
//
// Mirrors `v3/api/app/Billing/PaywallGate.php`. The SERVER is authoritative; this
// exists so an offline learner gets a correct, non-punitive answer without a
// round trip.
//
// ══════════════════════════════════════════════════════════════════════════════
// CALLED AT SESSION ASSEMBLY ONLY (edge cases #96, #123).
//
// The check runs ONCE, when a session is issued. A session already in flight runs
// to completion no matter what happens to the entitlement mid-drill — a trial
// expiring between ayah 4 and ayah 5 must not interrupt the learner.
//
// AND IT IS NEVER CALLED ON THE INGESTION PATH (#124). Every tap is appended and
// synced regardless of entitlement. The log is truth.
// ══════════════════════════════════════════════════════════════════════════════

import { freshness } from "./cache";
import type { EntitlementDecision, EntitlementSnapshot } from "./types";

const allow = (reason: string): EntitlementDecision => ({ permitted: true, code: null, reason });
const deny = (code: string, reason: string): EntitlementDecision => ({ permitted: false, code, reason });

/**
 * Mirrors `config/pricing.php`'s `trial.days`. Declared independently (no
 * Next→Laravel config-sharing path exists in this codebase, same as
 * `cache.ts#OFFLINE_TTL_MS`) — `trial-config-agreement.test.ts` is what
 * actually proves the two agree, not this comment.
 */
export const TRIAL_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * May a session be ISSUED for this surah?
 *
 * @param ownedSurahs surahs this device has already unlocked/downloaded. An
 *   expired cache leaves these open — see the TTL note in `cache.ts`.
 */
export function permitsIssuance(
  snapshot: EntitlementSnapshot | null,
  surah: number,
  ownedSurahs: readonly number[],
  now: number,
): EntitlementDecision {
  const fresh = freshness(snapshot, now);

  // No snapshot at all: a new device that has never synced. Allow — the server
  // will correct at issuance time when it can. Denying here would lock out a
  // paying learner whose first action is offline.
  if (fresh === "absent" || !snapshot) {
    return allow("no cached entitlement — server is authoritative");
  }

  // A STALE cache never hard-fails. Content this device already owns stays open;
  // only NEW locked content waits for a refresh.
  if (fresh === "stale") {
    return ownedSurahs.includes(surah)
      ? allow("cache stale, but this surah is already owned — never locked out offline")
      : deny("cache_stale", "reconnect to unlock new content");
  }

  if (snapshot.state === "active" || snapshot.state === "grace") {
    return allow(`state=${snapshot.state}`);
  }

  if (snapshot.state === "trial") {
    // ---- v3-D07's OTHER HALF: "one surah, OR 14 days" ----
    // Mirrors `PaywallGate::permitsIssuance()`'s own day check. A trial that
    // has genuinely started (`trialStartedAt` is stamped once a surah is
    // actually chosen) also ends once TRIAL_DAYS_MS have elapsed, even for its
    // own trial surah. An unstarted trial (`trialStartedAt === null`) has no
    // clock to compare against.
    if (snapshot.trialStartedAt !== null && now - snapshot.trialStartedAt >= TRIAL_DAYS_MS) {
      return deny("trial_expired", "the 14-day trial window has elapsed (v3-D07)");
    }

    if (snapshot.trialSurah === null || snapshot.trialSurah === surah) {
      return allow("trial surah");
    }
    return deny("trial_surah_exhausted", "this surah is outside the trial");
  }

  // v3-D16 / v3-D54: lapsed is review-only, INDEFINITELY. New content denied,
  // review never. There is no elapsed-time branch here and there must never be.
  return deny("lapsed_review_only", "review stays open; new content requires payment");
}

/**
 * May already-encoded material be REVIEWED?
 *
 * ALWAYS YES — every state, every tier, forever. v3-D16: "Charge for access,
 * never for the memory itself."
 *
 * Takes no `now` and no surah ON PURPOSE. A signature with no clock cannot grow
 * an expiry, and a signature with no surah cannot grow a per-surah lock.
 */
export function permitsReview(): EntitlementDecision {
  return allow("review is never gated (v3-D16)");
}
