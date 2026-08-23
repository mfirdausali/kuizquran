<?php

namespace Tests\Feature\Admin;

use App\Models\AdminRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Build-plan step 24 (M8). `GET /api/admin/whoami` — the missing frontend
 * gate's check. Every admin console screen (`/workbench`, `/settings/*`)
 * relies on the SAME `admin` middleware chain (`auth:sanctum` +
 * `EnsureIsAdmin`) that already gates every real admin write and read —
 * this endpoint exists so a client can ask "is THIS token actually admin?"
 * without guessing from a 403 on an unrelated resource. See DECISIONS.md
 * for the "admin client-side auth gate" finding this closes (named unbuilt
 * since v3-D92, repeated through v3-D100/D124/D125/D126).
 */
class AdminWhoamiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.emails' => ['ops@example.com'], 'admin.pseudonym_pepper' => 'test-pepper']);
    }

    /** No token at all — auth:sanctum itself denies, before EnsureIsAdmin ever runs. */
    public function test_it_requires_authentication(): void
    {
        $this->getJson('/api/admin/whoami')->assertStatus(401);
    }

    /** A real, verified, but NOT allowlisted account — the outer `admin` gate denies. */
    public function test_it_requires_admin_allowlist(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'email' => 'nobody@example.com',
            'email_verified_at' => now(),
        ]));

        $this->getJson('/api/admin/whoami')->assertStatus(403);
    }

    /** Allowlisted but UNVERIFIED — B7's own closing criterion, re-checked here too. */
    public function test_it_requires_a_verified_email(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'email' => 'ops@example.com',
            'email_verified_at' => null,
        ]));

        $this->getJson('/api/admin/whoami')->assertStatus(403);
    }

    /** The real answer a genuine admin gets: their own pseudonym and roles. */
    public function test_it_returns_pseudonym_and_roles_for_a_real_admin(): void
    {
        $admin = User::factory()->create([
            'email' => 'ops@example.com',
            'email_verified_at' => now(),
        ]);
        AdminRole::create(['user_id' => $admin->id, 'role' => 'qari', 'granted_at' => 1_700_000_000_000]);
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/whoami');

        $response->assertOk();
        $this->assertStringStartsWith('u_', $response->json('pseudonym'));
        $this->assertSame(['qari'], $response->json('roles'));
    }

    /** An admin with NO roles rows still passes — roles refine, never gate admission. */
    public function test_roles_is_an_empty_array_not_null_for_a_roleless_admin(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'email' => 'ops@example.com',
            'email_verified_at' => now(),
        ]));

        $response = $this->getJson('/api/admin/whoami');

        $response->assertOk();
        $this->assertSame([], $response->json('roles'));
    }
}
