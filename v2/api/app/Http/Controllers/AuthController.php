<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * v2-D03: Laravel/Sanctum auth, anonymous-first with account adoption.
 *
 * anonymous() mints a brand-new user + bearer token the moment a device needs
 * to sync, with no email/password prompt. register()/login() let the learner
 * later "adopt" that identity (claim the SAME user row via email+password) or
 * sign in to an existing account from a new device. Tokens are Sanctum
 * personal access tokens (stateless Bearer, not the cookie/SPA guard) — see
 * v2-D51: the app is a decoupled Vite SPA, not a first-party Laravel view, so
 * the stateful cookie flow would need CSRF + same-site config for no benefit
 * over a bearer token the browser never auto-attaches.
 */
class AuthController extends Controller
{
    public function anonymous(): \Illuminate\Http\JsonResponse
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

    /** Claim the CURRENTLY authenticated (anonymous) user in place — same user
     *  id, same event history, now reachable by email+password. */
    public function register(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['required', 'string', 'min:8'],
            'name' => ['nullable', 'string', 'max:255'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }

        $user->update([
            'email' => $request->string('email'),
            'password' => $request->string('password'),
            'name' => $request->input('name'),
            'is_anonymous' => false,
        ]);

        return response()->json([
            'ok' => true,
            'email' => $user->email,
            'isAnonymous' => false,
        ]);
    }

    /** Sign into an EXISTING adopted account (e.g. a second device). Issues a
     *  fresh token for that account; does not touch the caller's prior identity —
     *  any not-yet-synced local events will simply sync under whichever account
     *  is signed in when the outbox next flushes (server never trusts a
     *  client-supplied user id, matching v1's session-derived uid). */
    public function login(Request $request): \Illuminate\Http\JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email'],
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
            'hasHistory' => $user->events()->exists(),
        ]);
    }

    public function logout(Request $request): \Illuminate\Http\JsonResponse
    {
        $token = $request->user()->currentAccessToken();
        if ($token) {
            $token->delete();
        }

        return response()->json(['ok' => true]);
    }

    /** Restores signed-in state for a stored token — mirrors v1's GET /me
     *  (email/anchorHour/hasHistory), plus isAnonymous. Unauthenticated requests
     *  get Sanctum's standard 401 (the client treats that as "no local identity
     *  yet" and calls POST /auth/anonymous). */
    public function me(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'signedIn' => true,
            'email' => $user->email,
            'anchorHour' => $user->anchor_hour,
            'hasHistory' => $user->events()->exists(),
            'isAnonymous' => (bool) $user->is_anonymous,
        ]);
    }
}
