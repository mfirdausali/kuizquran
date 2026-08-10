<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * v2-D03 (inherited, not superseded): Laravel/Sanctum auth, anonymous-first
 * with account adoption.
 *
 * anonymous() mints a brand-new user + bearer token the moment a device
 * needs to sync, with no email/password prompt. register()/login() let the
 * learner later "adopt" that identity (claim the SAME user row via
 * email+password) or sign in to an existing account from a new device.
 * Tokens are Sanctum personal access tokens (stateless Bearer).
 *
 * New in v3 (step 13, closing DEFECTS.md#B7/#B8's `AUTH-` gap — v2 shipped
 * with no password reset at all): registering fires the email-verification
 * notification, and EnsureIsAdmin (see that middleware) refuses an
 * unverified email regardless of what it claims. Password reset lives in
 * PasswordResetController.
 */
class AuthController extends Controller
{
    public function anonymous(): JsonResponse
    {
        $user = User::create([
            'is_anonymous' => true,
        ]);

        $token = $user->createToken('device')->plainTextToken;

        return response()->json([
            'token' => $token,
            'isAnonymous' => true,
            'anchorHour' => $user->anchor_hour,
            'hasHistory' => false,
        ], 201);
    }

    /** Claim the CURRENTLY authenticated (anonymous) user in place — same
     *  user id, same event history, now reachable by email+password. */
    public function register(Request $request): JsonResponse
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email:rfc', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['required', 'string', 'min:8'],
            'name' => ['nullable', 'string', 'max:255'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }

        $wasVerifiedEmail = $user->email === $request->string('email')->toString() && $user->hasVerifiedEmail();

        $user->update([
            'email' => $request->string('email'),
            'password' => $request->string('password'),
            'name' => $request->input('name'),
            'is_anonymous' => false,
            // A changed (or first-claimed) email always starts unverified —
            // B7's fix depends on this never being silently carried over.
            'email_verified_at' => $wasVerifiedEmail ? now() : null,
        ]);

        if (! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }

        return response()->json([
            'ok' => true,
            'email' => $user->email,
            'isAnonymous' => false,
            'emailVerified' => $user->hasVerifiedEmail(),
        ]);
    }

    /** Sign into an EXISTING adopted account (e.g. a second device). Issues
     *  a fresh token for that account; does not touch the caller's prior
     *  identity — any not-yet-synced local events simply sync under
     *  whichever account is signed in when the outbox next flushes. */
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email:rfc'],
            'password' => ['required', 'string'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }

        $user = User::where('email', $request->string('email'))->first();
        if (! $user || ! $user->password || ! Hash::check($request->string('password'), $user->password)) {
            return response()->json(['error' => 'invalid credentials'], 401);
        }

        $token = $user->createToken('device')->plainTextToken;

        return response()->json([
            'token' => $token,
            'isAnonymous' => (bool) $user->is_anonymous,
            'anchorHour' => $user->anchor_hour,
            // Events table lands at build-plan step 14 (ingestion) — this
            // controller predates it, so hasHistory is honestly false for
            // every user until then, never a guess.
            'hasHistory' => false,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();
        if ($token) {
            $token->delete();
        }

        return response()->json(['ok' => true]);
    }

    /** Restores signed-in state for a stored token. Unauthenticated requests
     *  get Sanctum's standard 401 (the client treats that as "no local
     *  identity yet" and calls POST /auth/anonymous). */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'signedIn' => true,
            'email' => $user->email,
            'anchorHour' => $user->anchor_hour,
            // Events table lands at build-plan step 14 (ingestion) — this
            // controller predates it, so hasHistory is honestly false for
            // every user until then, never a guess.
            'hasHistory' => false,
            'isAnonymous' => (bool) $user->is_anonymous,
            'emailVerified' => $user->hasVerifiedEmail(),
        ]);
    }
}
