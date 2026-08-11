<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillingEvent extends Model
{
    protected $fillable = [
        'provider', 'provider_event_id', 'type', 'payload',
        'provider_created_at', 'received_at', 'processed_at',
        'outcome', 'error', 'user_id',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'provider_created_at' => 'integer',
            'received_at' => 'integer',
            'processed_at' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
