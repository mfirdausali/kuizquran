<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Build-plan step 15. v2-D21/D55's override layer, carried forward.
 * Append-only — nothing in `app/` ever UPDATEs or DELETEs a row here; a
 * correction is a NEW row with a later `created_at`
 * (`engine/src/overrides.ts#applyOverrides` resolves latest-wins per
 * field-scoped key via `(created_at, id)`, DEFECTS.md#B4).
 *
 * This isn't just a convention worth a guard for its own sake: B4's
 * `(created_at, id)` tie-break and `App\Support\CorpusHashRecomputer`'s
 * synchronous re-hash (v3-D81, closing DEFECTS.md#B3) both fire only on
 * `OverridesController::store()`'s INSERT path. An in-place UPDATE on an
 * existing row would never trigger a re-hash at all — the exact
 * "content-after-hash sequencing bomb" BUILD-PLAN names as the #2 top
 * risk, one layer down from a spec/corpus change into the override table
 * itself. `overrides` has no FK to `users` that cascades on delete
 * (`editor_id` is `nullOnDelete`), so this guard has no PDPA-purge
 * interaction to reconcile, unlike `events`/`entitlement_transitions`.
 *
 * TWO LAYERS, same reasoning as `AdminAudit`/`PurgeLedgerEntry`/
 * `AyahVerification`/its review-history sibling table (`docs/ADMIN-CONSOLE.md` §1e):
 *
 *  1. DATABASE PERMISSION (production): the app's Postgres role is granted
 *     INSERT and SELECT on this table and NOT update/delete.
 *  2. THE ORM GUARD BELOW: `updating`/`deleting` hooks throw, giving a clear
 *     error in development and in SQLite tests where per-table grants do
 *     not exist.
 *
 * DEFECTS.md#B1: `field` has no `custom` value, enforced by
 * OverridesController::store()'s validation — this model has no column or
 * cast for it either.
 */
class Override extends Model
{
    public $timestamps = false;

    protected $table = 'overrides';

    protected $fillable = [
        'surah', 'ayah', 'position', 'question_type', 'field', 'payload',
        'editor_id', 'note', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'created_at' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (self $row) {
            throw new \RuntimeException(
                'overrides is APPEND-ONLY. An override row may never be updated — '.
                'a correction is a new row with a later created_at (DEFECTS.md#B4), '.
                'and an in-place edit would never trigger the B3 re-hash.',
            );
        });

        static::deleting(function (self $row) {
            throw new \RuntimeException(
                'overrides is APPEND-ONLY. An override row may never be deleted.',
            );
        });
    }

    /** @return BelongsTo<User, $this> */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_id');
    }
}
