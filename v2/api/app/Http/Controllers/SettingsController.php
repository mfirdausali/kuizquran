<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

/** FR9 parity: the one persisted setting is the daily anchor hour (secular
 *  time anchor, not a prayer name). Session-gated via Sanctum; user id never
 *  comes from the body. */
class SettingsController extends Controller
{
    public function show(Request $request): \Illuminate\Http\JsonResponse
    {
        return response()->json(['anchorHour' => $request->user()->anchor_hour]);
    }

    public function update(Request $request): \Illuminate\Http\JsonResponse
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
