<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Build-plan step 24 (M8). ADMIN LOGIN — FAILS CLOSED, NO ORACLE.
 *
 * WIREFRAME §16, verbatim:
 *
 *   "Wrong password and not-on-the-allowlist return the SAME generic error:
 *    'Not authorized for operator access.' No signup link, no reset link, no hint
 *    which failed. Otherwise the login form becomes a free oracle for 'is this
 *    address an admin?'"
 *
 * FOUR failure cases must be INDISTINGUISHABLE — same status, same body, same
 * headers, and the same TIMING:
 *   1. no such account
 *   2. correct account, wrong password
 *   3. correct password, not on the allowlist
 *   4. correct password, allowlisted, but unverified email
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE PART MOST IMPLEMENTATIONS MISS: the password hash must be verified EVEN
 * WHEN the account does not exist or is not allowlisted.
 *
 * A naive implementation returns early on "no such user", skipping bcrypt — and
 * bcrypt at cost 12 takes ~250ms while an early return takes ~1ms. That 250x
 * timing difference IS the oracle, reintroduced through the side channel after
 * being carefully closed in the response body. So: always hash, always compare,
 * against a dummy hash when there is no real one.
 * ══════════════════════════════════════════════════════════════════════════════
 */
class AdminAuthController extends Controller
{
    /** The ONE error. Never varied, never elaborated. */
    public const GENERIC_ERROR = 'Not authorized for operator access.';

    /**
     * A real bcrypt hash of a value nobody knows, used to burn the same CPU on the
     * no-such-user path that a real verification would. Generated once per boot.
     */
    private static ?string $dummyHash = null;

    private function dummyHash(): string
    {
        // Cost must MATCH the app's configured cost, or the timings still differ.
        return self::$dummyHash ??= Hash::make(bin2hex(random_bytes(16)));
    }

    public function login(Request $request): JsonResponse
    {
        $email = strtolower(trim((string) $request->input('email', '')));
        $password = (string) $request->input('password', '');

        $user = $email === '' ? null : User::where('email', $email)->first();

        // ALWAYS run the hash comparison, whether or not a user exists. This is
        // the timing-oracle fix and it must never become conditional.
        $hash = $user?->password ?? $this->dummyHash();
        $passwordOk = Hash::check($password, $hash);

        $allow = config('admin.emails', []);
        $allowlisted = $email !== '' && in_array($email, $allow, true);
        $verified = $user?->hasVerifiedEmail() ?? false;

        // Every condition is evaluated; the branch happens ONCE, at the end, so no
        // path returns earlier than another.
        if (! $user || ! $passwordOk || ! $allowlisted || ! $verified) {
            return $this->deny();
        }

        $token = $user->createToken('admin-console', ['admin'])->plainTextToken;

        return response()->json([
            'token' => $token,
            'pseudonym' => app(Pseudonymizer::class)->for($user->id),
            'roles' => $user->adminRoles(),
        ]);
    }

    /**
     * The single denial. Identical status, body and headers for all four cases.
     *
     * NOTE there is no `signup` or `reset` link anywhere in this response, per
     * §16 — those would tell an attacker the address exists.
     */
    private function deny(): JsonResponse
    {
        return response()->json(['error' => self::GENERIC_ERROR], 403);
    }

    /**
     * `GET /api/admin/whoami` — sits behind the SAME `admin` middleware chain
     * (`auth:sanctum` + `EnsureIsAdmin`) as every real admin read/write, so a
     * 200 here is not a separate, weaker claim of "admin" — it is the exact
     * gate the workbench and every `/settings/*` screen already depend on.
     *
     * Built for the CLIENT-SIDE admin gate: every admin screen's own docblock
     * has said, since v3-D92, that a redirect with no real check behind it
     * would be "security theatre." This is that check — a real 401/403 from
     * the real gate, never a client-invented flag.
     */
    public function whoami(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'pseudonym' => app(Pseudonymizer::class)->for($user->id),
            'roles' => $user->adminRoles(),
        ]);
    }
}
