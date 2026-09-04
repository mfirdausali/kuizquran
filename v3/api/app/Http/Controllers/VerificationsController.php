<?php

namespace App\Http\Controllers;

use App\Models\AdminRole;
use App\Models\AyahVerification;
use App\Models\CorpusAyahHash;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Build-plan step 15 / v3-D13 / v3-D22. GATE-A's "verified frontier"
 * metric, DEFECTS.md#B3 closed: verified = ANY row's `content_hash`
 * matches the CURRENT tier hash in `corpus_ayah_hashes`. Rows read in
 * `id` order (B4's lesson generalized, never `created_at` alone).
 *
 * v3-D92: signing the QARI tier requires the acting admin to hold
 * `AdminRole::QARI` — the migration's own docblock says a role "refines
 * what an already-allowlisted admin may do", but nothing enforced it until
 * this. The admin tier (distractors + specs) stays open to any admin —
 * v3-D13 never gated it on scholarship.
 */
class VerificationsController extends Controller
{
    private const TIERS = ['qari', 'admin'];

    private const REVIEWER_KINDS = ['ai', 'human'];

    public function index(Request $request): JsonResponse
    {
        $surah = (int) $request->query('surah', 12);
        $hashes = CorpusAyahHash::where('surah', $surah)->get()->keyBy('ayah');
        $verifications = AyahVerification::where('surah', $surah)->orderBy('id')->get()->groupBy('ayah');

        $frontier = [];
        foreach ($hashes as $ayah => $hashRow) {
            $rowsForAyah = $verifications->get($ayah, collect());
            $status = [];
            foreach (self::TIERS as $tier) {
                $currentHash = $tier === 'qari' ? $hashRow->qari_hash : $hashRow->admin_hash;
                $tierRows = $rowsForAyah->where('tier', $tier);
                if ($tierRows->isEmpty()) {
                    $status[$tier] = 'unverified';
                } elseif ($tierRows->contains(fn (AyahVerification $r) => $r->content_hash === $currentHash)) {
                    $status[$tier] = 'verified';
                } else {
                    $status[$tier] = 'stale';
                }
            }
            // v3-D176: when THIS ayah's current hash was last ingested — the
            // one fact that lets an admin tell "just recomputed" from "stale
            // from before the corpus last changed" (`ingested_at` has been
            // stamped on every write since step 15, IngestHashesCommand and
            // CorpusHashRecomputer alike, and was never reported here).
            $status['ingestedAt'] = $hashRow->ingested_at;
            $frontier[$ayah] = $status;
        }

        return response()->json([
            'frontier' => $frontier,
            'verifications' => $verifications->flatten()->map(fn (AyahVerification $r) => $this->toWire($r)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'surah' => ['required', 'integer', 'min:1'],
            'ayah' => ['required', 'integer', 'min:1'],
            'tier' => ['required', Rule::in(self::TIERS)],
            'reviewerKind' => ['required', Rule::in(self::REVIEWER_KINDS)],
            'note' => ['nullable', 'string'],
        ]);

        if ($validated['tier'] === 'qari' && ! $request->user()->hasAdminRole(AdminRole::QARI)) {
            return response()->json([
                'error' => 'only an admin holding the qari role may sign a qari-tier verification',
            ], 403);
        }

        $hashRow = CorpusAyahHash::where('surah', $validated['surah'])->where('ayah', $validated['ayah'])->first();
        if (! $hashRow) {
            return response()->json(['error' => 'no ingested hash for this ayah — cannot verify against nothing'], 422);
        }

        // TOCTOU-safe (v3-D22): the server reads its OWN already-ingested
        // current hash — a client-submitted `contentHash` (if sent) is
        // silently ignored, never trusted, never even read here.
        $currentHash = $validated['tier'] === 'qari' ? $hashRow->qari_hash : $hashRow->admin_hash;

        $row = AyahVerification::create([
            'surah' => $validated['surah'],
            'ayah' => $validated['ayah'],
            'tier' => $validated['tier'],
            'content_hash' => $currentHash,
            'hash_spec_version' => $hashRow->hash_spec_version,
            'reviewer_kind' => $validated['reviewerKind'],
            'verified_by' => $request->user()->email,
            'note' => $validated['note'] ?? null,
            'created_at' => (int) round(microtime(true) * 1000),
        ]);

        return response()->json(['verification' => $this->toWire($row)], 201);
    }

    private function toWire(AyahVerification $r): array
    {
        return [
            'id' => $r->id,
            'surah' => $r->surah,
            'ayah' => $r->ayah,
            'tier' => $r->tier,
            'contentHash' => $r->content_hash,
            'hashSpecVersion' => $r->hash_spec_version,
            'reviewerKind' => $r->reviewer_kind,
            'verifiedBy' => $r->verified_by,
            'note' => $r->note,
            'createdAt' => $r->created_at,
        ];
    }
}
