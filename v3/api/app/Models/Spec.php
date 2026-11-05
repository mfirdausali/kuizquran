<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Build-plan step 15 (v3-D33). IMMUTABLE — no row is ever UPDATEd or
 * DELETEd by any code path in this app. VERSIONED — `spec_id` groups a
 * lineage. TOMBSTONE-AS-FLIP — `active=false` on a new version row, never
 * a delete.
 *
 * TWO LAYERS, same reasoning as `AdminAudit`/`PurgeLedgerEntry`/
 * `AyahVerification`/`Override` (`docs/ADMIN-CONSOLE.md` §1/§1b/§1c/§1e, now
 * §1i for this table):
 *
 *  1. DATABASE PERMISSION (production): the app's Postgres role is granted
 *     INSERT and SELECT on this table and NOT update/delete.
 *  2. THE ORM GUARD BELOW: `updating`/`deleting` hooks throw, giving a clear
 *     error in development and in SQLite tests where per-table grants do
 *     not exist. `author_id` is `nullOnDelete`, not `cascadeOnDelete` — a
 *     PDPA purge nulls the author reference on a deleted admin, it never
 *     deletes a spec row, so this guard has no purge-cascade interaction to
 *     reconcile (same as `Override::author_id`/`editor_id`).
 *
 * `SpecsTest::test_a_spec_row_can_never_be_updated_or_deleted` and
 * `test_a_spec_row_cannot_be_deleted` assert layer 2 directly.
 */
class Spec extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'spec_id', 'version', 'active', 'surah', 'site_key', 'lane',
        'payload', 'author_id', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'payload' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (self $row) {
            throw new \RuntimeException(
                'specs is APPEND-ONLY. A spec row may never be updated — '.
                'an edit is a new row at spec_id/version+1, never an in-place rewrite.',
            );
        });

        static::deleting(function (self $row) {
            throw new \RuntimeException(
                'specs is APPEND-ONLY. A spec row may never be deleted — deactivating '.
                'a spec is a new tombstone-as-flip row with active=false, never a delete.',
            );
        });
    }
}
