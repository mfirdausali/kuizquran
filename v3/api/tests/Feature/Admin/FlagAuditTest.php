<?php

namespace Tests\Feature\Admin;

use App\Http\Controllers\Admin\Pseudonymizer;
use App\Models\FlagRampAudit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Build-plan step 26 (M8). THE FLAG AUDIT VIEWER — the missing read half of
 * `FlagRampAudit`.
 *
 * `flag_ramp_audit` is written by three `FlagService` call sites (`kill`,
 * `ramp`, `acknowledgeKill` — including the scheduler's unattended
 * `autoWaiveDueKills`) and read by none under `apps/web` or `v3/api` — the
 * same "built + populated + zero read surface" shape v3-D125 named for
 * `FlagRampAudit` specifically and v3-D129 fixed for `AdminAudit`
 * (`AdminAuditController`), this file's direct template.
 *
 * An admin killing a flag, ramping it back on, or acknowledging a kill had
 * no way to see that trail except a database console — the exact gap
 * `AdminAuditController` closed for `admin_audit` one night earlier.
 */
class FlagAuditTest extends TestCase
{
    use RefreshDatabase;

    private function admin(string $email = 'ops@example.com'): User
    {
        config([
            'admin.emails' => [$email],
            'admin.pseudonym_pepper' => 'test-pepper',
        ]);
        $admin = User::factory()->create(['email' => $email, 'email_verified_at' => now()]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    public function test_the_route_requires_admin(): void
    {
        $this->getJson('/api/admin/flags/audit')->assertStatus(401);

        $learner = User::factory()->create();
        Sanctum::actingAs($learner);
        $this->getJson('/api/admin/flags/audit')->assertStatus(403);
    }

    public function test_it_returns_entries_newest_first(): void
    {
        $admin = $this->admin();

        FlagRampAudit::create([
            'flag_key' => 'social.leaderboard',
            'action' => 'kill',
            'actor_admin_id' => $admin->id,
            'at' => 1_700_000_000_000,
        ]);
        FlagRampAudit::create([
            'flag_key' => 'social.leaderboard',
            'action' => 'enable',
            'actor_admin_id' => $admin->id,
            'reason' => 're-ramping after the retention fix shipped',
            'acknowledges_retention_risk' => true,
            'acknowledges_no_dark_pattern' => true,
            'typed_flag_name' => 'social.leaderboard',
            'at' => 1_700_000_005_000,
        ]);

        $entries = $this->getJson('/api/admin/flags/audit')->assertOk()->json('entries');

        $this->assertCount(2, $entries);
        $this->assertSame('enable', $entries[0]['action']);
        $this->assertSame('kill', $entries[1]['action']);
        $this->assertSame('re-ramping after the retention fix shipped', $entries[0]['reason']);
        $this->assertTrue($entries[0]['acknowledgesRetentionRisk']);
        $this->assertTrue($entries[0]['acknowledgesNoDarkPattern']);
        $this->assertSame('social.leaderboard', $entries[0]['typedFlagName']);
        $this->assertNull($entries[1]['reason']);
    }

    /**
     * The ACTOR is pseudonymized on the way out too — same rule v3-D129
     * applied to `AdminAudit`. `actor_admin_id` is a raw FK; returning it
     * verbatim would deanonymize an admin's own identity to their peers.
     */
    public function test_the_actor_is_pseudonymized_not_the_raw_admin_id(): void
    {
        $admin = $this->admin();
        FlagRampAudit::create([
            'flag_key' => 'social.leaderboard',
            'action' => 'kill',
            'actor_admin_id' => $admin->id,
            'at' => 1_700_000_000_000,
        ]);

        $entries = $this->getJson('/api/admin/flags/audit')->assertOk()->json('entries');

        $expected = app(Pseudonymizer::class)->for($admin->id);
        $this->assertSame($expected, $entries[0]['actor']);
        $this->assertStringStartsWith('u_', $entries[0]['actor']);
        $this->assertNotEquals((string) $admin->id, $entries[0]['actor']);
    }

    /**
     * `actor_admin_id` is genuinely NULLABLE — `FlagService::autoWaiveDueKills()`
     * calls `acknowledgeKill($flag->key, null, $now, autoWaived: true)` from the
     * unattended nightly scheduler, no admin in the loop at all. Unlike
     * `admin_audit` (whose actor column is NOT NULL), this viewer must render a
     * systemic action distinctly — never crash on a null id, and never invent a
     * pseudonym for an actor that was never a person.
     */
    public function test_a_system_actor_null_id_renders_as_null_not_a_crash(): void
    {
        $this->admin();
        FlagRampAudit::create([
            'flag_key' => 'social.leaderboard',
            'action' => 'auto_waive',
            'actor_admin_id' => null,
            'at' => 1_700_000_000_000,
        ]);

        $entries = $this->getJson('/api/admin/flags/audit')->assertOk()->json('entries');

        $this->assertCount(1, $entries);
        $this->assertSame('auto_waive', $entries[0]['action']);
        $this->assertNull($entries[0]['actor']);
    }

    public function test_the_flag_filter_narrows_to_one_key(): void
    {
        $admin = $this->admin();
        FlagRampAudit::create([
            'flag_key' => 'social.leaderboard',
            'action' => 'kill',
            'actor_admin_id' => $admin->id,
            'at' => 1_700_000_000_000,
        ]);
        FlagRampAudit::create([
            'flag_key' => 'social.streak_covers',
            'action' => 'kill',
            'actor_admin_id' => $admin->id,
            'at' => 1_700_000_001_000,
        ]);

        $entries = $this->getJson('/api/admin/flags/audit?flag=social.leaderboard')
            ->assertOk()->json('entries');

        $this->assertCount(1, $entries);
        $this->assertSame('social.leaderboard', $entries[0]['flagKey']);
    }

    /**
     * READ-ONLY BY CONSTRUCTION — no POST/PUT/DELETE is registered for it at
     * all. Mirrors `AdminAuditTest::test_the_route_accepts_no_writes`.
     */
    public function test_the_route_accepts_no_writes(): void
    {
        $this->admin();
        $this->postJson('/api/admin/flags/audit', ['action' => 'forged'])->assertStatus(405);
    }

    /** Never a full-table dump — a hard cap, same discipline as AdminAuditController. */
    public function test_entries_are_capped(): void
    {
        $admin = $this->admin();
        for ($i = 0; $i < 210; $i++) {
            FlagRampAudit::create([
                'flag_key' => 'social.leaderboard',
                'action' => 'kill',
                'actor_admin_id' => $admin->id,
                'at' => 1_700_000_000_000 + $i,
            ]);
        }

        $response = $this->getJson('/api/admin/flags/audit')->assertOk();
        $this->assertCount(200, $response->json('entries'));
        $this->assertSame(200, $response->json('limit'));
    }
}
