<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Build-plan step 27 (M9). APPEND-ONLY transition history for a gloss draft.
 *
 * `text_at_review` snapshots the bytes a reviewer actually approved — the same
 * principle as `ayah_verifications.content_hash`, for the same reason (B3): an
 * approval that does not name what was approved silently survives an edit that
 * invalidated it.
 *
 * TWO LAYERS, same reasoning as `AdminAudit`/`PurgeLedgerEntry`/
 * `AyahVerification` (`docs/ADMIN-CONSOLE.md` §1/§1b/§1c, now §1d for this
 * table):
 *
 *  1. DATABASE PERMISSION (production): the app's Postgres role is granted
 *     INSERT and SELECT on this table and NOT update/delete.
 *  2. THE ORM GUARD BELOW: `updating`/`deleting` hooks throw, giving a clear
 *     error in development and in SQLite tests where per-table grants do
 *     not exist.
 *
 * `GlossDraftsTest::test_a_review_row_can_never_be_updated_or_deleted` asserts
 * layer 2 directly.
 */
class GlossDraftReview extends Model
{
    public $timestamps = false;

    protected $table = 'gloss_draft_reviews';

    protected $fillable = [
        'gloss_draft_id', 'from_status', 'to_status', 'text_at_review',
        'actor_kind', 'actor', 'note', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'gloss_draft_id' => 'integer',
            'created_at' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (self $row) {
            throw new \RuntimeException(
                'gloss_draft_reviews is APPEND-ONLY. A review row may never be updated — '.
                'an editable approval record is not an approval record.',
            );
        });

        static::deleting(function (self $row) {
            throw new \RuntimeException(
                'gloss_draft_reviews is APPEND-ONLY. A review row may never be deleted.',
            );
        });
    }
}
