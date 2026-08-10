<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Auth\MustVerifyEmail;
use Illuminate\Contracts\Auth\MustVerifyEmail as MustVerifyEmailContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * v2-D03 (inherited, not superseded): anonymous-first identity, still
 * binding in v3. /auth/anonymous mints a bare row; register() adopts it in
 * place (same id, same event history) rather than creating a second user —
 * see AuthController.
 *
 * DEFECTS.md#B7: admin status is never a stored column — it is
 * EnsureIsAdmin's runtime check of hasVerifiedEmail() AND allowlist
 * membership, so an unverified email can never claim it.
 */
class User extends Authenticatable implements MustVerifyEmailContract
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, MustVerifyEmail, Notifiable;

    /** @var list<string> */
    protected $fillable = [
        'name',
        'email',
        'password',
        'is_anonymous',
        'anchor_hour',
    ];

    /** @var list<string> */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * In-memory defaults for a `new User()`/`User::create()` before any
     * save — mirrors the migration's DB-level defaults so a freshly created
     * model reflects them immediately without a round-trip refresh.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'is_anonymous' => true,
        'anchor_hour' => 4.5,
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_anonymous' => 'boolean',
            'anchor_hour' => 'float',
        ];
    }

    /**
     * Route notifications (verification, password reset) only ever reach a
     * user who has actually adopted an email — an anonymous row has none.
     */
    public function routeNotificationForMail(): ?string
    {
        return $this->email;
    }
}
