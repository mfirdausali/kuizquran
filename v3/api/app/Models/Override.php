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

    /** @return BelongsTo<User, $this> */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_id');
    }
}
