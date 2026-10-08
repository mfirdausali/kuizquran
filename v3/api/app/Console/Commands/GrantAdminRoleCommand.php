<?php

namespace App\Console\Commands;

use App\Models\AccountDeletionRequest;
use App\Models\AdminRole;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Build-plan step 24 (M8): "roles (operator/qari/moderator)". `AdminRole`
 * and `User::hasAdminRole()` existed since the roles/audit migration
 * landed, but no controller, command or seeder anywhere ever created an
 * `admin_roles` row (grep-verified: `AdminRole::create`/`new AdminRole(`
 * had zero hits outside model/test files) — a role that could never be
 * granted could never safely be required, which is why
 * `VerificationsController::store()` could not gate the qari tier on one
 * until this command existed (v3-D92).
 *
 * ROLES ARE THE INNER GATE (the migration's own docblock) — this command
 * cannot admit anyone; the target email must already be in the
 * `ADMIN_EMAILS` outer-gate allowlist and must already have signed in at
 * least once (a real `users` row) before a role can attach to it.
 *
 * v3-D287 named the root enabler of its own exit-code-masking fix but left
 * it unfixed: `AccountController::requestDeletion()` refuses (403) to let
 * an admin SELF-request deletion while holding a role, precisely because
 * `admin_audit.actor_admin_id` is `restrictOnDelete` — but nothing stopped
 * the OTHER ordering: a user requests deletion first, then is later
 * granted a role here, performs one audited action, and collides with the
 * identical `restrictOnDelete` violation when `pdpa:purge-due` runs. A
 * GRANT must therefore refuse while a deletion is pending — a REVOKE must
 * not (it only ever removes a `restrictOnDelete` dependency, never adds
 * one, so it stays available to unwind the very mistake this guard
 * prevents going forward).
 */
class GrantAdminRoleCommand extends Command
{
    protected $signature = 'admin:grant-role
        {email : an ALREADY-ALLOWLISTED admin (ADMIN_EMAILS) to grant the role to}
        {role : operator|qari|moderator}
        {--revoke : remove the role instead of granting it}
        {--by= : who is granting this, recorded in the audit column (defaults to "cli")}';

    protected $description = 'Grant or revoke an admin role — operator/qari/moderator (build-plan step 24, v3-D92)';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        $role = (string) $this->argument('role');

        if (! in_array($role, AdminRole::ALL, true)) {
            $this->error("unknown role '{$role}' — must be one of: ".implode(', ', AdminRole::ALL));

            return self::FAILURE;
        }

        $allow = config('admin.emails', []);
        if ($email === '' || ! in_array($email, $allow, true)) {
            $this->error("{$email} is not in the ADMIN_EMAILS allowlist — a role refines an already-allowlisted admin, it never grants admission");

            return self::FAILURE;
        }

        $user = User::where('email', $email)->first();
        if (! $user) {
            $this->error("no user row for {$email} yet — they must sign in (or register) at least once before a role can attach");

            return self::FAILURE;
        }

        if ($this->option('revoke')) {
            $deleted = AdminRole::where('user_id', $user->id)->where('role', $role)->delete();
            $this->line($deleted > 0 ? "revoked {$role} from {$email}" : "{$email} did not hold {$role} — nothing to revoke");

            return self::SUCCESS;
        }

        if (AccountDeletionRequest::where('user_id', $user->id)->exists()) {
            $this->error("{$email} has a pending PDPA deletion request — granting a role would create a new admin_audit.actor_admin_id restrictOnDelete dependency that pdpa:purge-due cannot satisfy; revoke or wait for the deletion to resolve first");

            return self::FAILURE;
        }

        $existing = AdminRole::where('user_id', $user->id)->where('role', $role)->first();
        if ($existing) {
            $this->line("{$email} already holds {$role} (granted ".$existing->granted_at.')');

            return self::SUCCESS;
        }

        AdminRole::create([
            'user_id' => $user->id,
            'role' => $role,
            'granted_at' => (int) round(microtime(true) * 1000),
            'granted_by' => $this->option('by') ?? 'cli',
        ]);
        $this->line("granted {$role} to {$email}");

        return self::SUCCESS;
    }
}
