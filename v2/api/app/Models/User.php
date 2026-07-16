<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'is_anonymous', 'anchor_hour'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * In-memory defaults for a `new User()`/`User::create()` before any save —
     * mirrors the migration's DB-level defaults so a freshly created model
     * reflects them immediately without a round-trip refresh (SQLite/MySQL
     * don't return column defaults from an INSERT).
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'is_anonymous' => true,
        'anchor_hour' => 4.5,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_anonymous' => 'boolean',
            'anchor_hour' => 'float',
        ];
    }

    /** @return HasMany<Event, $this> */
    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }
}
