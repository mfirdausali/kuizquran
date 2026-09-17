<?php

namespace App\Http\Controllers;

use App\Models\AyahVerification;
use App\Models\CorpusAyahHash;
use App\Models\GlossDraft;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Build-plan step 28 (M9) — THE FREEZE GATE'S SERVER-SIDE HALF.
 *
 * `scripts/content-freeze.mjs` evaluates the criteria that live in COMPILED
 * ARTIFACTS on disk (scene beats, hashSpecVersion, corpus/manifest agreement,
 * the QA sample records). Those are build facts and a script is the right
 * place for them.
 *
 * This endpoint answers the criteria that live in the DATABASE and change
 * without a rebuild:
 *   - is any launch surah's frontier green, and at which reviewer_kind;
 *   - are there unmerged gloss drafts that a freeze would strand;
 *   - do the ingested hash rows agree on one hashSpecVersion.
 *
 * WHY BOTH HALVES EXIST SEPARATELY. A single command reading the database
 * would need the API running and credentialled to answer a question about
 * files on disk; a single script reading the database would duplicate the
 * frontier predicate that VerificationsController already owns (and B3 was
 * exactly the bug where two places computed "verified" and one was wrong).
 * So each half answers what it can see first-hand.
 *
 * CORRECTED: this docblock previously claimed "the workbench shows them
 * together" — false from the day it was written, the same "docblock says X,
 * reality is Y" shape as v3-D90/D110/D123's own findings. `grep -rln
 * "content-freeze" apps/web` (excluding the unrelated build-script naming
 * collision in `lib/corpus/load.ts`) returned nothing until this endpoint's
 * frontend half was built: `apps/web/lib/admin/contentFreeze.ts` +
 * `components/admin/ContentFreezePanel.tsx`, rendered at
 * `/settings/content-freeze` — a standalone admin screen, mirroring
 * `/settings/health`'s own shape, not embedded in the per-surah
 * `/workbench` route (this endpoint spans every launch surah at once, so it
 * does not fit a surah-scoped screen).
 *
 * THIS ENDPOINT NEVER FREEZES ANYTHING. Freezing is a human act. A route that
 * flipped a "frozen" bit would be a checklist that ticks itself.
 */
class ContentFreezeController extends Controller
{
    /**
     * BUILD-PLAN M9 scope: "ALL launch-serving surahs (12 + 112 + 103 +
     * second surah)".
     *
     * FIXED (nightly run, 2026-09-17): this constant read `[12, 103, 112]` —
     * missing 67 — on the stale reasoning that "the second surah is
     * BUILD-PLAN's own open question Q3 and cannot be enumerated." That
     * question was ANSWERED on 2026-08-11: AL-MULK (67), ratified by Firdaus
     * and recorded as v3-D59 (`docs/BUILD-PLAN.md`'s own Q3 entry). The
     * launch set has been the closed, enumerable four-surah list
     * `[12, 67, 103, 112]` ever since — `scripts/content-freeze.mjs`'s own
     * `LAUNCH_SURAHS` already states this correctly and even names v3-D59 in
     * its own comment. This controller's copy simply never got the memo.
     *
     * The consequence was real, not cosmetic: `ContentFreezePanel.tsx`
     * (`components/admin/ContentFreezePanel.tsx`) always calls
     * `loadContentFreeze()` with NO `?surahs=` query param, so the ONE admin
     * screen built to answer "may I book the qari" silently never evaluated
     * surah 67's own frontier/hashSpec criteria at all — the exact surah
     * HANDOVER.md names as the sole remaining content-freeze blocker
     * (H2, scene beats). An admin trusting a `bookable: true` reading from
     * this screen could not have known it was never checking 67.
     */
    private const LAUNCH_SURAHS = [12, 67, 103, 112];

    public function index(Request $request): JsonResponse
    {
        $surahs = $this->requestedSurahs($request);

        $criteria = [];
        $criteria[] = $this->frontierCriterion($surahs);
        $criteria[] = $this->glossDraftCriterion();
        $criteria[] = $this->hashSpecCriterion($surahs);

        $allMet = true;
        foreach ($criteria as $c) {
            if (! $c['met']) {
                $allMet = false;
            }
        }

        return response()->json([
            'surahs' => $surahs,
            'allMet' => $allMet,
            // Deliberately NOT called "frozen". This endpoint reports; a human
            // freezes. Naming it `bookable` keeps the question the one that
            // actually matters: may a qari session be booked against this?
            'bookable' => $allMet,
            'criteria' => $criteria,
            'note' => 'Database-side criteria only. Build-artifact criteria (scene beats, corpus/manifest agreement, QA sample sign-off) come from scripts/content-freeze.mjs.',
        ]);
    }

    /** @return array{surah:int,...} */
    private function requestedSurahs(Request $request): array
    {
        $raw = $request->query('surahs');
        if (! is_string($raw) || trim($raw) === '') {
            return self::LAUNCH_SURAHS;
        }
        $parsed = [];
        foreach (explode(',', $raw) as $part) {
            $n = (int) trim($part);
            if ($n >= 1 && $n <= 114) {
                $parsed[] = $n;
            }
        }

        return $parsed === [] ? self::LAUNCH_SURAHS : $parsed;
    }

    /**
     * M9's EXIT criterion, reported as an ENTRY fact: "frontier 100% green
     * hash-current on every launch surah."
     *
     * The predicate is VerificationsController's, restated over the same two
     * tables rather than re-derived differently — verified = ANY row's
     * content_hash matches the CURRENT tier hash. A second, subtly different
     * notion of "verified" is DEFECTS.md#B3's actual mechanism.
     */
    private function frontierCriterion(array $surahs): array
    {
        $evidence = [];
        $met = true;

        foreach ($surahs as $surah) {
            $hashes = CorpusAyahHash::where('surah', $surah)->get();
            if ($hashes->isEmpty()) {
                $evidence[] = "surah {$surah}: no ingested corpus hashes — nothing to verify against";
                $met = false;

                continue;
            }

            $rows = AyahVerification::where('surah', $surah)->orderBy('id')->get()->groupBy('ayah');

            $green = 0;
            $humanQari = 0;
            $notGreen = [];
            foreach ($hashes as $hashRow) {
                $forAyah = $rows->get($hashRow->ayah, collect());
                $qariOk = $forAyah->contains(
                    fn (AyahVerification $r) => $r->tier === 'qari' && $r->content_hash === $hashRow->qari_hash
                );
                $adminOk = $forAyah->contains(
                    fn (AyahVerification $r) => $r->tier === 'admin' && $r->content_hash === $hashRow->admin_hash
                );
                if ($qariOk && $adminOk) {
                    $green++;
                } else {
                    $notGreen[] = $hashRow->ayah;
                }
                // v3-D22: a HUMAN qari row is what licenses a scholar claim.
                if ($forAyah->contains(
                    fn (AyahVerification $r) => $r->tier === 'qari'
                        && $r->reviewer_kind === 'human'
                        && $r->content_hash === $hashRow->qari_hash
                )) {
                    $humanQari++;
                }
            }

            $total = $hashes->count();
            if ($green < $total) {
                $met = false;
                $sample = array_slice($notGreen, 0, 8);
                $evidence[] = "surah {$surah}: {$green}/{$total} ayat green; outstanding ayat include ".
                    implode(', ', $sample).(count($notGreen) > 8 ? ' …' : '');
            } else {
                $evidence[] = "surah {$surah}: {$green}/{$total} ayat green on both tiers";
            }

            // Reported ALWAYS, met or not: v3-D22 says launch does not require
            // a human row, but no UI may claim scholar verification without
            // one. Whoever reads this report is the person who would write
            // that claim, so they are told the number.
            $evidence[] = "surah {$surah}: {$humanQari}/{$total} ayat carry a HUMAN hash-current qari signature".
                ($humanQari === 0 ? ' — no surface may claim scholar verification for this surah (v3-D22)' : '');
        }

        return [
            'name' => 'Verification frontier green on every launch surah',
            'met' => $met,
            'evidence' => $evidence,
        ];
    }

    /**
     * Unmerged gloss drafts. NOT a blocker at hash v1 and reported as such —
     * v3-D15 excludes gloss.ms from the hash, so a pending draft cannot amber
     * a signature and cannot strand a freeze. This criterion exists to make
     * that VISIBLE at freeze time rather than leaving someone to wonder
     * whether the MS project is a blocker (it is the single question edge case
     * #155 is about, and the answer being "no, by construction" is worth
     * printing).
     */
    private function glossDraftCriterion(): array
    {
        $total = GlossDraft::count();
        $reviewed = GlossDraft::where('status', GlossDraft::REVIEWED)->count();
        $merged = GlossDraft::where('status', GlossDraft::MERGED)->count();

        $evidence = [
            "{$total} gloss draft row(s); {$reviewed} reviewed, {$merged} merged",
            'gloss.ms is excluded from hash v1 (v3-D15), so no draft — at any status — can amber a qari signature or block this freeze.',
        ];
        if ($merged > 0) {
            // A merged row at hash v1 should be unreachable (the controller
            // refuses the transition). If one exists, something wrote around
            // the workflow and the freeze assumption no longer holds.
            $evidence[] = 'MERGED rows exist at hash v1 — the merge transition is supposed to be closed. Investigate before freezing.';
        }

        return [
            'name' => 'MS gloss drafts do not block the freeze (v3-D15)',
            // Met unless a merged row exists, which would mean the workflow
            // was bypassed.
            'met' => $merged === 0,
            'evidence' => $evidence,
        ];
    }

    /** Edge case #26: one hashSpecVersion across every ingested row, or a
     *  spec change is already half-applied and a re-hash is pending. */
    private function hashSpecCriterion(array $surahs): array
    {
        $versions = CorpusAyahHash::whereIn('surah', $surahs)
            ->distinct()
            ->pluck('hash_spec_version')
            ->sort()
            ->values()
            ->all();

        if ($versions === []) {
            return [
                'name' => 'hashSpecVersion consistent across ingested rows',
                'met' => false,
                'evidence' => ['no ingested hash rows for the launch surahs'],
            ];
        }

        return [
            'name' => 'hashSpecVersion consistent across ingested rows',
            'met' => count($versions) === 1,
            'evidence' => count($versions) === 1
                ? ['all ingested rows at hashSpecVersion '.$versions[0]]
                : ['MIXED hashSpecVersions across ingested rows: '.implode(', ', $versions).' — a spec change is half-applied'],
        ];
    }
}
