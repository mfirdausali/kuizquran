<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The one persisted learner preference: a daily anchor hour (a secular time
 * of day the learner picks for their own reference — never a prayer name,
 * D16/D34's naming rule). Ported from v2's `SettingsController` verbatim —
 * v2's own header called this "FR9 parity" and it stayed true here.
 *
 * `anchor_hour` (the User column) and `anchorHour` (returned on every
 * identity response — `AuthController::anonymous()`/`login()`/`me()`) have
 * existed since the Laravel skeleton landed (build-plan step 13), and the
 * pure engine half (`daybound.ts#anchorTime()`) has existed since the port
 * (step 5). Neither had a WRITE path anywhere in `v3/api` until this file —
 * a learner's anchor could only ever read the column default (4.5), never
 * change it. This is that missing write half; see DECISIONS.md v3-D140 for
 * the full write-up, including why this stayed a Settings-only surface
 * rather than an onboarding question (WIREFRAME §17: onboarding captures
 * only what changes the scheduler tomorrow, and `anchorHour` provably does
 * not — grep-confirmed, `cfg.anchorHour` has exactly one reader anywhere in
 * `packages/engine/src`, `anchorTime()` itself).
 *
 * Session-gated via Sanctum; the user id always comes from the token, never
 * the request body — same discipline as every other self-service route in
 * `AccountController`.
 */
class SettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['anchorHour' => $request->user()->anchor_hour]);
    }

    public function update(Request $request): JsonResponse
    {
        $anchorHour = $request->input('anchorHour');
        if (! is_numeric($anchorHour) || $anchorHour < 0 || $anchorHour >= 24) {
            return response()->json(['error' => 'anchorHour (number, 0-24) required'], 400);
        }

        $user = $request->user();
        $user->anchor_hour = (float) $anchorHour;
        $user->save();

        return response()->json(['ok' => true, 'anchorHour' => $user->anchor_hour]);
    }
}
