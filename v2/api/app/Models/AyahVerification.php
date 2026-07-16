<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** v2-D30/D57: scholar/qari sign-off per (surah, ayah). Current-state fact —
 *  one row per ayah, re-verifying upserts. */
class AyahVerification extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'surah',
        'ayah',
        'verified_by',
        'note',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'integer',
        ];
    }
}
