<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * DEFECTS.md#B7's close condition: "email verification ships and a test
 * asserts an unverified email cannot pass EnsureIsAdmin." This controller is
 * the ship; EnsureIsAdmin (already gating on hasVerifiedEmail()) is the
 * assertion made real.
 */
class EmailVerificationController extends Controller
{
    /** Signed link target from the notification email — see
     *  AppServiceProvider for why this is a plain JSON API response rather
     *  than a frontend redirect (apps/web doesn't exist yet). */
    public function verify(EmailVerificationRequest $request): JsonResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return response()->json(['ok' => true, 'alreadyVerified' => true]);
        }

        $request->fulfill();

        return response()->json(['ok' => true, 'alreadyVerified' => false]);
    }

    public function resend(Request $request): JsonResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return response()->json(['ok' => true, 'alreadyVerified' => true]);
        }

        $request->user()->sendEmailVerificationNotification();

        return response()->json(['ok' => true, 'alreadyVerified' => false]);
    }
}
