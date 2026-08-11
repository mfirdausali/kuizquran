<?php

namespace App\Billing;

use App\Models\BillingEvent;
use App\Models\Entitlement;
use Illuminate\Support\Facades\DB;

/**
 * Build-plan step 23. The full webhook set.
 *
 * v3-D56: THERE IS NO FAKE STRIPE HERE. This class takes a PARSED, ALREADY-
 * VERIFIED event array. It has no `if (testing)` branch and no injectable
 * `StripeService` seam where a stub could live. Signature verification happens at
 * the controller boundary (`StripeWebhookController`), against the real HMAC.
 * Tests drive this class with event arrays in the recorded shape.
 *
 * THE TRANSITION TABLE (each row is a test in EntitlementStateMachineTest):
 *
 *   from                event                              to                    edge case
 *   ----                -----                              --                    ---------
 *   trial               checkout.session.completed         active                —
 *   active              invoice.payment_failed             GRACE  (never lapse!) #117
 *   grace               invoice.paid                       active                #117
 *   grace               customer.subscription.deleted      lapsed_review_only    #117
 *   active              charge.refunded (FULL)             lapsed_review_only    #114 #116
 *   active              charge.refunded (PARTIAL)          UNCHANGED             #116
 *   any                 charge.dispute.created             grace                 #115
 *   lapsed              charge.dispute.closed status=won   restore prior         #115
 *   lapsed              new checkout                       active                v3-D16
 *   ANY                 nothing whatsoever                 deletion              NEVER
 */
class WebhookHandler
{
    public function __construct(private readonly EntitlementMachine $machine) {}

    /** Events we deliberately act on. Anything else is `ignored_unhandled`. */
    public const HANDLED = [
        'checkout.session.completed',
        'invoice.paid',
        'invoice.payment_failed',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'charge.refunded',
        'charge.dispute.created',
        'charge.dispute.closed',
    ];

