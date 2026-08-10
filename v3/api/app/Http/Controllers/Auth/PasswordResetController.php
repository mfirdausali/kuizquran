<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password as PasswordRule;

/**
 * DEFECTS.md#B7/#B8 (`AUTH-`): v2 shipped with no password reset at all —
 * "an RM500 lifetime buyer who forgets their password loses everything"
 * (CLAUDE.md's corruption-risk ordering: AUTH- closes before any PAY- task).
 * Uses Laravel's own token broker (password_reset_tokens table, already in
 * the base migration) rather than a bespoke implementation.
 */
class PasswordResetController extends Controller
{
    public function sendResetLink(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email:rfc'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }

        // Deliberately uniform response regardless of whether the email
        // exists — enumeration would let an attacker map ADMIN_EMAILS
        // addresses to registered accounts (same spirit as B7's fix).
        Password::sendResetLink($request->only('email'));

        return response()->json(['ok' => true]);
    }

    public function reset(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'token' => ['required', 'string'],
            'email' => ['required', 'email:rfc'],
            'password' => ['required', 'string', 'confirmed', PasswordRule::min(8)],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                // A reset proves control of the mailbox — B8's "revoked
                // token permanently disables sync" failure mode is exactly
                // what this closes: every existing bearer token dies with
                // the old password, and the reset response mints a fresh
                // one so the device recovers without hand-clearing storage.
                $user->tokens()->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['error' => __($status)], 422);
        }

        $user = User::where('email', $request->string('email'))->firstOrFail();
        $token = $user->createToken('device')->plainTextToken;

        return response()->json(['ok' => true, 'token' => $token]);
    }
}
