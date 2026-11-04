<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Build-plan step 15 / v3-D13 / v3-D22. APPEND-ONLY — see the migration's
 * own doc comment for why (DEFECTS.md#B3): this is the qari's and the
 * admin's signature chain, and "verified = any row's hash matches current"
 * only means anything if a row, once written, can never be rewritten.
 *
 * TWO LAYERS, same reasoning as `AdminAudit`/`PurgeLedgerEntry`
 * (`docs/ADMIN-CONSOLE.md` §1/§1b, now §1c for this table):
 *
 *  1. DATABASE PERMISSION (production): the app's Postgres role is granted
 *     INSERT and SELECT on this table and NOT update/delete.
 *  2. THE ORM GUARD BELOW: `updating`/`deleting` hooks throw, giving a clear
 *     error in development and in SQLite tests where per-table grants do
 *     not exist.
 *
 * `VerificationsTest::test_a_verification_row_can_never_be_updated_or_deleted`
 * asserts layer 2 directly.
 */
class AyahVerification extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'surah', 'ayah', 'tier', 'content_hash', 'hash_spec_version',
        'reviewer_kind', 'verified_by', 'note', 'created_at',
    ];

    protected static function booted(): void
    {
        static::updating(function (self $row) {
            throw new \RuntimeException(
                'ayah_verifications is APPEND-ONLY. A verification row may never be updated — '.
                'an editable qari/admin sign-off is not a sign-off.',
            );
        });

        static::deleting(function (self $row) {
            throw new \RuntimeException(
                'ayah_verifications is APPEND-ONLY. A verification row may never be deleted.',
            );
        });
    }
}