    /**
     * Ingest one provider event: journal it, then process it.
     *
     * INSERT FIRST, THEN PROCESS (see the billing_events migration). The unique
     * index on (provider, provider_event_id) is what makes a duplicate delivery a
     * no-op — edge case #118. We do NOT check-then-insert; that races.
     */
    public function ingest(array $event, string $provider = 'stripe'): string
    {
        $eventId = $event['id'] ?? null;
        $type = $event['type'] ?? null;
        if (! is_string($eventId) || $eventId === '' || ! is_string($type)) {
            return 'error';
        }

        $now = (int) round(microtime(true) * 1000);
        // Stripe's `created` is epoch SECONDS. Ordering precedence compares this,
        // never our own arrival time — arrival order IS edge case #118.
        $providerCreatedAt = isset($event['created']) ? ((int) $event['created']) * 1000 : null;

        $inserted = BillingEvent::insertOrIgnore([
            'provider' => $provider,
            'provider_event_id' => $eventId,
            'type' => $type,
            'payload' => json_encode($event),
            'provider_created_at' => $providerCreatedAt,
            'received_at' => $now,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($inserted === 0) {
            // The row already exists. Duplicate delivery — the database refused it.
            return 'ignored_duplicate';
        }

        $row = BillingEvent::where('provider', $provider)->where('provider_event_id', $eventId)->first();

        try {
            $outcome = $this->process($event, $type, $eventId, $providerCreatedAt, $now);
        } catch (\Throwable $e) {
            $row->update(['outcome' => 'error', 'error' => $e->getMessage(), 'processed_at' => $now]);

            throw $e;
        }

        $row->update(['outcome' => $outcome, 'processed_at' => $now]);

        return $outcome;
    }

    private function process(array $event, string $type, string $eventId, ?int $providerCreatedAt, int $now): string
    {
        if (! in_array($type, self::HANDLED, true)) {
            return 'ignored_unhandled';
        }

        $entitlement = $this->resolveEntitlement($event);
        if (! $entitlement) {
            return 'ignored_unhandled';
        }

        $result = match ($type) {
            'checkout.session.completed' => $this->onCheckoutCompleted($event, $entitlement, $eventId, $providerCreatedAt, $now),
            'invoice.paid' => $this->onInvoicePaid($entitlement, $eventId, $providerCreatedAt, $now),
            'invoice.payment_failed' => $this->onPaymentFailed($event, $entitlement, $eventId, $providerCreatedAt, $now),
            'customer.subscription.updated' => $this->onSubscriptionUpdated($event, $entitlement, $eventId, $providerCreatedAt, $now),
            'customer.subscription.deleted' => $this->onSubscriptionDeleted($entitlement, $eventId, $providerCreatedAt, $now),
            'charge.refunded' => $this->onRefunded($event, $entitlement, $eventId, $providerCreatedAt, $now),
            'charge.dispute.created' => $this->onDisputeCreated($entitlement, $eventId, $providerCreatedAt, $now),
            'charge.dispute.closed' => $this->onDisputeClosed($event, $entitlement, $eventId, $providerCreatedAt, $now),
        };

        return $result === null ? 'ignored_unhandled' : ($result->wasApplied() ? 'applied' : $result->outcome);
    }

    /** Resolve by provider customer id — the only stable join Stripe gives us. */
    private function resolveEntitlement(array $event): ?Entitlement
    {
        $obj = $event['data']['object'] ?? [];
        $customer = $obj['customer'] ?? null;
        if (! is_string($customer) || $customer === '') {
            return null;
        }

        return Entitlement::where('provider_customer_id', $customer)->first();
    }

    // ---- handlers, one per transition-table row ----

    private function onCheckoutCompleted(array $event, Entitlement $e, string $id, ?int $createdAt, int $now): TransitionResult
    {
        $obj = $event['data']['object'] ?? [];
        $mode = $obj['mode'] ?? 'subscription';

        // v3-D16: a new checkout from `lapsed_review_only` returns to `active`.
        // Lapsed is REVERSIBLE — that is the whole point of it not being absorbing.
        $tier = $mode === 'payment' ? EntitlementTier::Lifetime : EntitlementTier::Monthly;

        $changes = [
            'state' => EntitlementState::Active,
            'tier' => EntitlementTier::max($e->tier, $tier),
            'grace_until' => null,
        ];
        if (isset($obj['subscription']) && is_string($obj['subscription'])) {
            $changes['provider_subscription_id'] = $obj['subscription'];
        }

        return $this->machine->apply($e, $changes, EntitlementMachine::CAUSE_WEBHOOK, $now, $id, 'system', null, $createdAt);
    }

    private function onInvoicePaid(Entitlement $e, string $id, ?int $createdAt, int $now): TransitionResult
    {
        // #117: grace -> active on a successful retry.
        return $this->machine->apply($e, [
            'state' => EntitlementState::Active,
            'grace_until' => null,
        ], EntitlementMachine::CAUSE_WEBHOOK, $now, $id, 'system', null, $createdAt);
    }

    private function onPaymentFailed(array $event, Entitlement $e, string $id, ?int $createdAt, int $now): TransitionResult
    {
        // ---- EDGE CASE #117, THE ONE MOST LIKELY TO BE GOT WRONG ----
        // A failed payment moves to GRACE, never to lapsed. Stripe Smart Retries
        // will attempt the card again over several days; locking the learner out
        // on the first failure is "premature lockout" — a card that expired on a
        // Tuesday is not a decision to stop memorizing.
        //
        // ONLY `customer.subscription.deleted` lapses. If you are reading this
        // because you want to lapse here, re-read #117 first.
        $obj = $event['data']['object'] ?? [];
        $graceUntil = isset($obj['next_payment_attempt']) && is_numeric($obj['next_payment_attempt'])
            ? ((int) $obj['next_payment_attempt']) * 1000
            : null;

        return $this->machine->apply($e, [
            'state' => EntitlementState::Grace,
            'grace_until' => $graceUntil,
        ], EntitlementMachine::CAUSE_WEBHOOK, $now, $id, 'system', null, $createdAt);
    }

    private function onSubscriptionUpdated(array $event, Entitlement $e, string $id, ?int $createdAt, int $now): ?TransitionResult
    {
        $obj = $event['data']['object'] ?? [];
        $status = $obj['status'] ?? null;

        $changes = [];
        if (isset($obj['current_period_end']) && is_numeric($obj['current_period_end'])) {
            $changes['current_period_end'] = ((int) $obj['current_period_end']) * 1000;
        }

        // `past_due`/`unpaid` are grace, not lapse — same reasoning as #117.
        if (in_array($status, ['past_due', 'unpaid'], true)) {
            $changes['state'] = EntitlementState::Grace;
        } elseif ($status === 'active') {
            $changes['state'] = EntitlementState::Active;
            $changes['grace_until'] = null;
        }

        if ($changes === []) {
            return null;
        }

        return $this->machine->apply($e, $changes, EntitlementMachine::CAUSE_WEBHOOK, $now, $id, 'system', null, $createdAt);
    }

    private function onSubscriptionDeleted(Entitlement $e, string $id, ?int $createdAt, int $now): TransitionResult
    {
        // #117: this — and ONLY this — lapses a subscription.
        // v3-D16: lapsing is review-only and INDEFINITE. Nothing is deleted,
        // nothing is scheduled for deletion, no TTL is set. See the entitlements
        // migration: there is no column here to expire.
        return $this->machine->apply($e, [
            'state' => EntitlementState::LapsedReviewOnly,
            'grace_until' => null,
        ], EntitlementMachine::CAUSE_WEBHOOK, $now, $id, 'system', null, $createdAt);
    }

    private function onRefunded(array $event, Entitlement $e, string $id, ?int $createdAt, int $now): ?TransitionResult
    {
        $obj = $event['data']['object'] ?? [];
        $amount = (int) ($obj['amount'] ?? 0);
        $refunded = (int) ($obj['amount_refunded'] ?? 0);

        // ---- EDGE CASE #116: A PARTIAL REFUND IS NOT A REVOCATION ----
        // Returning RM50 of an RM500 lifetime purchase is a goodwill gesture, not
        // a cancellation. It must leave state UNTOUCHED and must write NO
        // transition row — a spurious row would corrupt the reconcile diff and
        // make the audit trail lie about what happened.
        if ($refunded < $amount) {
            return null;
        }

        // Full refund. #114: -> lapsed_review_only. The learner's events, atoms and
        // history are NOT touched. "A refund costs less than betraying someone's
        // memorization history" (v3-D16).
        return $this->machine->apply($e, [
            'state' => EntitlementState::LapsedReviewOnly,
        ], EntitlementMachine::CAUSE_WEBHOOK, $now, $id, 'system', null, $createdAt);
    }

    private function onDisputeCreated(Entitlement $e, string $id, ?int $createdAt, int $now): TransitionResult
    {
        // #115: do NOT punish before the verdict. A dispute is an accusation, and
        // the bank may well find for the customer. Grace, not lapse.
        return $this->machine->apply($e, [
            'state' => EntitlementState::Grace,
        ], EntitlementMachine::CAUSE_WEBHOOK, $now, $id, 'system', null, $createdAt);
    }

    private function onDisputeClosed(array $event, Entitlement $e, string $id, ?int $createdAt, int $now): TransitionResult
    {
        $obj = $event['data']['object'] ?? [];
        $status = $obj['status'] ?? null;

        // #115: DISPUTE WON -> REINSTATE. Without this handler the customer is
        // "stuck lapsed" after winning, which is the exact failure the edge case
        // names. Won means the charge stands, so the entitlement stands.
        if ($status === 'won') {
            return $this->machine->apply($e, [
                'state' => EntitlementState::Active,
            ], EntitlementMachine::CAUSE_WEBHOOK, $now, $id, 'system', null, $createdAt);
        }

        // Lost / warning_closed: the money is gone, so access lapses — review-only,
        // indefinitely, data intact.
        return $this->machine->apply($e, [
            'state' => EntitlementState::LapsedReviewOnly,
        ], EntitlementMachine::CAUSE_WEBHOOK, $now, $id, 'system', null, $createdAt);
    }
}
