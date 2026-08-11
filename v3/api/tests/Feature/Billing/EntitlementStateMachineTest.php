<?php

namespace Tests\Feature\Billing;

use App\Billing\EntitlementMachine;
use App\Billing\EntitlementState;
use App\Billing\EntitlementTier;
use App\Billing\WebhookHandler;
use App\Models\BillingEvent;
use App\Models\Entitlement;
use App\Models\EntitlementTransition;
use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Build-plan step 23 — the entitlement state machine, one test per row of the
 * transition table in `WebhookHandler`'s doc comment.
 *
 * Every test here names the SINGLE-TOKEN MUTATION it must survive. Each was
 * actually applied on disk and observed RED before this file was reported as
 * covering anything.
 */
class EntitlementStateMachineTest extends TestCase
{
    use RefreshDatabase;

    private function entitlement(array $attrs = []): Entitlement
    {
        $user = User::factory()->create();

        return Entitlement::create(array_merge([
            'user_id' => $user->id,
            'state' => EntitlementState::Active->value,
            'tier' => EntitlementTier::Monthly->value,
            'region' => 'MY',
            'provider' => 'stripe',
            'provider_customer_id' => 'cus_'.$user->id,
        ], $attrs));
    }

    private function handler(): WebhookHandler
    {
        return app(WebhookHandler::class);
    }

    /** A recorded-shape Stripe event. No fake SDK — a plain parsed array. */
    private function event(string $id, string $type, array $object, int $created = 1_700_000_000): array
    {
        return [
            'id' => $id,
            'type' => $type,
            'created' => $created,
            'data' => ['object' => $object],
        ];
    }

    // ───────────────────────── #117 — payment failure is GRACE ─────────────────

