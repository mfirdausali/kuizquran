<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * DEFECTS.md#B7 closing test: "email verification ships and a test asserts
 * an unverified email cannot pass EnsureIsAdmin." No admin console exists
 * yet (M8) to hang a real route off, so setUp registers a throwaway route
 * behind the exact same ['auth:sanctum', 'admin'] stack the real console
 * will use — the middleware under test is production code, only the route
 * is test scaffolding.
 */
class AdminAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('admin.emails', ['admin@example.com']);
        Route::middleware(['auth:sanctum', 'admin'])->get('/api/_test/admin-only', fn () => response()->json(['ok' => true]));
    }

    private function tokenFor(User $user): string
    {
        return $user->createToken('device')->plainTextToken;
    }

    public function test_admin_route_requires_auth(): void
    {
        $this->getJson('/api/_test/admin-only')->assertStatus(401);
    }

    public function test_non_admin_verified_user_is_forbidden(): void
    {
        $user = User::factory()->create(['email' => 'nobody@example.com']);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->tokenFor($user)])
            ->getJson('/api/_test/admin-only')
            ->assertStatus(403);
    }

    /** The B7 regression: claiming the allow-listed address is not enough —
     *  ownership (verification) is required too. */
    public function test_unverified_admin_email_is_forbidden(): void
    {
        $user = User::factory()->unverified()->create(['email' => 'admin@example.com']);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->tokenFor($user)])
            ->getJson('/api/_test/admin-only')
            ->assertStatus(403);
    }

    public function test_verified_admin_email_is_admitted(): void
    {
        $user = User::factory()->create(['email' => 'admin@example.com']);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->tokenFor($user)])
            ->getJson('/api/_test/admin-only')
            ->assertOk();
    }

    public function test_allow_list_match_is_case_insensitive(): void
    {
        $user = User::factory()->create(['email' => 'Admin@Example.com']);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->tokenFor($user)])
            ->getJson('/api/_test/admin-only')
            ->assertOk();
    }

    public function test_empty_allowlist_fails_closed(): void
    {
        Config::set('admin.emails', []);
        $user = User::factory()->create(['email' => 'admin@example.com']);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->tokenFor($user)])
            ->getJson('/api/_test/admin-only')
            ->assertStatus(403);
    }

    public function test_anonymous_user_with_no_email_is_forbidden(): void
    {
        $user = User::factory()->create(['email' => null, 'email_verified_at' => null]);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->tokenFor($user)])
            ->getJson('/api/_test/admin-only')
            ->assertStatus(403);
    }
}
