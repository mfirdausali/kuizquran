<?php

namespace App\Billing;

/**
 * The four states, closed. Build-plan M7: "trial/active/grace/lapsed_review_only
 * — all four in schema".
 *
 * v3-D16 / v3-D54: LAPSED_REVIEW_ONLY is a terminal-but-REVERSIBLE sink, never an
 * absorbing one. It never expires. There is no transition out of it to deletion,
 * and `permitsReview()` returns true for it forever. "Charge for access, never for
 * the memory itself."
 */
enum EntitlementState: string
{
    case Trial = 'trial';
    case Active = 'active';
    case Grace = 'grace';
    case LapsedReviewOnly = 'lapsed_review_only';

    /**
     * Permissiveness ladder, used by edge case #113's account-merge rule
     * ("state = the more permissive of the two"). Higher wins.
     */
    public function rank(): int
    {
        return match ($this) {
            self::LapsedReviewOnly => 0,
            self::Grace => 1,
            self::Trial => 2,
            self::Active => 3,
        };
    }

    /**
     * May this state be ISSUED new locked content? (Session assembly, corpus
     * delivery.) This is the ONLY question the paywall may ever ask.
     */
    public function permitsNewContent(): bool
    {
        return match ($this) {
            self::Active, self::Grace, self::Trial => true,
            self::LapsedReviewOnly => false,
        };
    }

    /**
     * May this state REVIEW already-encoded material?
     *
     * ALWAYS TRUE. Every state, unconditionally, forever. This method exists as a
     * single named place for the never-hostage rule (v3-D16) so that a future
     * change wanting to restrict review has to delete a method that says why it
     * cannot, rather than quietly add a condition to a boolean expression.
     */
    public function permitsReview(): bool
    {
        return true;
    }
}
