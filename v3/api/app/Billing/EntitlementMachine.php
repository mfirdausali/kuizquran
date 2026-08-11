<?php

namespace App\Billing;

use App\Models\Entitlement;
use App\Models\EntitlementTransition;
use Illuminate\Support\Facades\DB;

/**
 * Build-plan step 23. The entitlement state machine.
 *
 * Every state change in the system goes through `apply()`. There is no other
 * writer of `entitlements.state` — that is what makes the transition log complete,
 * and a complete log is what makes edge case #114's "data never deleted" provable
 * rather than asserted.
 *
 * TWO GUARDS, both required by edge case #118 ("webhooks out-of-order/duplicated
 * → guarded transitions, never last-write-wins"):
 *
 *  1. OPTIMISTIC LOCK on `state_version`. Two concurrent writers cannot both win.
 *  2. ORDERING PRECEDENCE on the provider's own `created` timestamp. An event
 *     OLDER than the last one applied is ignored outright.
 *
 * Guard 1 alone is insufficient and this is the subtle part: two out-of-order
 * webhooks arriving sequentially both read the same version, both pass the lock,
 * and the LATER-ARRIVING-BUT-OLDER one wins. That is last-write-wins wearing an
 * optimistic lock as a costume. Guard 2 is what actually orders them.
 */
class EntitlementMachine
{
    public const CAUSE_WEBHOOK = 'webhook';

    public const CAUSE_TRIAL_START = 'trial_start';

    public const CAUSE_RECONCILE = 'reconcile';

    public const CAUSE_ADMIN_OVERRIDE = 'admin_override';

    /**
     * Apply a state change, guarded. Returns the applied outcome.
     *
     * @param  array{
     *   state?: EntitlementState,
     *   tier?: EntitlementTier,
     *   region?: string,
     *   current_period_end?: int|null,
     *   grace_until?: int|null,
     *   provider?: string|null,
     *   provider_customer_id?: string|null,
     *   provider_subscription_id?: string|null,
     * }  $changes
     */
    public function apply(
        Entitlement $entitlement,
        array $changes,
        string $cause,
        int $at,
        ?string $providerEventId = null,
        string $actor = 'system',
        ?string $reason = null,
        ?int $providerCreatedAt = null,
    ): TransitionResult {
        return DB::transaction(function () use (
            $entitlement, $changes, $cause, $at, $providerEventId, $actor, $reason, $providerCreatedAt
        ) {
            // Re-read INSIDE the transaction. The caller's instance may be stale.
            $fresh = Entitlement::query()->lockForUpdate()->find($entitlement->id);
            if (! $fresh) {
                return TransitionResult::ignoredStale('entitlement row vanished');
            }

            // --- Guard 2: ordering precedence (edge case #118). ---
            // Strictly-older provider events are refused. Equal timestamps are
            // allowed through, because Stripe can emit several events in the same
            // millisecond and refusing ties would drop legitimate work.
            if (
                $providerCreatedAt !== null
                && $fresh->last_provider_event_at !== null
                && $providerCreatedAt < $fresh->last_provider_event_at
            ) {
                return TransitionResult::ignoredStale(
                    "provider event at {$providerCreatedAt} is older than the last applied at {$fresh->last_provider_event_at}",
                );
            }

            $fromState = $fresh->state;
            $toState = $changes['state'] ?? $fromState;
            $expectedVersion = $fresh->state_version;

            $update = [];
            foreach (['state', 'tier'] as $enumField) {
                if (array_key_exists($enumField, $changes)) {
                    $update[$enumField] = $changes[$enumField]->value;
                }
            }
            foreach ([
                'region', 'current_period_end', 'grace_until', 'trial_surah',
                'trial_surah_source', 'trial_started_at',
                'provider', 'provider_customer_id', 'provider_subscription_id',
            ] as $plainField) {
                if (array_key_exists($plainField, $changes)) {
                    $update[$plainField] = $changes[$plainField];
                }
            }

            $update['state_version'] = $expectedVersion + 1;
            if ($providerCreatedAt !== null) {
                $update['last_provider_event_at'] = $providerCreatedAt;
            }
            $update['updated_at'] = now();

            // --- Guard 1: optimistic lock (edge case #118). ---
            $affected = Entitlement::where('id', $fresh->id)
                ->where('state_version', $expectedVersion)
                ->update($update);

            if ($affected === 0) {
                return TransitionResult::conflict();
            }

            // The transition row and the state change are ONE transaction. A
            // state change without its log row would make the log incomplete,
            // and an incomplete log cannot prove #114.
            EntitlementTransition::create([
                'user_id' => $fresh->user_id,
                'from_state' => $fromState->value,
                'to_state' => $toState->value,
                'cause' => $cause,
                'provider_event_id' => $providerEventId,
                'actor' => $actor,
                'reason' => $reason,
                'at' => $at,
            ]);

            return TransitionResult::applied($fromState, $toState);
        });
    }

