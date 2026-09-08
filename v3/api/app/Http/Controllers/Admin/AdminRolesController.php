<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * THE ADMIN ROLES VIEWER — the read half of `admin_roles`.
 *
 * `admin_roles` has a real writer, `GrantAdminRoleCommand` (`admin:grant-role`,
 * build-plan step 24/v3-D92 — the ONLY code path anywhere that ever creates a
 * row: `AdminRole::create`/`new AdminRole(` has zero hits outside that
 * command, the model itself, and tests), and zero readers anywhere under
 * `app/` before this controller — the same "written, zero read surface" shape
 * v3-D129/D130/D141/D142 each closed for `admin_audit`/`flag_ramp_audit`/
 * `entitlement_transitions`/`purge_ledger`. `GET /api/admin/whoami` reads
 * `$user->adminRoles()`, but that is the CALLER's own roles only (consumed
 * solely to disable the qari-signature radio for a non-qari admin, v3-D131) —
 * nothing anywhere lets one admin see the FULL roster of who holds which
 * role, when it was granted, or by whom. Since `tier: qari` is the one
 * security-gated action this app has (`VerificationsController::store()`,
 * v3-D92), an operator auditing "who currently holds qari access" had a
 * database console and nothing else.
 *
 * READ-ONLY BY CONSTRUCTION. No route is registered for anything but GET —
 * granting/revoking a role stays a CLI-only human action
 * (`admin:grant-role`/`--revoke`), the same discipline
 * `NightlyWindowController`'s own header applies to declaring the 7-night
 * window.
 *
 * THE SUBJECT IS PSEUDONYMIZED, NOT THE RAW `user_id`. `admin_roles.user_id`
 * is a raw FK to `users`; returning it verbatim would make this the ONE
 * screen that deanonymizes an admin's own identity to every OTHER admin who
 * can load it — the same HMAC `Pseudonymizer` every other admin surface
 * applies to an actor/subject id (`AdminAuditController`'s `actor_admin_id`,
 * `PurgeLedgerController`'s `user_id`) is applied here too.
 *
 * `granted_by` is NOT a `users` FK — it is the free-text `--by=` option
 * `GrantAdminRoleCommand` records (an email typed by whoever ran the grant,
 * or the literal string `"cli"` when omitted). It passes through verbatim,
 * the same "an admin's own self-supplied operational string, not a `users`
 * id" treatment `AdminAuditController` already gives `ip`/`request_id`.
 *
 * TWO FILTERS, both applied at the SQL layer, before pseudonymizing:
 * `role` narrows to one of the closed-set roles (the operationally useful
 * one — "who currently holds qari"); `userId` narrows to one raw admin id,
 * the same "an operator has the raw id from elsewhere, never a pseudonym,
 * which is one-way by design and cannot be reversed to filter by"
 * convention `PurgeLedgerController`/`AdminBillingController` already
 * established.
 */
class AdminRolesController extends Controller
{
    public function __construct(private readonly Pseudonymizer $pseudonymizer) {}

    /** A hard cap, not a "page 1 of N" pagination UI — mirrors every other
     *  admin audit viewer's recent-activity-review scope discipline. */
    private const MAX_ENTRIES = 200;

    public function index(Request $request): JsonResponse
    {
        $query = AdminRole::query()->orderByDesc('granted_at')->orderByDesc('id');

        $role = $request->input('role');
        if (is_string($role) && in_array($role, AdminRole::ALL, true)) {
            $query->where('role', $role);
        }

        $userId = $request->input('userId');
        if ($userId !== null && $userId !== '' && ctype_digit((string) $userId)) {
            $query->where('user_id', (int) $userId);
        }

        $rows = $query->limit(self::MAX_ENTRIES)->get();

        return response()->json([
            'entries' => $rows->map(fn (AdminRole $row) => [
                'subjectPseudonym' => $this->pseudonymizer->for($row->user_id),
                'role' => $row->role,
                'grantedAt' => $row->granted_at,
                'grantedBy' => $row->granted_by,
            ])->values(),
            'limit' => self::MAX_ENTRIES,
        ]);
    }
}
