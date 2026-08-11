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
}
