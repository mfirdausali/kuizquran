<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The append-only events table (v2-D18). PK is the client-generated uuid
 * (idempotency key) — never auto-incrementing. Rows are inserted, never
 * updated or deleted, by the sync layer (EventsController::store uses
 * insertOrIgnore so a re-sent batch is a no-op for ids already present).
 */
class Event extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'id',
        'user_id',
        'type',
        'ts',
        'surah',
        'ayah',
        'rung',
        'position',
        'choice',
        'correct',
        'pretest',
        'to_ayah',
        'step_kind',
        'structured',
        'latency',
        'resume',
        'test_kind',
        'score',
        'total',
        'sent_to_reviews',
        'received_at',
    ];

    protected function casts(): array
    {
        return [
            'ts' => 'integer',
            'correct' => 'boolean',
            'pretest' => 'boolean',
            'structured' => 'boolean',
            'sent_to_reviews' => 'boolean',
            'received_at' => 'integer',
        ];
    }
}
