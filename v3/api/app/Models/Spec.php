<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Build-plan step 15 (v3-D33). IMMUTABLE — no row is ever UPDATEd or
 * DELETEd by any code path in this app. VERSIONED — `spec_id` groups a
 * lineage. TOMBSTONE-AS-FLIP — `active=false` on a new version row, never
 * a delete.
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
}
