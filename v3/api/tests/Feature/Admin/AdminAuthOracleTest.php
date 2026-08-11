<?php

namespace Tests\Feature\Admin;

use App\Http\Controllers\Admin\AdminAuthController;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Build-plan step 24 (M8). ADMIN LOGIN MUST NOT BE AN ORACLE.
 *
 * WIREFRAME §16: "Wrong password and not-on-the-allowlist return the SAME generic
 * error... Otherwise the login form becomes a free oracle for 'is this address an
 * admin?'"
 */
class AdminAuthOracleTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.emails' => ['ops@example.com'], 'admin.pseudonym_pepper' => 'test-pepper']);
    }

    /**
     * THE FOUR FAILURE CASES MUST BE BYTE-IDENTICAL — status, body AND headers.
     *
     * MUTATION: change the not-allowlisted branch to return a different string, or
     * a different status. Any divergence in any of the three is an oracle.
     */
    public function test_all_four_failure_modes_are_byte_identical(): void
    {
        // 2. exists, allowlisted, verified — but WRONG PASSWORD
        User::factory()->create([
            'email' => 'ops@example.com',
            'password' => Hash::make(self::PASSWORD),
            'email_verified_at' => now(),
        ]);
        // 3. exists, correct password, NOT allowlisted
        User::factory()->create([
            'email' => 'nobody@example.com',
            'password' => Hash::make(self::PASSWORD),
            'email_verified_at' => now(),
        ]);
        // 4. exists, correct password, allowlisted, but UNVERIFIED
        config(['admin.emails' => ['ops@example.com', 'unverified@example.com']]);
        User::factory()->create([
            'email' => 'unverified@example.com',
            'password' => Hash::make(self::PASSWORD),
            'email_verified_at' => null,
        ]);

        $cases = [
            'no such account' => ['ghost@example.com', self::PASSWORD],
            'wrong password' => ['ops@example.com', 'wrong-password'],
            'not allowlisted' => ['nobody@example.com', self::PASSWORD],
            'unverified email' => ['unverified@example.com', self::PASSWORD],
        ];

        $signatures = [];
        foreach ($cases as $label => [$email, $password]) {
            $response = $this->postJson('/api/admin/login', ['email' => $email, 'password' => $password]);

            $signatures[$label] = [
                'status' => $response->getStatusCode(),
                'body' => $response->getContent(),
                // Headers that could differ per-branch. Date/rate-limit headers
                // vary legitimately and are excluded.
                'contentType' => $response->headers->get('Content-Type'),
            ];
        }

        $first = reset($signatures);
        foreach ($signatures as $label => $sig) {
            $this->assertSame($first, $sig, "the `{$label}` response differs — the login form is an ORACLE for admin addresses");
        }

        $this->assertSame(403, $first['status']);
        $this->assertStringContainsString(AdminAuthController::GENERIC_ERROR, $first['body']);
    }

    /**
     * §16: "No signup link, no reset link, no hint which failed."
     *
     * MUTATION: add a `reset` or `signup` key to the denial body.
     */
    public function test_the_denial_offers_no_signup_or_reset_hint(): void
    {
        $response = $this->postJson('/api/admin/login', ['email' => 'ghost@example.com', 'password' => 'x']);

        $body = strtolower($response->getContent());
        foreach (['signup', 'sign up', 'register', 'reset', 'forgot'] as $leak) {
            $this->assertStringNotContainsString($leak, $body, "the denial must not mention `{$leak}`");
        }
        // And it must not name which of the four conditions failed.
        foreach (['password', 'allowlist', 'verified', 'not found', 'unknown'] as $leak) {
            $this->assertStringNotContainsString($leak, $body, "the denial must not hint at `{$leak}`");
        }
    }

    /**
     * THE TIMING ORACLE — the part most implementations miss.
     *
     * A naive login returns early on "no such user", skipping bcrypt entirely. At
     * cost 12 that is ~250ms vs ~1ms: a 250x difference that reintroduces the
     * oracle through a side channel after the response body carefully closed it.
     *
     * MUTATION: add `if (!$user) return $this->deny();` before the Hash::check.
     * This test asserts the hash function IS CALLED on the no-such-user path,
     * which a pure wall-clock timing assertion could never do reliably in CI.
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

        $this->postJson('/api/admin/login', ['email' => 'ghost@example.com', 'password' => 'anything']);

        $this->assertSame(
            1,
            $calls,
            'Hash::check MUST run even with no such user, or bcrypt timing becomes the oracle',
        );
    }

    /** An allowlisted address with no account yet — edge case #145, fails closed. */
    public function test_allowlisted_email_with_no_account_still_fails_closed(): void
    {
        config(['admin.emails' => ['future-admin@example.com']]);

        $response = $this->postJson('/api/admin/login', [
            'email' => 'future-admin@example.com',
            'password' => self::PASSWORD,
        ]);

        $response->assertStatus(403);
        $this->assertStringContainsString(AdminAuthController::GENERIC_ERROR, $response->getContent());
    }

    /** An EMPTY allowlist means NOBODY is admin (fail closed, edge case #146). */
    public function test_an_empty_allowlist_means_nobody_is_admin(): void
    {
        config(['admin.emails' => []]);
        User::factory()->create([
            'email' => 'ops@example.com',
            'password' => Hash::make(self::PASSWORD),
            'email_verified_at' => now(),
        ]);

        $this->postJson('/api/admin/login', ['email' => 'ops@example.com', 'password' => self::PASSWORD])
            ->assertStatus(403);
    }

    /** The happy path — so the test above is not passing because login is broken. */
    public function test_a_valid_allowlisted_verified_admin_can_log_in(): void
    {
        User::factory()->create([
            'email' => 'ops@example.com',
            'password' => Hash::make(self::PASSWORD),
            'email_verified_at' => now(),
        ]);

        $response = $this->postJson('/api/admin/login', ['email' => 'ops@example.com', 'password' => self::PASSWORD]);

        $response->assertOk();
        $this->assertNotEmpty($response->json('token'));
        // Even the admin's OWN identity comes back pseudonymised.
        $this->assertStringStartsWith('u_', $response->json('pseudonym'));
    }
}
