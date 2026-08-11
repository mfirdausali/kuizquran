<?php

namespace App\Http\Controllers;

use App\Models\GlossDraft;
use App\Models\GlossDraftReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Build-plan step 27 (M9) — THE GLOSS AUTHORING WORKFLOW, NON-SHIPPING.
 *
 * v3-D15: launch is EN-only, `gloss.ms` is EXCLUDED from hash v1, the MS toggle
 * is hidden. Word-by-word Malay exists in no public source, so ~11,300 glosses
 * must be authored against Basmeih. This controller is the workflow that lets a
 * human do that — draft -> reviewed -> merged — without any of it reaching a
 * learner or moving a scholar's hash.
 *
 * ---------------------------------------------------------------------------
 * THE TWO STRUCTURAL GUARANTEES, AND WHERE EACH IS ENFORCED
 * ---------------------------------------------------------------------------
 *
 * (1) A DRAFT CANNOT REACH A LEARNER.
 *     Not "is flagged so it won't" — cannot. The serving path is
 *     corpus.json (compiled, static, content-addressed) plus the `overrides`
 *     table, which engine/src/overrides.ts folds in. `gloss_drafts` is read by
 *     exactly two places: this controller and the admin review UI. There is no
 *     writer from here into `overrides`, no join, no compile step that consults
 *     it. Proven by Tests\Feature\GlossDrafts\GlossDraftIsolationTest, which
 *     greps the serving surfaces for any reference to the table.
 *
 * (2) A DRAFT CANNOT AMBER A QARI SIGNATURE.
 *     v3-D13's qari tier is text_uthmani + glosses + scene beats, and
 *     corpus-compiler/src/hash.ts#ayahQariHash reads `w.gloss.en` ONLY. `ms`
 *     is never an input, so no ms value — drafted, reviewed, or merged — can
 *     change the digest a qari signed. HASH_READ_LANGS below is the second,
 *     independent lock: this controller REFUSES to create a draft in a language
 *     the qari hash reads, so the day someone adds a language to that hash,
 *     the corresponding draft path closes rather than silently gaining the
 *     power to invalidate scholar hours (edge case #155).
 *
 *     Proven on both sides: corpus-compiler/test/hash.test.ts asserts an ms
 *     mutation does not move the digest; Tests\Feature\GlossDrafts\
 *     GlossDraftsTest asserts an ms draft does not move the frontier and that
 *     an `en` draft is refused with 422.
 *
 * ---------------------------------------------------------------------------
 * WHY `merged` IS UNREACHABLE TODAY, DELIBERATELY
 * ---------------------------------------------------------------------------
 * Merging means the gloss enters the artifact a learner drills. At hash v1 that
 * is precisely what v3-D15 defers. So the transition is REFUSED with an
 * explanation naming the decision, rather than omitted from the schema — the
 * eventual merge (post-launch, after a named Malay reviewer with doctrinal
 * authority exists) is then a change to one guard here, reviewed on its own
 * merits, instead of a migration written under launch pressure.
 */
class GlossDraftsController extends Controller
{
    /**
     * Languages the qari-tier hash READS (corpus-compiler/src/hash.ts#ayahQariHash).
     * A draft may never be written for one of these — see guarantee (2).
     *
     * This list must move in lockstep with that function. It is asserted against
     * the compiler's own behaviour by corpus-compiler/test/hash.test.ts (the ms
     * exclusion) and named in the freeze report (scripts/content-freeze.mjs),
     * which reads the same fact from the TS side and cross-checks it.
     */
    private const HASH_READ_LANGS = ['en'];

    /** Languages this surface may author. EXCLUDED from hash v1 by v3-D15. */
    private const AUTHORABLE_LANGS = ['ms'];

    private const AUTHOR_KINDS = ['ai', 'human'];

    /**
     * The review worklist for one surah.
     *
     * Returns counts alongside rows because the counts are the review surface's
     * whole point — "how much of this surah is authored, how much reviewed" is
     * the question, and deriving it in the client from a paginated row list is
     * how a partial page silently reads as a complete corpus.
     */
    public function index(Request $request): JsonResponse
    {
        $surah = (int) $request->query('surah', 12);
        $lang = (string) $request->query('lang', 'ms');

        $rows = GlossDraft::where('surah', $surah)
            ->where('lang', $lang)
            ->orderBy('ayah')
            ->orderBy('position')
            ->get();

        $counts = [
            'draft' => 0,
            'reviewed' => 0,
            'merged' => 0,
            // Authored-but-empty is NOT the same as absent. A row with null
            // text is a coordinate someone claimed and has not filled.
            'unauthored' => 0,
        ];
        foreach ($rows as $row) {
            if (array_key_exists($row->status, $counts)) {
                $counts[$row->status]++;
            }
            if ($row->text === null || trim($row->text) === '') {
                $counts['unauthored']++;
            }
        }

        return response()->json([
            'surah' => $surah,
            'lang' => $lang,
            // Stated on the wire, not only in a docblock: every consumer of
            // this endpoint is told these rows do not ship and do not hash.
            'shipping' => false,
            'excludedFromHashV1' => ! in_array($lang, self::HASH_READ_LANGS, true),
            'counts' => $counts,
            'drafts' => $rows->map(fn (GlossDraft $r) => $this->toWire($r)),
        ]);
    }

    /**
     * Create or edit a draft. Upsert on the (surah, ayah, position, lang) key —
     * a second authored value for one word is an EDIT, never a competing row.
     *
     * EDITING A REVIEWED ROW RETURNS IT TO `draft`. A reviewer approved BYTES
     * (recorded in text_at_review); different bytes have not been approved, and
     * silently keeping the `reviewed` flag over changed text is B3's exact
     * shape one layer up.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'surah' => ['required', 'integer', 'min:1', 'max:114'],
            'ayah' => ['required', 'integer', 'min:1'],
            'position' => ['required', 'integer', 'min:1'],
            'lang' => ['required', 'string', Rule::in(self::AUTHORABLE_LANGS)],
            'text' => ['nullable', 'string'],
            'authorKind' => ['required', Rule::in(self::AUTHOR_KINDS)],
            'note' => ['nullable', 'string'],
        ]);

        // The independent lock. `AUTHORABLE_LANGS` already excludes anything
        // hashed, but this re-derives the refusal from the HASH side so the two
        // lists cannot drift into a state where a hashed language is authorable.
        if (in_array($validated['lang'], self::HASH_READ_LANGS, true)) {
            return response()->json([
                'error' => 'this language is an input to the qari-tier hash — a draft in it could amber a signed ayah (v3-D15 / edge case #155). Author it through the reviewed override path instead.',
            ], 422);
        }

        $now = (int) round(microtime(true) * 1000);
        $actor = $request->user()?->email;

        $row = GlossDraft::where('surah', $validated['surah'])
            ->where('ayah', $validated['ayah'])
            ->where('position', $validated['position'])
            ->where('lang', $validated['lang'])
            ->first();

        if (! $row) {
            $row = GlossDraft::create([
                'surah' => $validated['surah'],
                'ayah' => $validated['ayah'],
                'position' => $validated['position'],
                'lang' => $validated['lang'],
                'text' => $validated['text'] ?? null,
                'status' => GlossDraft::DRAFT,
                'author_kind' => $validated['authorKind'],
                'authored_by' => $actor,
                'note' => $validated['note'] ?? null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            return response()->json(['draft' => $this->toWire($row)], 201);
        }

        $previousStatus = $row->status;
        if ($previousStatus === GlossDraft::MERGED) {
            return response()->json([
                'error' => 'a merged gloss is immutable — a correction to shipped content goes through the override path, which is hashed and re-verifiable.',
            ], 422);
        }

        $textChanged = ($row->text ?? '') !== ($validated['text'] ?? '');

        DB::transaction(function () use ($row, $validated, $now, $actor, $textChanged, $previousStatus) {
            $row->text = $validated['text'] ?? null;
            $row->note = $validated['note'] ?? $row->note;
            $row->updated_at = $now;

            // The un-review. See the method docblock.
            if ($textChanged && $previousStatus === GlossDraft::REVIEWED) {
                $row->status = GlossDraft::DRAFT;
                $row->reviewed_by = null;
                $row->reviewed_at = null;
                GlossDraftReview::create([
                    'gloss_draft_id' => $row->id,
                    'from_status' => GlossDraft::REVIEWED,
                    'to_status' => GlossDraft::DRAFT,
                    'text_at_review' => $validated['text'] ?? null,
                    'actor_kind' => $validated['authorKind'],
                    'actor' => $actor,
                    'note' => 'text edited after review — approval was for different bytes',
                    'created_at' => $now,
                ]);
            }
            $row->save();
        });

        return response()->json(['draft' => $this->toWire($row->fresh())]);
    }

    /**
     * Move a draft through the workflow: draft -> reviewed, reviewed -> draft
     * (rejection), reviewed -> merged (REFUSED at hash v1).
     *
     * The transition table is explicit rather than "any status to any status
     * with an audit row", because the interesting property of this workflow is
     * which moves are IMPOSSIBLE.
     */
    public function review(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'toStatus' => ['required', Rule::in(GlossDraft::STATUSES)],
            'actorKind' => ['required', Rule::in(self::AUTHOR_KINDS)],
            'note' => ['nullable', 'string'],
        ]);

        $row = GlossDraft::find($id);
        if (! $row) {
            return response()->json(['error' => 'no such draft'], 404);
        }

        $from = $row->status;
        $to = $validated['toStatus'];

        if ($to === GlossDraft::MERGED) {
            // v3-D15, stated to the caller rather than failing opaquely.
            return response()->json([
                'error' => 'merging is closed at hash v1: launch is EN-only and gloss.ms is excluded from the hash (v3-D15). A merge would put unreviewed-by-a-named-authority Malay in front of a learner. Reopen this when a Malay reviewer with doctrinal authority is named in DECISIONS.md.',
            ], 422);
        }

        $allowed = [
            GlossDraft::DRAFT => [GlossDraft::REVIEWED],
            GlossDraft::REVIEWED => [GlossDraft::DRAFT],
            GlossDraft::MERGED => [],
        ];
        if (! in_array($to, $allowed[$from] ?? [], true)) {
            return response()->json(['error' => "illegal transition {$from} -> {$to}"], 422);
        }

        // An EMPTY draft cannot be reviewed. "Reviewed" over null text is a
        // count that inflates the review surface's progress with nothing.
        if ($to === GlossDraft::REVIEWED && ($row->text === null || trim($row->text) === '')) {
            return response()->json(['error' => 'nothing to review — this coordinate has no authored text'], 422);
        }

        $now = (int) round(microtime(true) * 1000);
        $actor = $request->user()?->email;

        DB::transaction(function () use ($row, $from, $to, $validated, $now, $actor) {
            $row->status = $to;
            if ($to === GlossDraft::REVIEWED) {
                $row->reviewed_by = $actor;
                $row->reviewed_at = $now;
            } else {
                $row->reviewed_by = null;
                $row->reviewed_at = null;
            }
            $row->updated_at = $now;
            $row->save();

            GlossDraftReview::create([
                'gloss_draft_id' => $row->id,
                'from_status' => $from,
                'to_status' => $to,
                // The bytes as approved/rejected — never just the row id.
                'text_at_review' => $row->text,
                'actor_kind' => $validated['actorKind'],
                'actor' => $actor,
                'note' => $validated['note'] ?? null,
                'created_at' => $now,
            ]);
        });

        return response()->json(['draft' => $this->toWire($row->fresh())]);
    }

    private function toWire(GlossDraft $r): array
    {
        return [
            'id' => $r->id,
            'surah' => $r->surah,
            'ayah' => $r->ayah,
            'position' => $r->position,
            'lang' => $r->lang,
            'text' => $r->text,
            'status' => $r->status,
            'authorKind' => $r->author_kind,
            'authoredBy' => $r->authored_by,
            'reviewedBy' => $r->reviewed_by,
            'reviewedAt' => $r->reviewed_at,
            'note' => $r->note,
            'createdAt' => $r->created_at,
            'updatedAt' => $r->updated_at,
        ];
    }
}
