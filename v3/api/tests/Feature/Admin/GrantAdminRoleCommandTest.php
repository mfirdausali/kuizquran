<?php

namespace Tests\Feature\Admin;

use App\Console\Commands\GrantAdminRoleCommand;
use App\Models\AdminRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * Build-plan step 24 (M8) / v3-D92. `AdminRole` and `User::hasAdminRole()`
 * existed since the roles migration landed, but no code path anywhere ever
 * created an `admin_roles` row — a role that could never be granted could
 * never safely be required. This command is that missing path, the
 * precondition for `VerificationsController::store()` gating the qari tier
 * on `AdminRole::QARI`.
 */
class GrantAdminRoleCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('admin.emails', ['admin@example.com']);
    }

    public function test_it_grants_a_role_to_an_allowlisted_admin(): void
    {
        $user = User::factory()->create(['email' => 'admin@example.com']);

        $this->artisan(GrantAdminRoleCommand::class, ['email' => 'admin@example.com', 'role' => 'qari'])
            ->assertSuccessful();

        $this->assertTrue($user->fresh()->hasAdminRole(AdminRole::QARI));
        $row = AdminRole::where('user_id', $user->id)->where('role', AdminRole::QARI)->first();
        $this->assertNotNull($row);
        $this->assertSame('cli', $row->granted_by);
    }

    /** Roles are the INNER gate — the migration's own docblock. Granting one
     *  to an email outside ADMIN_EMAILS must never quietly create admission. */
    public function test_it_refuses_an_email_outside_the_admin_allowlist(): void
    {
        $user = User::factory()->create(['email' => 'not-admin@example.com']);

        $this->artisan(GrantAdminRoleCommand::class, ['email' => 'not-admin@example.com', 'role' => 'qari'])
            ->assertFailed();

        $this->assertFalse($user->fresh()->hasAdminRole(AdminRole::QARI));
    }

    public function test_it_refuses_an_unknown_role(): void
    {
        User::factory()->create(['email' => 'admin@example.com']);

        $this->artisan(GrantAdminRoleCommand::class, ['email' => 'admin@example.com', 'role' => 'superuser'])
            ->assertFailed();

        $this->assertSame(0, AdminRole::count());
    }

    public function test_it_refuses_an_email_with_no_user_row_yet(): void
    {
        Config::set('admin.emails', ['admin@example.com', 'ghost@example.com']);

        $this->artisan(GrantAdminRoleCommand::class, ['email' => 'ghost@example.com', 'role' => 'qari'])
            ->assertFailed();

        $this->assertSame(0, AdminRole::count());
    }

    public function test_it_is_idempotent_regranting_the_same_role(): void
    {
        $user = User::factory()->create(['email' => 'admin@example.com']);

        $this->artisan(GrantAdminRoleCommand::class, ['email' => 'admin@example.com', 'role' => 'qari'])->assertSuccessful();
        $this->artisan(GrantAdminRoleCommand::class, ['email' => 'admin@example.com', 'role' => 'qari'])->assertSuccessful();

        $this->assertSame(1, AdminRole::where('user_id', $user->id)->where('role', AdminRole::QARI)->count());
    }

    public function test_it_revokes_a_role(): void
    {
        $user = User::factory()->create(['email' => 'admin@example.com']);
        AdminRole::create([
            'user_id' => $user->id, 'role' => AdminRole::QARI,
            'granted_at' => 1, 'granted_by' => 'test-fixture',
        ]);

        $this->artisan(GrantAdminRoleCommand::class, ['email' => 'admin@example.com', 'role' => 'qari', '--revoke' => true])
            ->assertSuccessful();

        $this->assertFalse($user->fresh()->hasAdminRole(AdminRole::QARI));
    }

    /** A revoke with nothing to revoke is a genuine no-op, not an error —
     *  the same discipline PurgeDueAccountsCommand uses for "nothing due". */
    public function test_revoking_a_role_never_held_is_a_no_op_not_a_failure(): void
    {
        User::factory()->create(['email' => 'admin@example.com']);

        $this->artisan(GrantAdminRoleCommand::class, ['email' => 'admin@example.com', 'role' => 'qari', '--revoke' => true])
            ->assertSuccessful();

        $this->assertSame(0, AdminRole::count());
    }

    /** MUTATION-anchor: a role holding more than one role at once is real
     *  (the migration's own comment: "the qari who also moderates"). */
    public function test_an_admin_may_hold_more_than_one_role(): void
    {
        $user = User::factory()->create(['email' => 'admin@example.com']);

        $this->artisan(GrantAdminRoleCommand::class, ['email' => 'admin@example.com', 'role' => 'qari'])->assertSuccessful();
        $this->artisan(GrantAdminRoleCommand::class, ['email' => 'admin@example.com', 'role' => 'moderator'])->assertSuccessful();

        $this->assertTrue($user->fresh()->hasAdminRole(AdminRole::QARI));
        $this->assertTrue($user->fresh()->hasAdminRole(AdminRole::MODERATOR));
        $this->assertFalse($user->fresh()->hasAdminRole(AdminRole::OPERATOR));
    }
}
