<?php

namespace App\Http\Controllers;

use App\Models\AccountDeletionRequest;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Build-plan step 23 (M7): "PDPA export/delete/restore(-with-token) + purge
 * cascades" — LAUNCH-CHECKLIST.md gate 19, previously entirely unbuilt.
 *
 * SELF-SERVICE ONLY. There is no admin-triggered delete anywhere in this
 * controller or the admin console — v3-D16's "charge for access, never for
 * the memory itself" reasoning applies just as hard to the account as to a
 * lapsed entitlement. A learner deletes their own account; nobody deletes it
 * for them.
 *
 * THE GRACE WINDOW IS THE WHOLE SAFETY MECHANISM. `requestDeletion()` never
 * deletes anything — it schedules a purge `config('pdpa.deletion_grace_days')`
 * out and hands back a one-time token. `restoreDeletion()` is the undo.
 * `PurgeDueAccountsCommand` (run nightly, see routes/console.php) is the only
 * code path that actually removes a row, and only once the window has
 * elapsed with no restore.
 */
class AccountController extends Controller
{
    /**
     * PDPA "right to access" — the learner's own data, nothing else. Scoped
     * to `$request->user()->id` throughout; there is no id parameter to
     * mistake for someone else's account.
     */
    public function export(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'exportedAt' => now()->toIso8601String(),
            'account' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'isAnonymous' => (bool) $user->is_anonymous,
                'createdAt' => $user->created_at?->toIso8601String(),
                'emailVerifiedAt' => $user->email_verified_at?->toIso8601String(),
            ],
            // EVERY column except the internal ingest sequence and the
            // user_id (redundant — this whole array is scoped to one user).
            // Enumerated by EXCLUSION rather than an allowlist on purpose:
            // an allowlist silently drops a future column and ships a
            // PDPA export that quietly stops being complete; an excludelist
            // fails loud (a new PII-shaped column shows up in the export
            // immediately, for a human to notice and decide about) rather
            // than failing silent.
            'events' => Event::where('user_id', $user->id)
                ->orderBy('id')
                ->get()
                ->map(fn (Event $e) => collect($e->toArray())->except(['id', 'user_id'])->all())
                ->values(),
        ]);
    }

    /** Whether a deletion is pending, and when it purges — no secret in the response. */
    public function deletionStatus(Request $request): JsonResponse
    {
        $pending = AccountDeletionRequest::where('user_id', $request->user()->id)->first();

        if (! $pending) {
            return response()->json(['pending' => false]);
        }

        return response()->json([
            'pending' => true,
            'requestedAt' => $pending->requested_at_ms,
            'purgeAt' => $pending->purge_at_ms,
        ]);
    }

    /**
     * Schedule a purge. Refuses (409) if one is already pending — the token
     * already handed out is the only valid cancel path, and re-issuing one
     * on every call would let a caller silently push the purge date forward
     * or backward on each request.
     *
     * Refuses (403) if the caller holds any admin role: `admin_audit.
     * actor_admin_id` is `restrictOnDelete` (see the M8 migration) precisely
     * because an audit trail must survive the actor who wrote it — an admin
     * self-deleting would either corrupt that guarantee or fail the purge
     * job with a raw FK error later. Refusing up front, with a clear reason,
     * is strictly better than either.
     */
    public function requestDeletion(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->adminRoles() !== []) {
            return response()->json([
                'error' => 'admin accounts cannot self-delete while they hold an audit trail (admin_audit.actor_admin_id) — revoke the admin role first',
            ], 403);
        }

        if (AccountDeletionRequest::where('user_id', $user->id)->exists()) {
            return response()->json(['error' => 'a deletion is already pending; restore it before requesting again'], 409);
        }

        $nowMs = (int) round(microtime(true) * 1000);
        $graceDays = (int) config('pdpa.deletion_grace_days', 14);
        $purgeAtMs = $nowMs + ($graceDays * 86400 * 1000);

        $token = bin2hex(random_bytes(32));

        AccountDeletionRequest::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $token),
            'requested_at_ms' => $nowMs,
            'purge_at_ms' => $purgeAtMs,
        ]);

        return response()->json([
            'ok' => true,
            // Shown exactly once — never stored raw, never re-derivable.
            'restoreToken' => $token,
            'requestedAt' => $nowMs,
            'purgeAt' => $purgeAtMs,
        ], 201);
    }

    /**
     * Cancel a pending deletion. The token must belong to THIS user's own
     * pending request — scoped by `user_id` in the same query, never by
     * token value alone (the exact shape of the M10 reveal-token finding,
     * S1: a token usable by anyone who obtains it, not only its owner,
     * defeats the point of requiring one at all).
     */
    public function restoreDeletion(Request $request): JsonResponse
    {
        $token = (string) $request->input('token', '');
        if ($token === '') {
            return response()->json(['error' => 'token is required'], 422);
        }

        $pending = AccountDeletionRequest::where('user_id', $request->user()->id)->first();

        if (! $pending || ! hash_equals($pending->token_hash, hash('sha256', $token))) {
            return response()->json(['error' => 'no matching pending deletion'], 404);
        }

        $pending->delete();

        return response()->json(['ok' => true, 'restored' => true]);
    }
}
