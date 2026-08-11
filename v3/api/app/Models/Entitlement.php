<?php

namespace App\Models;

use App\Billing\EntitlementState;
use App\Billing\EntitlementTier;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The DERIVED current entitlement. `entitlement_transitions` is the log.
 *
 * NOTE FOR ANY FUTURE READER: this class is on the entitlement-read ALLOWLIST
 * (v3-D55). If you find yourself wanting to reference it from the ingestion path,
 * the fold-runner, or the atom cache, STOP — edge case #124 says the log is truth
 * and enforcement lives at issuance/corpus only. Both `check-boundaries.mjs`
 * clause 9 and `EntitlementBoundaryTest` will fail the build.
 */
class Entitlement extends Model
{
    protected $fillable = [
        'user_id', 'state', 'tier', 'region',
        'trial_surah', 'trial_surah_source', 'trial_started_at',
        'current_period_end', 'grace_until',
        'provider', 'provider_customer_id', 'provider_subscription_id',
        'state_version', 'last_provider_event_at',
    ];

    protected function casts(): array
    {
        return [
            'state' => EntitlementState::class,
            'tier' => EntitlementTier::class,
            'trial_surah' => 'integer',
            'trial_started_at' => 'integer',
            'current_period_end' => 'integer',
            'grace_until' => 'integer',
            'state_version' => 'integer',
            'last_provider_event_at' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
