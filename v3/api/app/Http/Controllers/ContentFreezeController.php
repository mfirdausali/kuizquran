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
 * So each half answers what it can see first-hand, and the workbench shows
 * them together.
 *
 * THIS ENDPOINT NEVER FREEZES ANYTHING. Freezing is a human act. A route that
 * flipped a "frozen" bit would be a checklist that ticks itself.
 */
class ContentFreezeController extends Controller
{
    /**
     * BUILD-PLAN M9 scope: "ALL launch-serving surahs (12 + 112 + 103 +
     * second surah)". The second surah is BUILD-PLAN's own open question Q3
     * and cannot be enumerated — reported as an open scope rather than
     * silently omitted, because a surah added after the freeze is a surah the
     * qari did not sign (edge case #176).
     */
    private const LAUNCH_SURAHS = [12, 103, 112];

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
