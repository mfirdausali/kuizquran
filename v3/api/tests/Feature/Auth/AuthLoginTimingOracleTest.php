<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * `AuthController::login()` is the real password CHECK for ordinary learner
 * accounts (AuthRateLimitTest's own docblock already makes that distinction
 * from a mere reset REQUEST). `Admin\AdminAuthController::login()` carries a
 * documented timing-oracle fix for the IDENTICAL shape — its own docblock:
 * "the password hash must be verified EVEN WHEN the account does not exist...
 * skipping bcrypt... reintroduces the oracle through the side channel." That
 * fix was never applied to this sibling controller.
 *
 * Unfixed, `login()` returns early on `! $user` before ever calling
 * `Hash::check()`, so a request for a non-existent email answers in ~1ms
 * while a request for a real email runs a real bcrypt comparison (~250ms at
 * the app's configured cost). That timing gap — not the response body, which
 * already carries the same generic "invalid credentials" message either way
 * — lets an attacker enumerate which emails have accounts on this app.
 */
class AuthLoginTimingOracleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Same technique as `AdminAuthOracleTest`'s own timing test: assert the
     * hash function IS CALLED on the no-such-user path, which proves the
     * timing-equalizing branch ran. A wall-clock assertion would be flaky in
     * CI; a call-count assertion is not.
     *
     * MUTATION: restore the early `if (! $user) return ...401...;` return
     * before `Hash::check()` — this must go red.
     */
    public function test_the_password_hash_is_verified_even_when_the_account_does_not_exist(): void
    {
        $calls = 0;
        Hash::shouldReceive('check')
            ->andReturnUsing(function () use (&$calls) {
                $calls++;

                return false;
            });
        Hash::shouldReceive('make')->andReturn('$2y$04$dummydummydummydummydummydummydummydummydummydummydu');

        $this->postJson('/api/auth/login', ['email' => 'ghost@example.com', 'password' => 'anything'])
            ->assertStatus(401);

        $this->assertSame(
            1,
            $calls,
            'Hash::check MUST run even with no such user, or bcrypt timing becomes the oracle',
        );
    }

    /** Same proof for a real account that simply has no password set yet
     *  (e.g. an anonymous row never adopted) — the other early-return branch
     *  `! $user->password` skips the hash exactly the same way. */
    public function test_the_password_hash_is_verified_even_when_the_account_has_no_password(): void
    {
        User::factory()->create(['email' => 'anon-only@example.com', 'password' => null]);

        $calls = 0;
        Hash::shouldReceive('check')
            ->andReturnUsing(function () use (&$calls) {
                $calls++;

                return false;
            });
        Hash::shouldReceive('make')->andReturn('$2y$04$dummydummydummydummydummydummydummydummydummydummydu');

        $this->postJson('/api/auth/login', ['email' => 'anon-only@example.com', 'password' => 'anything'])
            ->assertStatus(401);

        $this->assertSame(1, $calls);
    }

    /** Non-regression guard: the fix must not break a real login. */
    public function test_a_real_login_still_succeeds(): void
    {
        User::factory()->create(['email' => 'learner@example.com', 'password' => bcrypt('correct-horse')]);

        $this->postJson('/api/auth/login', ['email' => 'learner@example.com', 'password' => 'correct-horse'])
            ->assertOk();
    }
}
