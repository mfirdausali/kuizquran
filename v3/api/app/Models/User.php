<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Auth\MustVerifyEmail;
use Illuminate\Contracts\Auth\MustVerifyEmail as MustVerifyEmailContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
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

    /** The learner's event log. Append-only; nothing here ever deletes it. */
    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }

    /**
     * Build-plan step 24 (M8). The INNER gate's roles.
     *
     * @return string[]
     */
    public function adminRoles(): array
    {
        return AdminRole::where('user_id', $this->id)->pluck('role')->all();
    }

    public function hasAdminRole(string $role): bool
    {
        return in_array($role, $this->adminRoles(), true);
    }

    /**
     * DEFECTS.md#B7's exact two-part test (verified email AND allowlist
     * membership), extracted so `EnsureIsAdmin` and any controller that
     * needs to know "is the CALLER an admin" (not "is this route
     * admin-gated") share one implementation rather than two copies that
     * can drift. See v3-D403 — `OverridesController`/`VerificationsController`
     * read this on their public GET routes to decide whether to include
     * admin-only display fields (editor/verifier email, free-text notes).
     */
    public function isAdmin(): bool
    {
        if (! $this->hasVerifiedEmail()) {
            return false;
        }

        $allow = config('admin.emails', []);
        $email = strtolower(trim($this->email ?? ''));

        return $email !== '' && in_array($email, $allow, true);
    }
}
