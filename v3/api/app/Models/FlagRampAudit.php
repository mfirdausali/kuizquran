<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The ramp/kill audit. The ceremony's four inputs are STORED, not merely
 * validated — "we checked at the time" is unverifiable after the fact.
 */
class FlagRampAudit extends Model
{
    protected $table = 'flag_ramp_audit';

    protected $fillable = [
        'flag_key', 'action', 'actor_admin_id', 'reason',
        'acknowledges_retention_risk', 'acknowledges_no_dark_pattern',
        'typed_flag_name', 'at',
    ];

    protected function casts(): array
    {
        return [
            'acknowledges_retention_risk' => 'boolean',
            'acknowledges_no_dark_pattern' => 'boolean',
            'at' => 'integer',
        ];
    }
}