    /**
     * EDGE CASE #117. "invoice.payment_failed → premature lockout → grace through
     * Smart Retries; only subscription.deleted lapses."
     *
     * MUTATION: in `WebhookHandler::onPaymentFailed`, change
     * `EntitlementState::Grace` to `EntitlementState::LapsedReviewOnly`.
     * This test asserts the EXACT target state, not merely "state changed" — a
     * test asserting only that something moved survives that mutation.
     */
    public function test_payment_failed_moves_to_grace_never_lapsed(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::Active->value]);

        $this->handler()->ingest($this->event('evt_1', 'invoice.payment_failed', [
            'customer' => $e->provider_customer_id,
            'next_payment_attempt' => 1_700_086_400,
        ]));

        $e->refresh();
        $this->assertSame(EntitlementState::Grace, $e->state, 'a failed payment must go to GRACE (#117)');
        $this->assertNotSame(EntitlementState::LapsedReviewOnly, $e->state, 'a card expiring is not a decision to stop memorizing');
        $this->assertSame(1_700_086_400_000, $e->grace_until);
    }

    /**
     * EDGE CASE #117, second half: "ONLY subscription.deleted lapses."
     *
     * MUTATION: delete the `customer.subscription.deleted` arm from the match in
     * `WebhookHandler::process`.
     */
    public function test_only_subscription_deleted_lapses(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::Grace->value]);

        $this->handler()->ingest($this->event('evt_2', 'customer.subscription.deleted', [
            'customer' => $e->provider_customer_id,
        ]));

        $e->refresh();
        $this->assertSame(EntitlementState::LapsedReviewOnly, $e->state);
    }

    public function test_grace_returns_to_active_on_invoice_paid(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::Grace->value, 'grace_until' => 123]);

        $this->handler()->ingest($this->event('evt_3', 'invoice.paid', [
            'customer' => $e->provider_customer_id,
        ]));

        $e->refresh();
        $this->assertSame(EntitlementState::Active, $e->state);
        $this->assertNull($e->grace_until, 'grace_until must clear, or a later check sees a stale deadline');
    }

    // ───────────────────── #116 — partial refund is a NO-OP ────────────────────

    /**
     * EDGE CASE #116. A partial refund is a goodwill gesture, NOT a revocation.
     *
     * THIS IS THE TEST MOST LIKELY TO BE VACUOUS, so it asserts BOTH halves:
     * the state is unchanged AND no transition row was written. A test asserting
     * only the state survives a mutation that writes a spurious transition row,
     * which corrupts the reconcile diff and makes the audit trail lie.
     *
     * MUTATION: in `onRefunded`, change `if ($refunded < $amount) return null;`
     * to fall through to the lapse branch.
     */
    public function test_partial_refund_changes_nothing_and_writes_no_transition(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::Active->value, 'tier' => EntitlementTier::Lifetime->value]);
        // refresh() first: `state_version` is a DB default, so the in-memory
        // instance holds null until it is read back. Comparing against null would
        // make this assertion pass for the wrong reason.
        $e->refresh();
        $versionBefore = $e->state_version;
        $this->assertNotNull($versionBefore, 'the baseline version must be a real persisted value');
        $transitionsBefore = EntitlementTransition::where('user_id', $e->user_id)->count();

        $this->handler()->ingest($this->event('evt_4', 'charge.refunded', [
            'customer' => $e->provider_customer_id,
            'amount' => 50000,          // RM500 lifetime
            'amount_refunded' => 5000,  // RM50 goodwill
        ]));

        $e->refresh();
        $this->assertSame(EntitlementState::Active, $e->state, 'a partial refund must not revoke access');
        $this->assertSame(EntitlementTier::Lifetime, $e->tier);
        $this->assertSame($versionBefore, $e->state_version, 'no write should have occurred at all');
        $this->assertSame(
            $transitionsBefore,
            EntitlementTransition::where('user_id', $e->user_id)->count(),
            'a spurious transition row corrupts the reconcile diff (#116)',
        );
    }

    /** The other half of #116/#114: a FULL refund does lapse. */
    public function test_full_refund_lapses_to_review_only(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::Active->value, 'tier' => EntitlementTier::Lifetime->value]);

        $this->handler()->ingest($this->event('evt_5', 'charge.refunded', [
            'customer' => $e->provider_customer_id,
            'amount' => 50000,
            'amount_refunded' => 50000,
        ]));

        $e->refresh();
        $this->assertSame(EntitlementState::LapsedReviewOnly, $e->state);
    }

    // ───────────────── #114 — a refund NEVER deletes learner data ──────────────

    /**
     * EDGE CASE #114. "Lifetime refund/chargeback after months → data hostage →
     * lapsed_review_only; data never deleted."
     *
     * MUTATION: add `Event::where('user_id', $e->user_id)->delete();` to the
     * refund handler.
     *
     * This counts events AFTER the refund and asserts the EXACT pre-refund count,
     * never merely `> 0` — a partial deletion survives a `> 0` assertion.
     */
    public function test_refund_never_deletes_a_single_learner_event(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::Active->value, 'tier' => EntitlementTier::Lifetime->value]);

        for ($i = 1; $i <= 7; $i++) {
            Event::create([
                'user_id' => $e->user_id,
                'uuid' => "u{$i}",
                'type' => 'tap',
                'ts' => 1_700_000_000_000 + $i,
                'received_at' => 1_700_000_000_000 + $i,
                'surah' => 12,
                'ayah' => $i,
            ]);
        }
        $before = Event::where('user_id', $e->user_id)->count();
        $this->assertSame(7, $before);

        $this->handler()->ingest($this->event('evt_6', 'charge.refunded', [
            'customer' => $e->provider_customer_id,
            'amount' => 50000,
            'amount_refunded' => 50000,
        ]));

        $this->assertSame(
            $before,
            Event::where('user_id', $e->user_id)->count(),
            'v3-D16: a refund costs less than betraying someone memorization history',
        );
    }

    /**
     * v3-D16 / v3-D54: lapsed is review-only INDEFINITELY. Ten years later, still
     * review-only, still not deleted, still reversible.
     *
     * This pins the Q5 resolution so a future "cleanup" cron cannot quietly
     * reintroduce the WIREFRAME's stale 7-day hard stop.
     */
    public function test_lapsed_permits_review_forever_and_is_reversible(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::LapsedReviewOnly->value]);

        $this->assertTrue($e->state->permitsReview(), 'review is never gated, at any age');
        $this->assertFalse($e->state->permitsNewContent());

        // Reversible: a new checkout returns to active. Not an absorbing state.
        $this->handler()->ingest($this->event('evt_7', 'checkout.session.completed', [
            'customer' => $e->provider_customer_id,
            'mode' => 'subscription',
            'subscription' => 'sub_123',
        ]));

        $e->refresh();
        $this->assertSame(EntitlementState::Active, $e->state);
    }

    // ───────────────────── #115 — dispute won REINSTATES ───────────────────────

    /**
     * EDGE CASE #115. "Dispute WON → customer stuck lapsed → dispute.closed
     * handler reinstates."
     *
     * MUTATION: in `onDisputeClosed`, change `$status === 'won'` to
     * `$status === 'lost'`.
     */
    public function test_dispute_won_reinstates(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::LapsedReviewOnly->value]);

        $this->handler()->ingest($this->event('evt_8', 'charge.dispute.closed', [
            'customer' => $e->provider_customer_id,
            'status' => 'won',
        ]));

        $e->refresh();
        $this->assertSame(EntitlementState::Active, $e->state, 'winning a dispute must not leave the customer stuck lapsed');
    }

    public function test_dispute_lost_lapses(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::Active->value]);

        $this->handler()->ingest($this->event('evt_9', 'charge.dispute.closed', [
            'customer' => $e->provider_customer_id,
            'status' => 'lost',
        ]));

        $e->refresh();
        $this->assertSame(EntitlementState::LapsedReviewOnly, $e->state);
    }

    /** #115: do not punish before the verdict. */
    public function test_dispute_created_moves_to_grace_not_lapsed(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::Active->value]);

        $this->handler()->ingest($this->event('evt_10', 'charge.dispute.created', [
            'customer' => $e->provider_customer_id,
        ]));

        $e->refresh();
        $this->assertSame(EntitlementState::Grace, $e->state);
    }

    // ─────────────────── #118 — duplicates and out-of-order ────────────────────

    /**
     * EDGE CASE #118, duplicate half. "provider+event-id unique."
     *
     * MUTATION: drop the `unique(['provider','provider_event_id'])` index from
     * the billing_events migration.
     *
     * Replays the SAME event twice; asserts exactly ONE transition row.
     */
    public function test_duplicate_event_applies_exactly_once(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::Active->value]);
        $evt = $this->event('evt_dup', 'invoice.payment_failed', [
            'customer' => $e->provider_customer_id,
        ]);

        $first = $this->handler()->ingest($evt);
        $second = $this->handler()->ingest($evt);

        $this->assertSame('applied', $first);
        $this->assertSame('ignored_duplicate', $second);
        $this->assertSame(1, EntitlementTransition::where('user_id', $e->user_id)->count());
        $this->assertSame(1, BillingEvent::where('provider_event_id', 'evt_dup')->count());
    }

    /**
     * EDGE CASE #118, ordering half. "guarded transitions, never last-write-wins."
     *
     * MUTATION: remove the `provider_created_at` precedence check from
     * `EntitlementMachine::apply`.
     *
     * Replays `subscription.deleted` (newer) and THEN `invoice.paid` (OLDER, but
     * arriving second). Final state must be LAPSED — the older event loses.
     * Under last-write-wins the learner would be silently reinstated to active.
     */
    public function test_out_of_order_event_is_ignored_never_last_write_wins(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::Active->value]);

        // Newer event arrives first.
        $this->handler()->ingest($this->event('evt_new', 'customer.subscription.deleted', [
            'customer' => $e->provider_customer_id,
        ], created: 1_700_005_000));

        // Older event arrives second.
        $outcome = $this->handler()->ingest($this->event('evt_old', 'invoice.paid', [
            'customer' => $e->provider_customer_id,
        ], created: 1_700_000_000));

        $e->refresh();
        $this->assertSame('ignored_stale', $outcome);
        $this->assertSame(
            EntitlementState::LapsedReviewOnly,
            $e->state,
            'an older event arriving later must NOT win (#118)',
        );
    }

    // ───────────────────────── #113 — the account merge ────────────────────────

    /**
     * EDGE CASE #113. "max(tier) survives; customer id moves."
     *
     * MUTATION: change `EntitlementTier::max` to return the MIN.
     */
    public function test_merge_keeps_max_tier_and_more_permissive_state(): void
    {
        $keep = $this->entitlement([
            'state' => EntitlementState::Trial->value,
            'tier' => EntitlementTier::None->value,
            'provider_customer_id' => null,
            'provider' => null,
        ]);
        $absorb = $this->entitlement([
            'state' => EntitlementState::LapsedReviewOnly->value,
            'tier' => EntitlementTier::Lifetime->value,
            'provider_customer_id' => 'cus_lifetime',
        ]);

        app(EntitlementMachine::class)->merge($keep, $absorb, 1_700_000_000_000);

        $keep->refresh();
        $this->assertSame(EntitlementTier::Lifetime, $keep->tier, 'max(tier) must survive the merge (#113)');
        $this->assertSame(EntitlementState::Trial, $keep->state, 'trial is more permissive than lapsed');
        $this->assertSame('cus_lifetime', $keep->provider_customer_id, 'the customer id moves (#113)');
    }

    /** Tier and state are ORTHOGONAL — the reason they are separate columns. */
    public function test_merge_can_keep_lifetime_tier_while_taking_trial_state(): void
    {
        $keep = $this->entitlement(['state' => EntitlementState::Trial->value, 'tier' => EntitlementTier::None->value]);
        $absorb = $this->entitlement(['state' => EntitlementState::LapsedReviewOnly->value, 'tier' => EntitlementTier::Lifetime->value]);

        app(EntitlementMachine::class)->merge($keep, $absorb, 1_700_000_000_000);

        $keep->refresh();
        $this->assertSame(EntitlementTier::Lifetime, $keep->tier);
        $this->assertSame(EntitlementState::Trial, $keep->state);
    }

    // ────────────────────── schema: all four states exist ──────────────────────

    /**
     * M7 ships: "all four in schema".
     *
     * MUTATION: delete `Grace` from the `EntitlementState` enum. This goes RED at
     * compile/first-use rather than silently at runtime months later.
     */
    public function test_all_four_states_exist_and_are_persistable(): void
    {
        $cases = array_map(fn (EntitlementState $s) => $s->value, EntitlementState::cases());
        sort($cases);
        $this->assertSame(['active', 'grace', 'lapsed_review_only', 'trial'], $cases);

        // Each must actually round-trip through the database, not merely exist as
        // a PHP constant — an enum the column rejects is not "in schema".
        foreach (EntitlementState::cases() as $state) {
            $e = $this->entitlement(['state' => $state->value]);
            $e->refresh();
            $this->assertSame($state, $e->state);
        }
    }

    /** An unhandled event type is journalled but changes nothing. */
    public function test_unhandled_event_type_is_journalled_and_ignored(): void
    {
        $e = $this->entitlement(['state' => EntitlementState::Active->value]);

        $outcome = $this->handler()->ingest($this->event('evt_x', 'customer.created', [
            'customer' => $e->provider_customer_id,
        ]));

        $e->refresh();
        $this->assertSame('ignored_unhandled', $outcome);
        $this->assertSame(EntitlementState::Active, $e->state);
        $this->assertSame(1, BillingEvent::where('provider_event_id', 'evt_x')->count(), 'the journal records everything, handled or not');
    }
}
