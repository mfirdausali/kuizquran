<?php

namespace App\Http\Controllers;

use App\Models\AccountDeletionRequest;
use App\Models\BillingEvent;
use App\Models\Entitlement;
use App\Models\EntitlementTransition;
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
     *
     * v3-D157: `PurgeDueAccountsCommand`'s own docblock names exactly what a
     * purge touches for this same user — "Cascades: events, entitlements,
     * entitlement_transitions... Nulls: billing_events.user_id" — but this
     * export stopped at `events` alone, for over 30 nightly runs, even
     * though `entitlements`/`entitlement_transitions`/`billing_events` are
     * every bit as much this learner's own data (a real `user_id` FK on
     * each) as their event log is. The DELETE half of this same PDPA
     * feature already treats all four tables as "this user's data"; the
     * EXPORT half silently did not. `App\Models\Entitlement`'s own docblock
     * warns any reader reaching for it to stop and consider
     * `EntitlementBoundaryTest` (edge case #124: the log is truth,
     * enforcement lives at issuance/corpus only) — that guard is about
     * ISSUANCE/INGESTION never reading entitlement to decide what a learner
     * gets, not about a read-only compliance export reflecting it back to
     * its own owner, so this file was added to that allowlist deliberately,
     * as a reviewed act, not worked around.
     */
    public function export(Request $request): JsonResponse
    {
        $user = $request->user();

        $entitlement = Entitlement::where('user_id', $user->id)->first();

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
            // than failing silent. The same exclusion discipline applies to
            // every table below.
            'events' => Event::where('user_id', $user->id)
                ->orderBy('id')
                ->get()
                ->map(fn (Event $e) => collect($e->toArray())->except(['id', 'user_id'])->all())
                ->values(),
            // The DERIVED current state — null for a learner who has never
            // started a trial or been billed, never a fabricated "none" row.
            'entitlement' => $entitlement
                ? collect($entitlement->toArray())->except(['id', 'user_id'])->all()
                : null,
            // The append-only history of every state change this learner's
            // entitlement has ever gone through.
            'entitlementTransitions' => EntitlementTransition::where('user_id', $user->id)
                ->orderBy('id')
                ->get()
                ->map(fn (EntitlementTransition $t) => collect($t->toArray())->except(['id', 'user_id'])->all())
                ->values(),
            // The raw webhook journal for events attributed to this learner.
            // `user_id` is nullable on this table (an event that could not be
            // attributed to anyone) — the `where` scope naturally excludes
            // those rows, which is correct: they are nobody's data to export.
            'billingEvents' => BillingEvent::where('user_id', $user->id)
                ->orderBy('id')
                ->get()
                ->map(fn (BillingEvent $b) => collect($b->toArray())->except(['id', 'user_id'])->all())
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
