<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Build-plan step 15 / v3-D13 / v3-D22. APPEND-ONLY — see the migration's
 * own doc comment for why (DEFECTS.md#B3). Never updated or deleted by
 * any code path in this app.
 */
class AyahVerification extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'surah', 'ayah', 'tier', 'content_hash', 'hash_spec_version',
        'reviewer_kind', 'verified_by', 'note', 'created_at',
    ];
}
