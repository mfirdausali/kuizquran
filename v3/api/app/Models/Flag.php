<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Flag extends Model
{
    protected $fillable = [
        'key', 'enabled', 'version', 'killed_at', 'killed_by',
        'ack_at', 'ack_by', 'ack_auto_waived', 'description',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'version' => 'integer',
            'killed_at' => 'integer',
            'ack_at' => 'integer',
            'ack_auto_waived' => 'boolean',
        ];
    }

    /** #159: the banner persists after a kill until an explicit new ramp. */
    public function bannerVisible(): bool
    {
        return $this->killed_at !== null;
    }
}
