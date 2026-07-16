<?php

namespace App\Http\Controllers;

use App\Models\AyahVerification;
use App\Models\QuestionOverride;
use App\Models\User;
use App\Services\AdminMetrics;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * v2-D54/ROADMAP Phase 6: the operator admin console. Every route here sits
 * behind ['auth:sanctum','admin'] (routes/api.php) — read-only except the two
 * explicit operator actions (mark-verified, create-override), matching v1's
 * "no mutation routes... except FR8's own" posture but extended for the
 * override editor v2-D21 adds.
 */
class AdminController extends Controller
{
    public function __construct(private AdminMetrics $metrics) {}

    public function metrics(): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'metrics' => $this->metrics->all(),
            'confusionPairs' => $this->metrics->confusionPairs(10),
        ]);
    }

    public function users(): \Illuminate\Http\JsonResponse
    {
        $users = User::withCount('events')->orderByDesc('events_count')->get();

        return response()->json([
            'users' => $users->map(fn (User $u) => [
                'id' => $u->id,
                'email' => $u->email,
                'isAnonymous' => (bool) $u->is_anonymous,
                'events' => $u->events_count,
            ]),
        ]);
    }

    public function user(int $id): \Illuminate\Http\JsonResponse
    {
        $user = User::find($id);
        if (! $user) {
            return response()->json(['error' => 'not found'], 404);
        }

        return response()->json($this->metrics->userDrillDown($user));
    }

    public function frontier(Request $request): \Illuminate\Http\JsonResponse
    {
        $validated = $request->validate([
            'surah' => ['required', 'integer', 'min:1'],
            'ayahCount' => ['required', 'integer', 'min:1'],
        ]);

        return response()->json($this->metrics->frontier((int) $validated['surah'], (int) $validated['ayahCount']));
    }

    public function verifications(Request $request): \Illuminate\Http\JsonResponse
    {
        $surah = (int) $request->query('surah', 12);
        $rows = AyahVerification::where('surah', $surah)->orderBy('ayah')->get();

        return response()->json(['verifications' => $rows]);
    }

    public function verify(Request $request): \Illuminate\Http\JsonResponse
    {
        $validated = $request->validate([
            'surah' => ['required', 'integer', 'min:1'],
            'ayah' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $row = AyahVerification::updateOrCreate(
            ['surah' => $validated['surah'], 'ayah' => $validated['ayah']],
            [
                'verified_by' => $request->user()->email,
                'note' => $validated['note'] ?? null,
                'created_at' => (int) round(microtime(true) * 1000),
            ],
        );

        return response()->json(['ok' => true, 'verification' => $row]);
    }

    public function createOverride(Request $request): \Illuminate\Http\JsonResponse
    {
        $validated = $request->validate([
            'surah' => ['required', 'integer', 'min:1'],
            'ayah' => ['required', 'integer', 'min:1'],
            'position' => ['nullable', 'integer', 'min:1'],
            'questionType' => ['required', 'string', 'max:32'],
            'field' => ['required', Rule::in(['gloss', 'distractor', 'group', 'disable', 'custom'])],
            'payload' => ['required', 'array'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $row = QuestionOverride::create([
            'surah' => $validated['surah'],
            'ayah' => $validated['ayah'],
            'position' => $validated['position'] ?? null,
            'question_type' => $validated['questionType'],
            'field' => $validated['field'],
            'payload' => $validated['payload'],
            'editor_id' => $request->user()->id,
            'note' => $validated['note'] ?? null,
            'created_at' => (int) round(microtime(true) * 1000),
        ]);

        return response()->json(['ok' => true, 'override' => $row], 201);
    }
}
