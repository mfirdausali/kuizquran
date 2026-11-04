<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only. Nothing in the app ever UPDATEs or DELETEs a row here. This
 * is the log edge case #114 ("data never deleted") is audited against, and
 * the nightly reconcile diffs the provider's state against it — an editable
 * transition history would make both meaningless.
 *
 * `entitlement_transitions.user_id` is `cascadeOnDelete()`, same shape as
 * `events.user_id`. v3-D373 treated that as a reason the append-only guard
 * below might break `PurgeDueAccountsCommand`'s PDPA purge. It does not: a
 * database-level `ON DELETE CASCADE` runs inside the database engine, never
 * through Eloquent, so it never dispatches this model's `deleting` event —
 * proven empirically against the identically-shaped `Event` model (see that
 * class's docblock and DECISIONS.md v3-D374).
 *
 * TWO LAYERS, same reasoning as `AdminAudit`/`PurgeLedgerEntry`/
 * `AyahVerification`/its review-history sibling table/`Override`/`NightlyCheckRun`/`Event`
 * (`docs/ADMIN-CONSOLE.md` §1h):
 *
 *  1. DATABASE PERMISSION (production): the app's Postgres role is granted
 *     INSERT and SELECT on this table and NOT update/delete.
 *  2. THE ORM GUARD BELOW: `updating`/`deleting` hooks throw, giving a clear
 *     error in development and in SQLite tests where per-table grants do
 *     not exist.
 */
class EntitlementTransition extends Model
{
    protected $fillable = [
        'user_id', 'from_state', 'to_state', 'cause',
        'provider_event_id', 'actor', 'reason', 'at',
    ];

    protected function casts(): array
    {
        return ['at' => 'integer'];
    }

    protected static function booted(): void
    {
        static::updating(function (self $row) {
            throw new \RuntimeException(
                'entitlement_transitions is APPEND-ONLY. A transition row may never be '.
                'updated — the nightly reconcile and edge case #114\'s audit trail depend on it.',
            );
        });

        static::deleting(function (self $row) {
            throw new \RuntimeException(
                'entitlement_transitions is APPEND-ONLY. A transition row may never be '.
                'deleted directly. (A PDPA purge removes a user\'s transitions via the '.
                'database\'s own ON DELETE CASCADE on entitlement_transitions.user_id, '.
                'which never reaches this guard — see Event\'s docblock and DECISIONS.md v3-D374.)',
            );
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
