<?php

namespace App\Support;

use App\Models\Event;
use Illuminate\Support\Facades\DB;

/**
 * WIREFRAME §16 / build-plan step 24 (M8): the admin "rebuild atom cache"
 * action — staff re-deriving graded state from the append-only event log,
 * never editing it (invariant #2).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS CLASS EXISTS AT ALL
 * ═══════════════════════════════════════════════════════════════════════════
 * `SystemHealthController::rebuildAtomCache()` acquired a lock, wrote an
 * audit row, and returned `started: true` — with the comment "the actual
 * re-fold is dispatched to the Node fold-runner". No such dispatch existed
 * anywhere in the codebase: no Process call, no queued job, nothing wrote a
 * single `atom_cache` row, and the acquired lock was never released, so it
 * simply sat held for its full 600s TTL after every real click. The two
 * existing tests for this endpoint passed only because BOTH manually
 * force-release the lock before and after — compensating for, rather than
 * exercising, the leak. See DECISIONS.md for the full finding.
 *
 * ── SYNCHRONOUS, NOT A QUEUED JOB — DELIBERATELY, MATCHING v3-D81 ──
 * `CorpusHashRecomputer` (this build's other "PHP triggers a TS subprocess
 * from an admin write" case) already reasoned through this choice: a queued
 * job needs a worker process running somewhere, which is EXACTLY the "no
 * host runs anything" gap LAUNCH-CHECKLIST gate 20 names for the nightly
 * scheduler. Reaching for `ShouldQueue` here would not fix the "aspirational
 * comment, no real effect" defect — it would reproduce it in a new shape: a
 * job class that exists and is dispatched, silently doing nothing forever on
 * a deployment with no queue worker. This runs inline, in the admin's
 * request, and pays the real latency rather than hiding it.
 *
 * v3-D08: PHP never folds. This class reads real events, hands them to the
 * ONE Node fold-runner script that folds (bin/rebuild-atom-cache.ts, via
 * FoldRunnerProcess — the same invocation path DeterminismCheckCommand
 * uses), and writes back exactly what it returns.
 *
 * ── REPLACE, NEVER MERGE ──
 * A rebuilt user's ENTIRE atom_cache row set is deleted and reinserted from
 * the fresh fold, inside one transaction per user. WIREFRAME §16: "staff may
 * never edit graded state" — a rebuild re-derives the whole truth from the
 * log, so a stale row for an atom the fresh fold no longer produces (e.g. a
 * PDPA-purged ayah reference, or a corrected engine bug) must not survive
 * the rebuild it was supposed to be fixed by.
 */
class AtomCacheRebuilder
{
    /** @return array{usersProcessed:int, atomsWritten:int} */
    public function rebuild(): array
    {
        $userIds = Event::query()->select('user_id')->distinct()->pluck('user_id')
            ->merge(DB::table('atom_cache')->select('user_id')->distinct()->pluck('user_id'))
            ->unique()
            ->values();

        if ($userIds->isEmpty()) {
            // Genuinely nothing to rebuild — not an error (edge case #167's
            // "the failure path returns null, not zero" is about UNKNOWN vs
            // zero; an empty log truthfully re-derives to zero atoms).
            return ['usersProcessed' => 0, 'atomsWritten' => 0];
        }

        $users = $userIds->map(fn ($userId) => [
            'userId' => $userId,
            'events' => Event::query()->where('user_id', $userId)->orderBy('id')->get()
                ->map(fn (Event $e) => EventWireCodec::toWire($e))->all(),
        ])->all();

        [$exit, $report] = FoldRunnerProcess::run(
            ['bin/rebuild-atom-cache.ts'],
            json_encode([
                'engineVersion' => config('nightly.engine_version'),
                'users' => $users,
            ], JSON_UNESCAPED_SLASHES),
        );

        if ($exit !== 0) {
            throw new \RuntimeException(
                'rebuild-atom-cache runner failed: '.($report['error'] ?? 'unknown error (exit '.$exit.')'),
            );
        }

        /** @var list<array<string,mixed>> $rows */
        $rows = $report['rows'] ?? [];
        $now = (int) round(microtime(true) * 1000);

        DB::transaction(function () use ($userIds, $rows, $now) {
            DB::table('atom_cache')->whereIn('user_id', $userIds)->delete();
            foreach (array_chunk($rows, 500) as $chunk) {
                DB::table('atom_cache')->insert(array_map(fn (array $r) => [
                    'user_id' => $r['userId'],
                    'surah' => $r['surah'],
                    'kind' => $r['kind'],
                    'ref' => $r['ref'],
                    'strength' => $r['strength'],
                    'stability' => $r['stability'],
                    'difficulty' => $r['difficulty'],
                    'last_retrieval' => $r['lastRetrieval'],
                    'reps' => $r['reps'],
                    'lapses' => $r['lapses'],
                    'encoded' => $r['encoded'],
                    'gate_due_at' => $r['gateDueAt'],
                    'gate_passed' => $r['gatePassed'],
                    'gate_fails' => $r['gateFails'],
                    'engine_version' => $r['engineVersion'],
                    'computed_at' => $now,
                ], $chunk));
            }
        });

        return ['usersProcessed' => count($users), 'atomsWritten' => count($rows)];
    }
}
