<?php

namespace App\Http\Controllers;

use App\Models\AdminAudit;
use App\Models\Override;
use App\Support\CorpusHashRecomputer;
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
        // `with('editor')` — `toWire()` resolves the editor's email off this
        // relation; without eager-loading, every row would fire its own
        // `editor()` query (N+1) the moment an admin opens a busy ayah's
        // override history.
        $rows = Override::where('surah', $surah)->with('editor')->orderBy('created_at')->orderBy('id')->get();

        // v3-D403: this route is deliberately PUBLIC and unauthenticated
        // (see class docblock) — ANY caller, including the open internet,
        // reaches it. `editorId`/`editorEmail`/`note` exist only for
        // `OverrideEditor.tsx`'s admin-only history list (applyOverrides()
        // never reads them); serving them unconditionally leaked every
        // admin's email address — exactly the ADMIN_EMAILS enumeration B7's
        // own fix and PasswordResetController's "deliberately uniform
        // response" exist to prevent, through a different door — to anyone
        // with no credentials at all.
        // `$request->user()` with no guard name resolves `auth.defaults.guard`
        // ("web", session-based) — never the Bearer token a Sanctum caller
        // actually sends on a route with no `auth:sanctum` middleware. The
        // guard must be named explicitly, or every admin caller (including
        // the workbench's own OverrideEditor.tsx) would see `null` too.
        $isAdmin = (bool) $request->user('sanctum')?->isAdmin();

        return response()->json(['overrides' => $rows->map(fn (Override $r) => $this->toWire($r, $isAdmin))]);
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

        // v3-D405: `overrides` is APPEND-ONLY with no PDPA purge relief on
        // `note` — the identical unpurgeable-PII shape
        // `AdminRevealController::reveal()`'s own free-text `reason_text`
        // already guards with `AdminAudit::scanFreeText()`, never wired on
        // this write path's own free-text `note` until now.
        $piiWarnings = AdminAudit::scanFreeText($validated['note'] ?? null);
        if ($piiWarnings !== [] && ! $request->boolean('acknowledge_pii_warning')) {
            return response()->json([
                'error' => 'note appears to contain identifying information',
                'detected' => $piiWarnings,
                'hint' => 'Reference the pseudonym, not the person. Re-submit with acknowledge_pii_warning=true if this is intentional.',
            ], 422);
        }

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

        // We already have the editor in hand (it IS $request->user()) — set
        // the relation directly rather than firing a redundant `editor()`
        // query `toWire()` would otherwise trigger on a freshly created row.
        $row->setRelation('editor', $request->user());

        // DEFECTS.md#B3's live-wiring gap, closed: the moment an override
        // lands, its surah's tiered hash table is recomputed and
        // re-ingested — never a human hand-running corpus:ingest-hashes
        // afterwards. A recompute failure (surah not yet compiled, node
        // unavailable) is reported here and logged, but never blocks the
        // override write itself — see CorpusHashRecomputer's own docblock.
        $hashRecompute = app(CorpusHashRecomputer::class)->recompute($validated['surah']);

        // store() is admin-gated (`->middleware('admin')`) — the caller is
        // always a verified admin, so the response to their own write
        // always carries the admin-only fields.
        return response()->json(['override' => $this->toWire($row, true), 'hashRecompute' => $hashRecompute], 201);
    }

    /**
     * @param  bool  $isAdmin  v3-D403: `editorId`/`editorEmail`/`note` are
     *                         display-only for `OverrideEditor.tsx`'s admin history list —
     *                         `applyOverrides()` never reads them (engine/src/overrides.ts's own
     *                         docblock) — so an unauthenticated/non-admin caller of this public
     *                         route gets `null` for all three rather than every admin's email
     *                         and free-text note.
     */
    private function toWire(Override $r, bool $isAdmin): array
    {
        return [
            'id' => $r->id,
            'surah' => $r->surah,
            'ayah' => $r->ayah,
            'position' => $r->position,
            'questionType' => $r->question_type,
            'field' => $r->field,
            'payload' => $r->payload,
            'editorId' => $isAdmin ? $r->editor_id : null,
            // `Override::editor()` has existed since this table shipped
            // (v2-D21/D55) with no reader anywhere — `editorId` alone is not
            // something an admin reading `OverrideEditor.tsx`'s history list
            // can tell apart from another admin's row. Resolved here rather
            // than stored (unlike `AyahVerification.verified_by`, which
            // stores the email directly): an override row is corrected by a
            // NEW row, never edited, so there is no stale-snapshot risk in
            // reading the editor's CURRENT email off the relation. `null`
            // when the editor account no longer exists — a append-only row
            // is never re-attributed to fill the gap. Also `null` for any
            // non-admin caller, per the same rule as `editorId` above.
            'editorEmail' => $isAdmin ? $r->editor?->email : null,
            'note' => $isAdmin ? $r->note : null,
            'createdAt' => $r->created_at,
        ];
    }
}
