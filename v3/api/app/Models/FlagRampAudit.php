<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The ramp/kill audit. The ceremony's four inputs are STORED, not merely
 * validated — "we checked at the time" is unverifiable after the fact.
 *
 * APPEND-ONLY, same reasoning as `AdminAudit`/`PurgeLedgerEntry`/
 * `AyahVerification`/its review-history sibling table/`Override`/
 * `NightlyCheckRun`/`Event`/`EntitlementTransition`/`Spec`
 * (`docs/ADMIN-CONSOLE.md` §1j): an editable kill/ramp trail is not a trail —
 * "we checked at the time" (this docblock's own first line) is unverifiable
 * the moment a row can be rewritten after the fact. `FlagService` only ever
 * calls `FlagRampAudit::create()` (`kill`/`ramp`/`acknowledgeKill`, the last
 * also reached unattended from `autoWaiveDueKills()`'s nightly scheduler) —
 * never `->update()`/`->delete()` — but that was, until this guard, discipline
 * only, the same gap `specs` carried until v3-D377.
 *
 * TWO LAYERS, same reasoning as the siblings above:
 *
 *  1. DATABASE PERMISSION (production): the app's Postgres role is granted
 *     INSERT and SELECT on this table and NOT update/delete.
 *  2. THE ORM GUARD BELOW: `updating`/`deleting` hooks throw, giving a clear
 *     error in development and in SQLite tests where per-table grants do
 *     not exist.
 *
 * `flag_ramp_audit.actor_admin_id` is `nullOnDelete`, not `cascadeOnDelete`
 * (confirmed against `2026_08_11_120000_create_flags_tables.php`) — a PDPA
 * purge nulls the actor reference on a deleted admin, it never deletes a
 * ramp-audit row, so this guard has no purge-cascade interaction to
 * reconcile (same as `overrides.editor_id`/`specs.author_id`).
 */
class FlagRampAudit extends Model
{
    protected $table = 'flag_ramp_audit';

    protected $fillable = [
        'flag_key', 'action', 'actor_admin_id', 'reason',
        'acknowledges_retention_risk', 'acknowledges_no_dark_pattern',
        'typed_flag_name', 'at',
    ];

    protected function casts(): array
    {
        return [
            'acknowledges_retention_risk' => 'boolean',
            'acknowledges_no_dark_pattern' => 'boolean',
            'at' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (self $row) {
            throw new \RuntimeException(
                'flag_ramp_audit is APPEND-ONLY. A ramp/kill audit row may never be '.
                'updated — "we checked at the time" is unverifiable once a row can be rewritten.',
            );
        });

        static::deleting(function (self $row) {
            throw new \RuntimeException(
                'flag_ramp_audit is APPEND-ONLY. A ramp/kill audit row may never be deleted.',
            );
        });
    }
}
