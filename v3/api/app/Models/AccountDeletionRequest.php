<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A PENDING PDPA deletion request. See the migration for why this row
 * carries no status column — its existence IS the pending state, and it is
 * deleted (never marked) the moment it stops being true, either by restore
 * (token match) or by purge (the user row itself is gone, cascading this
 * one with it).
 */
class AccountDeletionRequest extends Model
{
    protected $table = 'account_deletion_requests';

    protected $fillable = [
        'user_id', 'token_hash', 'requested_at_ms', 'purge_at_ms',
    ];

    protected function casts(): array
    {
        return [
            'requested_at_ms' => 'integer',
            'purge_at_ms' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isDue(int $nowMs): bool
    {
        return $this->purge_at_ms <= $nowMs;
    }
}
