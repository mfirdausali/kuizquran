<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Build-plan step 24 (M8). The INNER gate.
 *
 * The env allowlist (`ADMIN_EMAILS`) remains the OUTER gate — edge case #146's
 * break-glass is "fix the env var and restart", which must work when the database
 * itself is the broken thing. Roles refine what an already-allowlisted admin may
 * do; they never grant admission.
 */
class AdminRole extends Model
{
    public const OPERATOR = 'operator';

    public const QARI = 'qari';

    public const MODERATOR = 'moderator';

    public const ALL = [self::OPERATOR, self::QARI, self::MODERATOR];

    protected $fillable = ['user_id', 'role', 'granted_at', 'granted_by'];

    protected function casts(): array
    {
        return ['granted_at' => 'integer'];
    }
}
