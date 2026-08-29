<?php

namespace App\Billing;

use App\Models\Entitlement;

/**
 * Build-plan step 23. THE PAYWALL BOUNDARY.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THIS CLASS MAY BE CALLED FROM EXACTLY THREE PLACES:
 *   1. Session assembly  (issuance only — edge cases #96, #123)
 *   2. Corpus delivery   (the entitlement-gated route for non-trial surahs)
 *   3. Checkout
 *
 * IT MAY NEVER BE CALLED FROM THE INGESTION PATH. Edge case #124: "Events for an
 * out-of-entitlement surah → ALWAYS ACCEPT — log is truth; enforcement at
 * issuance/corpus only."
 *
 * A paywall that drops evidence is the worst failure mode in this product. The
 * dropped events do not error, do not retry, and do not appear anywhere — the
 * learner's memory graph is simply, permanently, quietly wrong.
 *
 * This is enforced STATICALLY, not by this comment (v3-D55):
 *   - apps/web/scripts/check-boundaries.mjs clause 9
 *   - tests/Feature/Boundaries/EntitlementBoundaryTest.php
 * Both name EventsController.php as forbidden. Both are mutation-tested in both
 * directions.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ISSUANCE-ONLY, restated because it is the second-most-likely thing to get wrong
 * (#96 "paywall expiring mid-session", #123 "trial expires mid-session"): the
 * check runs ONCE, when a session is created. A session already issued runs to
 * completion regardless of what happens to the entitlement mid-drill. There is no
 * per-question re-check, and adding one would interrupt a learner mid-ayah.
 */
class PaywallGate
{
    /**
     * May this user be ISSUED a session for this surah, right now?
     *
     * @param  int[]  $compiledSurahs  every surah the product can currently serve
     */
    public function permitsIssuance(?Entitlement $entitlement, int $surah, array $compiledSurahs, int $now): PaywallDecision
    {
        // No entitlement row at all — a brand new learner. The trial has not been
        // consumed yet, so the first surah they choose is theirs.
        if (! $entitlement) {
            return PaywallDecision::allow('no entitlement row yet — trial not started');
        }

        $state = $entitlement->state;

        // Active/grace: everything compiled is open.
        if ($state === EntitlementState::Active || $state === EntitlementState::Grace) {
            return PaywallDecision::allow("state={$state->value}");
        }

        if ($state === EntitlementState::Trial) {
            // ---- v3-D07's OTHER HALF: "one surah, OR 14 days" ----
            // Only the surah half was checked here until this fix. A trial that
            // has genuinely STARTED (`trial_started_at` is stamped once, by
            // `TrialAttribution::apply()`, the moment a surah is actually chosen)
            // also ends once `config('pricing.trial.days')` have elapsed, even
            // for its own trial surah. A trial that has NOT started
            // (`trial_started_at === null`) has no clock to compare against —
            // the `trial_surah === null` branch below already keeps every surah
            // open in that case, regardless of `$now`.
            if ($entitlement->trial_started_at !== null) {
                $limitMs = (int) config('pricing.trial.days') * 24 * 60 * 60 * 1000;
                if ($now - $entitlement->trial_started_at >= $limitMs) {
                    return PaywallDecision::deny(
                        'trial_expired',
                        sprintf('the %d-day trial window has elapsed (v3-D07)', config('pricing.trial.days')),
                    );
                }
            }

            // The trial surah itself is always open (within the day window).
            if ($entitlement->trial_surah === null || $entitlement->trial_surah === $surah) {
                return PaywallDecision::allow('trial surah');
            }

            // ---- EDGE CASE #106, the degenerate case ----
            // "Trial='one surah' when one surah is the product → degenerate
            // paywall." If only ONE surah is compiled and it is the trial surah,
            // the paywall has nothing left to gate and the product is free
            // forever by accident. We do NOT paper over that by allowing the
            // request — we DENY, so the gate still gates, and the honest signal
            // (there is nothing to sell) surfaces in tests and in the admin
            // console rather than in a revenue report six months later.
            return PaywallDecision::deny(
                'trial_surah_exhausted',
                count($compiledSurahs) <= 1
                    ? 'trial surah is the only compiled surah (#106 degenerate case)'
                    : 'this surah is outside the trial',
            );
        }

        // ---- v3-D16 / v3-D54: LAPSED IS REVIEW-ONLY, INDEFINITELY ----
        // New content is denied. Review is NEVER denied — see permitsReview()
        // below, which has no time component at all. There is deliberately no
        // "lapsed more than N days" branch here, and the entitlements table has no
        // column that could support one.
        return PaywallDecision::deny('lapsed_review_only', 'review stays open; new content requires payment');
    }

    /**
     * May this user REVIEW already-encoded material?
     *
     * ALWAYS YES. Every state, every tier, every elapsed duration, forever.
     *
     * v3-D16: "Never delete, never hard-stop. A refund costs less than betraying
     * someone's memorization history. Charge for ACCESS, never for the memory
     * itself."
     *
     * v3-D54 resolved the conflicting WIREFRAME "7 days" prose in favour of this.
     * The method takes no `$now` ON PURPOSE — there is no timestamp it could
     * legitimately compare, and a signature without a clock cannot grow an expiry.
     */
    public function permitsReview(?Entitlement $entitlement): PaywallDecision
    {
        return PaywallDecision::allow('review is never gated (v3-D16)');
    }
}