    /**
     * Edge case #113: anonymous lifetime buyer adopts an existing account.
     *
     * "max(tier) survives; email captured at checkout; customer id moves."
     *
     * Tier takes the MAX; state takes the MORE PERMISSIVE. Both are needed
     * separately — a lifetime buyer in `lapsed_review_only` (refunded, then
     * re-bought) merging into a `trial` account must keep the lifetime TIER while
     * taking the trial STATE, and a single combined ladder cannot express that.
     */
    public function merge(Entitlement $keep, Entitlement $absorb, int $at, string $actor = 'system'): TransitionResult
    {
        $tier = EntitlementTier::max($keep->tier, $absorb->tier);
        $state = $keep->state->rank() >= $absorb->state->rank() ? $keep->state : $absorb->state;

        $changes = ['state' => $state, 'tier' => $tier];

        // The customer id MOVES — it follows whichever side actually has one.
        // Conflict resolution: prefer the side carrying the higher tier (that is
        // the side with the lifetime charge attached), and both are logged.
        $keepHasCustomer = $keep->provider_customer_id !== null;
        $absorbHasCustomer = $absorb->provider_customer_id !== null;
        $reason = null;

        if ($absorbHasCustomer && ! $keepHasCustomer) {
            $changes['provider'] = $absorb->provider;
            $changes['provider_customer_id'] = $absorb->provider_customer_id;
            $changes['provider_subscription_id'] = $absorb->provider_subscription_id;
        } elseif ($absorbHasCustomer && $keepHasCustomer) {
            $absorbWins = $absorb->tier->rank() > $keep->tier->rank();
            if ($absorbWins) {
                $changes['provider'] = $absorb->provider;
                $changes['provider_customer_id'] = $absorb->provider_customer_id;
                $changes['provider_subscription_id'] = $absorb->provider_subscription_id;
            }
            $reason = sprintf(
                'merge customer-id conflict: kept=%s (tier %s), absorbed=%s (tier %s), winner=%s',
                $keep->provider_customer_id,
                $keep->tier->value,
                $absorb->provider_customer_id,
                $absorb->tier->value,
                $absorbWins ? 'absorbed' : 'kept',
            );
        }

        // Trial attribution survives the merge: edge case #112's "trial = earliest
        // by canonical order (no double trial)".
        $keepStart = $keep->trial_started_at;
        $absorbStart = $absorb->trial_started_at;
        if ($absorbStart !== null && ($keepStart === null || $absorbStart < $keepStart)) {
            $changes['trial_started_at'] = $absorbStart;
            $changes['trial_surah'] = $absorb->trial_surah;
            $changes['trial_surah_source'] = $absorb->trial_surah_source;
        }

        return $this->apply($keep, $changes, self::CAUSE_RECONCILE, $at, null, $actor, $reason);
    }
}
