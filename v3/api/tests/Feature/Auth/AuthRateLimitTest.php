<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Every other unauthenticated, credential-adjacent endpoint in routes/api.php
 * carries `throttle:6,1` — /forgot-password, /reset-password, the signed
 * email-verify link, /admin/login (at a stricter 10,1). POST /auth/login —
 * the actual password check, not merely a reset REQUEST — and POST
 * /auth/anonymous (unauthenticated row/token minting) carried none at all,
 * so neither had any rate limit of any kind. A real caller could brute-force
 * any known email's password, or mint unbounded anonymous users/tokens, with
 * zero friction. Closes this run's finding: see DECISIONS.md.
 */
class AuthRateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_is_rate_limited_against_brute_force(): void
    {
        User::factory()->create(['email' => 'victim@example.com', 'password' => bcrypt('correct-horse')]);

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'victim@example.com', 'password' => 'wrong'])
                ->assertStatus(401);
        }

        $this->postJson('/api/auth/login', ['email' => 'victim@example.com', 'password' => 'wrong'])
            ->assertStatus(429);

        // The limiter must not also lock out the legitimate owner mid-window —
        // the limit is on ATTEMPTS, not on the account.
        $this->postJson('/api/auth/login', ['email' => 'victim@example.com', 'password' => 'correct-horse'])
            ->assertStatus(429);
    }

    public function test_anonymous_mint_is_rate_limited(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/auth/anonymous')->assertStatus(201);
        }

        $this->postJson('/api/auth/anonymous')->assertStatus(429);
    }
}
