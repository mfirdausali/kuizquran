<?php

namespace App\Http\Controllers;

use App\Models\QuestionOverride;
use Illuminate\Http\Request;

/**
 * v2-D21/D55: PUBLIC read of the question-bank override layer — every client
 * (including an anonymous, not-yet-synced device) needs these to build correct
 * questions, so this route is intentionally NOT behind auth:sanctum. Only the
 * admin/qari WRITE path (AdminController::createOverride) is gated.
 */
class OverridesController extends Controller
{
    public function index(Request $request): \Illuminate\Http\JsonResponse
    {
        $surah = (int) $request->query('surah', 12);
        $rows = QuestionOverride::where('surah', $surah)->orderBy('created_at')->get();

        return response()->json(['overrides' => $rows]);
    }
}
