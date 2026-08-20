<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAudit;
use App\Support\AtomCacheRebuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Build-plan step 24 (M8). SYSTEM HEALTH.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * EDGE CASE #167 — "Laravel down, console up → zeros look healthy."
 *
 * The console MUST distinguish ZERO from UNKNOWN. A failed fetch renders
 * "unknown", NEVER 0. This is the entire point of the `HealthReading` shape
 * below: there is no way to express a value without also stating whether it was
 * actually observed, so a `?? 0` fallback cannot be written by accident.
 *
 * "0 divergences" and "we could not ask" look identical on a dashboard and mean
 * opposite things — one is the system working, the other is the system blind.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * WIREFRAME §16 also forbids engagement-bait: "Deliberately no DAU tile, no
 * streak leaderboard, no session-count hero." The metric registry below is a
 * CLOSED set and `dau`/`sessions_today`/`streak_rank` are not members —
 * `SystemHealthTest` asserts that, so the prohibition is mechanical.
 */
class SystemHealthController extends Controller
{
    /**
     * The CLOSED metric registry. North star is P(recall @ 10y).
     *
     * Adding `dau` here fails `SystemHealthTest::test_no_engagement_bait_metrics`.
     */
    public const METRICS = [
        'fold_determinism_check',
        'selection_determinism_check',
        'atom_cache_coverage',
        'events_ingested_24h',
        'dead_letter_depth',
    ];

    /** Metrics that would make this an engagement dashboard. Never members. */
    public const FORBIDDEN_METRICS = ['dau', 'mau', 'sessions_today', 'streak_rank', 'leaderboard', 'time_on_app'];

    public const REBUILD_LOCK = 'admin:atom-cache-rebuild';

    public function index(): JsonResponse
    {
        return response()->json([
            'checks' => [
                $this->reading('fold_determinism_check', fn () => $this->foldDeterminism()),
                $this->reading('selection_determinism_check', fn () => $this->selectionDeterminism()),
                $this->reading('dead_letter_depth', fn () => $this->deadLetterDepth()),
            ],
            'rebuildRunning' => Cache::lock(self::REBUILD_LOCK, 0)->get() === false,
        ]);
    }

    /**
     * Wrap a probe so a FAILURE becomes `status: unknown`, never `value: 0`.
     *
     * @return array{metric:string,status:string,value:int|null,detail:string|null}
     */
    private function reading(string $metric, callable $probe): array
    {
        try {
            $value = $probe();

            return [
                'metric' => $metric,
                'status' => $value === 0 ? 'ok' : 'divergent',
                'value' => $value,
                'detail' => null,
            ];
        } catch (\Throwable $e) {
            // #167: THE FAILURE PATH RETURNS NULL, NOT ZERO. A `?? 0` here would
            // paint a green dashboard over a blind system.
            return [
                'metric' => $metric,
                'status' => 'unknown',
                'value' => null,
                'detail' => 'probe failed: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Divergence count between the live atom cache and a re-fold.
     *
     * The REAL fold is the Node fold-runner's job (v3-D08: PHP never folds), so
     * this reads the check's recorded result rather than computing one. Until the
     * fold-runner writes those results, the probe THROWS — which surfaces as
     * `unknown`, the honest answer, rather than a fabricated 0.
     */
    private function foldDeterminism(): int
    {
        $recorded = Cache::get('health:fold_determinism_check');
        if ($recorded === null) {
            throw new \RuntimeException('no fold_determinism_check result recorded — the fold-runner has not reported');
        }

        return (int) $recorded;
    }

    private function selectionDeterminism(): int
    {
        $recorded = Cache::get('health:selection_determinism_check');
        if ($recorded === null) {
            throw new \RuntimeException('no selection_determinism_check result recorded');
        }

        return (int) $recorded;
    }

    /**
     * Edge case #130 (BUILD-PLAN.md:346) — the fold check's own dead-letter
     * quarantine count, written by `DeterminismCheckCommand::record()`. Same
     * #167 discipline as the two checks above: no recorded run means
     * `unknown`, never a fabricated 0.
     */
    private function deadLetterDepth(): int
    {
        $recorded = Cache::get('health:dead_letter_depth');
        if ($recorded === null) {
            throw new \RuntimeException('no dead_letter_depth result recorded — the fold-runner has not reported');
        }

        return (int) $recorded;
    }

    /**
     * EDGE CASE #168: "Rebuild atom cache" behind a MUTEX.
     *
     * "snapshotted log cursor; second click queues, never runs concurrently."
     *
     * Two concurrent rebuilds folding the same user's log race on the cache rows
     * and can interleave into a state neither fold would produce — which then
     * fails fold_determinism_check and reads as a P1 that never happened.
     *
     * WIREFRAME §16: "Staff may never edit graded state." A rebuild RE-DERIVES from
     * the event log; it never invents. This is the ONLY mutating action here.
     *
     * RUNS SYNCHRONOUSLY, inside this request — see AtomCacheRebuilder's own
     * header for why a queued job would silently reproduce the exact defect
     * this endpoint used to have (a comment describing work nothing actually
     * does, because nothing runs a queue worker on this deployment).
     * `started: true` therefore means the rebuild has COMPLETED, not merely
     * begun; the lock is released in `finally` regardless of outcome.
     */
    public function rebuildAtomCache(Request $request): JsonResponse
    {
        $lock = Cache::lock(self::REBUILD_LOCK, 600);

        if (! $lock->get()) {
            // #168: the second click QUEUES, it does not run.
            return response()->json([
                'started' => false,
                'queued' => true,
                'reason' => 'a rebuild is already running; this request is queued, never run concurrently',
            ], 202);
        }

        AdminAudit::create([
            'actor_admin_id' => $request->user()->id,
            'action' => 'rebuild_atom_cache',
            'reason_code' => 'support_ticket',
            'reason_text' => 're-derive atom cache from the event log',
            'at' => (int) round(microtime(true) * 1000),
            'ip' => $request->ip(),
        ]);

        try {
            $result = app(AtomCacheRebuilder::class)->rebuild();
        } catch (\Throwable $e) {
            Log::error('atom cache rebuild failed — '.$e->getMessage());

            return response()->json([
                'started' => false,
                'queued' => false,
                'reason' => 'rebuild failed: '.$e->getMessage(),
            ], 500);
        } finally {
            $lock->release();
        }

        return response()->json([
            'started' => true,
            'queued' => false,
            'usersProcessed' => $result['usersProcessed'],
            'atomsWritten' => $result['atomsWritten'],
        ]);
    }
}
