<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/** v2-D54: the ADMIN_EMAILS allowlist gate, ported from v1's requireAdmin. */
class AdminAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('admin.emails', ['admin@example.com']);
    }

    private function tokenFor(User $user): string
    {
        return $user->createToken('device')->plainTextToken;
    }

    public function test_admin_routes_require_auth(): void
    {
        $this->getJson('/api/admin/metrics')->assertStatus(401);
    }

    public function test_non_admin_user_is_forbidden(): void
    {
        $user = User::factory()->create(['email' => 'nobody@example.com', 'is_anonymous' => false]);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->tokenFor($user)])
            ->getJson('/api/admin/metrics')
            ->assertStatus(403);
    }

    public function test_anonymous_user_with_no_email_is_forbidden(): void
    {
        $user = User::factory()->create(['email' => null]);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->tokenFor($user)])
            ->getJson('/api/admin/metrics')
            ->assertStatus(403);
    }

    public function test_allow_listed_email_is_admitted(): void
    {
        $user = User::factory()->create(['email' => 'admin@example.com', 'is_anonymous' => false]);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->tokenFor($user)])
            ->getJson('/api/admin/metrics')
            ->assertOk();
    }

    public function test_allow_list_match_is_case_insensitive(): void
    {
        $user = User::factory()->create(['email' => 'Admin@Example.com', 'is_anonymous' => false]);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->tokenFor($user)])
            ->getJson('/api/admin/metrics')
            ->assertOk();
    }

    public function test_empty_allowlist_fails_closed(): void
    {
        Config::set('admin.emails', []);
        $user = User::factory()->create(['email' => 'admin@example.com', 'is_anonymous' => false]);
        $this->withHeaders(['Authorization' => 'Bearer '.$this->tokenFor($user)])
            ->getJson('/api/admin/metrics')
            ->assertStatus(403);
    }
}
