<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Edge case #147: the reveal TTL is SERVER-SIDE.
 *
 * `expires_at` is set by the server from `config('admin.reveal_ttl_seconds')` and
 * is never read from the request. A client-supplied expiry is a suggestion an
 * attacker writes.
 */
class AdminRevealToken extends Model
{
    protected $fillable = ['admin_id', 'subject_user_id', 'token', 'expires_at', 'created_at_ms'];

    protected function casts(): array
    {
        return ['expires_at' => 'integer', 'created_at_ms' => 'integer'];
    }

    public function isExpired(int $nowMs): bool
    {
        return $nowMs >= $this->expires_at;
    }
}
