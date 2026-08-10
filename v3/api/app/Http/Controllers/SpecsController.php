<?php

namespace App\Http\Controllers;

use App\Models\Spec;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Build-plan step 15 (v3-D33). Immutable, versioned, tombstone-as-flip.
 * `payload`'s inner shape is a placeholder for M4 (build-plan step 16) —
 * the one guarantee enforced now is WIREFRAME's hard problem 1: no
 * grading field may ever reach a spec row.
 */
class SpecsController extends Controller
{
    /** WIREFRAME.md §22: "which of 4 render shapes; difficulty offset;
     *  blank policy" are DATA; grading is CODE. These never appear in a
     *  spec payload, at any depth — checked recursively. */
    private const FORBIDDEN_PAYLOAD_KEYS = ['rung', 'pretest', 'atom', 'structured'];

    /** engine/src/site.ts's Lane concept (WIREFRAME.md §23), the closed
     *  6-lane set named throughout the wireframe. */
    private const LANES = ['s1', 'cloze', 'rc', 'junction', 'locate', 'reorder'];

    public function index(Request $request): JsonResponse
    {
        $surah = (int) $request->query('surah', 12);
        $rows = Spec::where('surah', $surah)->orderBy('id')->get();

        // Latest row per lineage is the current truth (tombstone-as-flip).
        $latestPerLineage = $rows->groupBy('spec_id')->map(fn ($g) => $g->last());

        return response()->json([
            'specs' => $latestPerLineage->filter(fn (Spec $s) => $s->active)->values()->map(fn (Spec $s) => $this->toWire($s)),
            'all' => $rows->map(fn (Spec $s) => $this->toWire($s)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'specId' => ['nullable', 'uuid'],
            'surah' => ['required', 'integer', 'min:1'],
            'siteKey' => ['required', 'string'],
            'lane' => ['required', Rule::in(self::LANES)],
            'payload' => ['required', 'array'],
            'active' => ['sometimes', 'boolean'],
        ]);

        $this->assertNoForbiddenKeys($validated['payload']);

        $specId = $validated['specId'] ?? (string) Str::uuid();
        $version = 1;
        if (isset($validated['specId'])) {
            $prior = Spec::where('spec_id', $specId)->max('version');
            if ($prior === null) {
                throw ValidationException::withMessages(['specId' => 'no existing spec with this id — omit specId to start a new lineage']);
            }
            $version = $prior + 1;
        }

        $row = Spec::create([
            'spec_id' => $specId,
            'version' => $version,
            'active' => $validated['active'] ?? true,
            'surah' => $validated['surah'],
            'site_key' => $validated['siteKey'],
            'lane' => $validated['lane'],
            'payload' => $validated['payload'],
            'author_id' => $request->user()->id,
            'created_at' => (int) round(microtime(true) * 1000),
        ]);

        return response()->json(['spec' => $this->toWire($row)], 201);
    }

    /** Recursive — a forbidden key nested at any depth is still rejected. */
    private function assertNoForbiddenKeys(array $payload): void
    {
        foreach ($payload as $key => $value) {
            if (is_string($key) && in_array($key, self::FORBIDDEN_PAYLOAD_KEYS, true)) {
                throw ValidationException::withMessages([
                    'payload' => "a spec payload may never carry a grading field (\"{$key}\") — WIREFRAME's hard problem 1",
                ]);
            }
            if (is_array($value)) {
                $this->assertNoForbiddenKeys($value);
            }
        }
    }

    private function toWire(Spec $s): array
    {
        return [
            'id' => $s->id,
            'specId' => $s->spec_id,
            'version' => $s->version,
            'active' => $s->active,
            'surah' => $s->surah,
            'siteKey' => $s->site_key,
            'lane' => $s->lane,
            'payload' => $s->payload,
            'authorId' => $s->author_id,
            'createdAt' => $s->created_at,
        ];
    }
}
