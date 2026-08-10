<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Build-plan step 14. Append-only — nothing in `app/` ever UPDATEs or
 * DELETEs a row here (WIREFRAME.md §16: "the Events tab is read-only").
 * `id` is the server ingest-sequence (the pull cursor); `uuid` is the
 * client-stamped idempotency key, unique per user.
 */
class Event extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'uuid', 'type', 'ts',
        'surah', 'ayah', 'rung', 'position', 'choice', 'correct', 'pretest',
        'to_ayah', 'step_kind', 'structured', 'latency', 'resume', 'test_kind',
        'score', 'total', 'sent_to_reviews',
        'site_key', 'visit_ordinal', 'device_id', 'device_seq', 'tz',
        'corpus_hash', 'locale', 'spec_snapshot', 'grade_class',
        'received_at',
    ];

    protected function casts(): array
    {
        return [
            'correct' => 'boolean',
            'pretest' => 'boolean',
            'structured' => 'boolean',
            'sent_to_reviews' => 'boolean',
            'spec_snapshot' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
