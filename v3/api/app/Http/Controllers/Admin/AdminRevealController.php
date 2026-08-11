<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAudit;
use App\Models\AdminRevealToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Build-plan step 24 (M8). REVEAL IDENTITY.
 *
 * WIREFRAME §16: "Email and name sit behind a Reveal identity action requiring a
 * typed reason, audit-logged, auto-re-masking after 15 minutes."
 *
 * THREE properties that are easy to get subtly wrong:
 *
 *  1. THE AUDIT ROW IS WRITTEN BEFORE THE IDENTITY IS RETURNED, in the same
 *     transaction. Writing it after means a crash (or a thrown exception in
 *     serialization) reveals an identity that was never recorded — the one
 *     ordering that makes the audit log incomplete.
 *
 *  2. THE TTL IS SERVER-SIDE (edge case #147). `expires_at` comes from config,
 *     never from the request. A client-supplied expiry is a suggestion an
 *     attacker writes.
 *
 *  3. AN ANONYMOUS SUBJECT STILL AUDITS (edge case #148). Returning a 404 for an
 *     anonymous account would (a) leak that the account is anonymous and (b) skip
 *     the audit row — so an operator could probe every user id, unlogged.
 */
class AdminRevealController extends Controller
{
    public function __construct(private readonly Pseudonymizer $pseudonymizer) {}

    public function reveal(Request $request, int $userId): JsonResponse
    {
        $admin = $request->user();
        $reasonCode = (string) $request->input('reason_code', '');
        $reasonText = trim((string) $request->input('reason_text', ''));

        if (! in_array($reasonCode, AdminAudit::REASON_CODES, true)) {
            return response()->json([
                'error' => 'reason_code must be one of: '.implode(', ', AdminAudit::REASON_CODES),
            ], 422);
        }
        if (mb_strlen($reasonText) < 10) {
            return response()->json(['error' => 'reason_text must be at least 10 characters'], 422);
        }

        // Edge case #149: warn on PII in free text BEFORE committing. An
        // append-only row containing a real name is unpurgeable.
        $piiWarnings = AdminAudit::scanFreeText($reasonText);
        if ($piiWarnings !== [] && ! $request->boolean('acknowledge_pii_warning')) {
            return response()->json([
                'error' => 'reason_text appears to contain identifying information',
                'detected' => $piiWarnings,
                'hint' => 'Reference the pseudonym, not the person. Re-submit with acknowledge_pii_warning=true if this is intentional.',
            ], 422);
        }

        $subject = User::find($userId);
        $nowMs = (int) round(microtime(true) * 1000);
        $pseudonym = $this->pseudonymizer->for($userId);

        return DB::transaction(function () use ($admin, $subject, $userId, $pseudonym, $reasonCode, $reasonText, $nowMs, $request) {
            // (1) AUDIT FIRST — always, including for a missing or anonymous
            // subject. This is what makes id-probing visible.
            AdminAudit::create([
                'actor_admin_id' => $admin->id,
                'action' => 'reveal_identity',
                'subject_pseudonym' => $pseudonym,
                'reason_code' => $reasonCode,
                'reason_text' => $reasonText,
                'at' => $nowMs,
                'ip' => $request->ip(),
                'request_id' => $request->header('X-Request-Id'),
            ]);

            if (! $subject) {
                return response()->json(['pseudonym' => $pseudonym, 'identity' => null, 'reason' => 'no such account'], 404);
            }

            // (3) EDGE CASE #148: an anonymous account has no identity to reveal.
            // A DEFINED response, not a 404, and the audit row above is already
            // written.
            if ($subject->email === null) {
                return response()->json([
                    'pseudonym' => $pseudonym,
                    'identity' => null,
                    'reason' => 'anonymous — no identity held',
                ]);
            }

            // (2) SERVER-SIDE TTL.
            $ttl = (int) config('admin.reveal_ttl_seconds', 900);
            $token = bin2hex(random_bytes(24));
            AdminRevealToken::create([
                'admin_id' => $admin->id,
                'subject_user_id' => $subject->id,
                'token' => $token,
                'expires_at' => $nowMs + ($ttl * 1000),
                'created_at_ms' => $nowMs,
            ]);

            return response()->json([
                'pseudonym' => $pseudonym,
                'identity' => ['email' => $subject->email, 'name' => $subject->name],
                'revealToken' => $token,
                // Advisory only — the server enforces its own copy.
                'expiresAt' => $nowMs + ($ttl * 1000),
            ]);
        });
    }

    /**
     * Re-check a reveal token. The server decides expiry; a client that never
     * re-masks is refused here.
     *
     * ══════════════════════════════════════════════════════════════════════════
     * THE TOKEN IS BOUND TO THE ADMIN WHO MINTED IT (M10 security review).
     *
     * This previously looked the token up by value alone. Every admin is behind
     * the same allowlist, so any operator holding another operator's token could
     * keep it alive — and, more importantly, `reveal` writes ONE audit row at
     * mint time naming ONE actor. A second operator extending someone else's
     * reveal produced no row of their own, so the audit log recorded a reveal by
     * an operator who was no longer the one holding the identity. That is an
     * audit-completeness failure, which is the property this whole surface
     * exists to guarantee.
     *
     * Scoping the lookup to `admin_id` makes the token useless to anyone but its
     * minter, and keeps "who held this identity, and when" answerable from the
     * audit log alone.
     * ══════════════════════════════════════════════════════════════════════════
     *
     * The refusal is deliberately IDENTICAL for expired, unknown, and
     * belongs-to-another-admin. Distinguishing them would turn this route into
     * an oracle for "is this a live token?" — the same oracle reasoning that
     * governs `AdminAuthController::deny()`.
     */
    public function check(Request $request, string $token): JsonResponse
    {
        $row = AdminRevealToken::where('token', $token)
            ->where('admin_id', $request->user()->id)
            ->first();
        $nowMs = (int) round(microtime(true) * 1000);

        if (! $row || $row->isExpired($nowMs)) {
            return response()->json(['valid' => false, 'reason' => 'expired or unknown'], 403);
        }

        return response()->json(['valid' => true, 'expiresAt' => $row->expires_at]);
    }
}
