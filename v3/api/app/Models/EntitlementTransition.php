<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Append-only. Nothing in the app ever UPDATEs or DELETEs a row here. */
class EntitlementTransition extends Model
{
    protected $fillable = [
        'user_id', 'from_state', 'to_state', 'cause',
        'provider_event_id', 'actor', 'reason', 'at',
    ];

    protected function casts(): array
    {
        return ['at' => 'integer'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
