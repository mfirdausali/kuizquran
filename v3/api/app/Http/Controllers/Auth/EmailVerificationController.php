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
    /** Signed link target the notification email's VerifyEmail closure
     *  (AppServiceProvider) routes through apps/web's own `/verify-email`
     *  page (v3-D155), which calls this endpoint directly, attaching the
     *  device's own Bearer token via apiFetch — so a plain JSON response is
     *  correct: the frontend page is the caller here, never the email
     *  client itself. */
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
