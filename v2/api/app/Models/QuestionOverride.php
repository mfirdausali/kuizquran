<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * v2-D21/D55: the question-bank override layer. Append-only audit — rows are
 * inserted, never updated or deleted; `applyOverrides()` (engine/src/overrides.ts)
 * resolves the latest `created_at` per field-scoped key on the client.
 */
class QuestionOverride extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'surah',
        'ayah',
        'position',
        'question_type',
        'field',
        'payload',
        'editor_id',
        'note',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'created_at' => 'integer',
        ];
    }
}
