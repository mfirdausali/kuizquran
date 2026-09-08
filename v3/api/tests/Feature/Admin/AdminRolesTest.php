<?php

namespace Tests\Feature\Admin;

use App\Console\Commands\GrantAdminRoleCommand;
use App\Http\Controllers\Admin\Pseudonymizer;
use App\Models\AdminRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * THE ADMIN ROLES VIEWER — the read half of `admin_roles`, never built.
 * `admin_roles` is written by `admin:grant-role` (the only writer — see that
 * command's own docblock) since v3-D92, and read by nothing under `app/`
 * except `GET /api/admin/whoami`, which answers only "what does THE CALLING
 * admin hold", never "who holds what". Same "built + populated + zero read
 * surface" shape v3-D129/D130/D141/D142 each closed for
 * `admin_audit`/`flag_ramp_audit`/`entitlement_transitions`/`purge_ledger`.
 */
class AdminRolesTest extends TestCase
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

    /**
     * Grants a real role through the REAL command (`admin:grant-role`), the
     * one and only writer of this table — never a hand-built row shaped like
     * one, matching `PurgeLedgerTest`'s own discipline for the same reason.
     */
    private function grantRole(string $role, string $by = 'cli'): int
    {
        $target = User::factory()->create();
        config(['admin.emails' => array_values(array_unique([
            ...config('admin.emails', []),
            strtolower($target->email),
        ]))]);

        $this->artisan(GrantAdminRoleCommand::class, [
            'email' => $target->email,
            'role' => $role,
            '--by' => $by,
        ])->assertSuccessful();

        return $target->id;
    }

    public function test_the_route_requires_admin(): void
    {
        $this->getJson('/api/admin/roles')->assertStatus(401);

        $learner = User::factory()->create();
        Sanctum::actingAs($learner);
        $this->getJson('/api/admin/roles')->assertStatus(403);
    }

    public function test_it_returns_entries_newest_first_through_the_real_grant_command(): void
    {
        $this->admin();
        $firstId = $this->grantRole(AdminRole::OPERATOR, 'alice@example.com');
        usleep(5000);
        $secondId = $this->grantRole(AdminRole::QARI, 'bob@example.com');

        $entries = $this->getJson('/api/admin/roles')->assertOk()->json('entries');

        $this->assertCount(2, $entries);
        $expectedSecond = app(Pseudonymizer::class)->for($secondId);
        $expectedFirst = app(Pseudonymizer::class)->for($firstId);
        $this->assertSame($expectedSecond, $entries[0]['subjectPseudonym']);
        $this->assertSame(AdminRole::QARI, $entries[0]['role']);
        $this->assertSame('bob@example.com', $entries[0]['grantedBy']);
        $this->assertSame($expectedFirst, $entries[1]['subjectPseudonym']);
        $this->assertSame(AdminRole::OPERATOR, $entries[1]['role']);
        $this->assertSame('alice@example.com', $entries[1]['grantedBy']);
    }

    /**
     * SUBJECT PSEUDONYMIZATION. `admin_roles.user_id` is a raw FK to `users`.
     * This is the first surface that ever renders it to a human, so returning
     * it verbatim would be the one screen that deanonymizes an admin's own
     * identity to every other admin who can load it.
     */
    public function test_the_subject_is_pseudonymized_not_the_raw_user_id(): void
    {
        $this->admin();
        $grantedId = $this->grantRole(AdminRole::QARI);

        $entries = $this->getJson('/api/admin/roles')->assertOk()->json('entries');

        $expected = app(Pseudonymizer::class)->for($grantedId);
        $this->assertSame($expected, $entries[0]['subjectPseudonym']);
        $this->assertStringStartsWith('u_', $entries[0]['subjectPseudonym']);
        $this->assertNotEquals((string) $grantedId, $entries[0]['subjectPseudonym']);
    }

    /** `grantedBy` is a free-text operator string, never pseudonymized —
     *  it is not a `users` FK (it can be, and defaults to, the literal
     *  string "cli"). */
    public function test_granted_by_defaults_to_the_literal_cli_string_unpseudonymized(): void
    {
        $this->admin();
        $this->grantRole(AdminRole::MODERATOR);

        $entries = $this->getJson('/api/admin/roles')->assertOk()->json('entries');
        $this->assertSame('cli', $entries[0]['grantedBy']);
    }

    public function test_the_role_filter_narrows_to_one_role(): void
    {
        $this->admin();
        $this->grantRole(AdminRole::OPERATOR);
        $qariId = $this->grantRole(AdminRole::QARI);

        $entries = $this->getJson('/api/admin/roles?role=qari')->assertOk()->json('entries');

        $this->assertCount(1, $entries);
        $this->assertSame(app(Pseudonymizer::class)->for($qariId), $entries[0]['subjectPseudonym']);
        $this->assertSame(AdminRole::QARI, $entries[0]['role']);
    }

    /** An unrecognized role value is ignored rather than producing a broken
     *  (empty, or SQL-erroring) filter — the closed set is enforced. */
    public function test_an_unrecognized_role_filter_is_ignored(): void
    {
        $this->admin();
        $this->grantRole(AdminRole::OPERATOR);

        $entries = $this->getJson('/api/admin/roles?role=superuser')->assertOk()->json('entries');
        $this->assertCount(1, $entries);
    }

    /**
     * `userId` filter — an operator confirming one specific admin's roles
     * (from a support ticket or the database) narrows to just that user. A
     * raw id, never a pseudonym: pseudonyms are one-way by design and cannot
     * be reversed into a `user_id` to query by — same convention
     * `PurgeLedgerController`/`AdminBillingController` already established.
     */
    public function test_the_userid_filter_narrows_to_one_admin(): void
    {
        $this->admin();
        $this->grantRole(AdminRole::OPERATOR);
        $qariId = $this->grantRole(AdminRole::QARI);

        $entries = $this->getJson("/api/admin/roles?userId={$qariId}")->assertOk()->json('entries');

        $this->assertCount(1, $entries);
        $this->assertSame(app(Pseudonymizer::class)->for($qariId), $entries[0]['subjectPseudonym']);
    }

    /** READ-ONLY BY CONSTRUCTION — mirrors every other admin audit viewer. */
    public function test_the_route_accepts_no_writes(): void
    {
        $this->admin();
        $this->postJson('/api/admin/roles', ['action' => 'forged'])->assertStatus(405);
    }

    /** Never a full-table dump — same hard cap as every other audit viewer. */
    public function test_entries_are_capped(): void
    {
        $this->admin();
        for ($i = 0; $i < 210; $i++) {
            $user = User::factory()->create();
            AdminRole::create([
                'user_id' => $user->id,
                'role' => AdminRole::OPERATOR,
                'granted_at' => 1_700_000_000_000 + $i,
                'granted_by' => 'cli',
            ]);
        }

        $response = $this->getJson('/api/admin/roles')->assertOk();
        $this->assertCount(200, $response->json('entries'));
        $this->assertSame(200, $response->json('limit'));
    }

    /** No roles granted yet must render an empty list, never a crash. */
    public function test_no_roles_yet_renders_an_empty_list(): void
    {
        $this->admin();

        $response = $this->getJson('/api/admin/roles')->assertOk();
        $this->assertSame([], $response->json('entries'));
    }
}
