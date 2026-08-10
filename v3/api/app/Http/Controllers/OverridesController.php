<?php

namespace App\Http\Controllers;

use App\Models\Override;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Build-plan step 15. PUBLIC read (v2-D21/D55: every client, including an
 * anonymous not-yet-synced device, needs these to build correct
 * questions), admin-gated write.
 *
 * DEFECTS.md#B1's closing gate: `field` is validated against a CLOSED set
 * that has never included `custom` in v3 — this is the write path B1 names
 * ("POST rejects kind=custom forever").
 */
class OverridesController extends Controller
{
    /** engine/src/overrides.ts#OverrideField — kept in sync by hand; the
     *  engine's own union is the type-level source of truth, this is the
     *  runtime validation mirror (v3-D08: Laravel never re-implements
     *  engine LOGIC, but validating a wire shape against a closed set is
     *  not logic — it's the same discipline DrillEvent's own field list
     *  gets). */
    private const CLOSED_FIELDS = ['gloss', 'distractor', 'group', 'disable'];

    public function index(Request $request): JsonResponse
    {
        $surah = (int) $request->query('surah', 12);
        $rows = Override::where('surah', $surah)->orderBy('created_at')->orderBy('id')->get();

        return response()->json(['overrides' => $rows->map(fn (Override $r) => $this->toWire($r))]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'surah' => ['required', 'integer', 'min:1'],
            'ayah' => ['required', 'integer', 'min:1'],
            'position' => ['nullable', 'integer', 'min:1'],
            'questionType' => ['required', 'string'],
            'field' => ['required', Rule::in(self::CLOSED_FIELDS)],
            'payload' => ['required', 'array'],
            'note' => ['nullable', 'string'],
        ]);

        $row = Override::create([
            'surah' => $validated['surah'],
            'ayah' => $validated['ayah'],
            'position' => $validated['position'] ?? null,
            'question_type' => $validated['questionType'],
            'field' => $validated['field'],
            'payload' => $validated['payload'],
            // Always the authenticated admin — never the request body
            // (same rule EventsController holds for user_id).
            'editor_id' => $request->user()->id,
            'note' => $validated['note'] ?? null,
            'created_at' => (int) round(microtime(true) * 1000),
        ]);

        return response()->json(['override' => $this->toWire($row)], 201);
    }

    private function toWire(Override $r): array
    {
        return [
            'id' => $r->id,
            'surah' => $r->surah,
            'ayah' => $r->ayah,
            'position' => $r->position,
            'questionType' => $r->question_type,
            'field' => $r->field,
            'payload' => $r->payload,
            'editorId' => $r->editor_id,
            'note' => $r->note,
            'createdAt' => $r->created_at,
        ];
    }
}
