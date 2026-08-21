<?php

namespace App\Support;

use App\Models\Event;
use Illuminate\Support\Collection;
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
 * ── REPLACE, NEVER MERGE — BUT ONLY THE USERS ACTUALLY SENT ──
 * A rebuilt user's ENTIRE atom_cache row set is deleted and reinserted from
 * the fresh fold, inside one transaction. WIREFRAME §16: "staff may never
 * edit graded state" — a rebuild re-derives the whole truth from the log, so
 * a stale row for an atom the fresh fold no longer produces (e.g. a
 * PDPA-purged ayah reference, or a corrected engine bug) must not survive
 * the rebuild it was supposed to be fixed by.
 *
 * ── DEAD-LETTER QUARANTINE (edge case #130, the half v3-D114 left open) ──
 * `json_encode()` fails ATOMICALLY across a whole payload on the first
 * invalid-UTF8 byte or non-finite float anywhere in it — the same root cause
 * `DeterminismCheckCommand::sampleFromDatabase()` was fixed for. Here it is
 * sharper: because this class REPLACES, a fix that merely excluded a
 * poisoned user from the runner's input while still deleting their existing
 * rows would WIPE their cache with nothing to reinsert — strictly worse than
 * today's whole-rebuild failure. So each user's own entry is encode-tested
 * BEFORE it is added to the batch, and the eventual `DELETE` is scoped to
 * exactly the user IDs that were actually sent (and so will actually get a
 * fresh row back) — never to every candidate ID. A dead-lettered user's row
 * set is left byte-identical, "log intact," same as the nightly check.
 *
 * ── PER-USER ADVISORY LOCK (v3-D32/v3-D70, closed) ──
 * Every candidate user is locked via `PerUserFoldLock` for the full span of
 * this method — event read, the fold-runner call, and the delete+insert —
 * so a nightly `DeterminismCheckCommand` run can never read one of these
 * learners' `atom_cache` rows mid-rebuild. See that class's header for why
 * the lock is session-level (spans the external process call) rather than
 * transaction-scoped, and for the no-op-on-sqlite behavior in dev/test.
 */
class AtomCacheRebuilder
{
    /** @return array{usersProcessed:int, atomsWritten:int, deadLetters:list<array{userId:mixed,error:string}>} */
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
            return ['usersProcessed' => 0, 'atomsWritten' => 0, 'deadLetters' => []];
        }

        return PerUserFoldLock::withLocks($userIds->all(), fn () => $this->rebuildLocked($userIds));
    }

    /**
     * @param  Collection<int,mixed>  $userIds
     * @return array{usersProcessed:int, atomsWritten:int, deadLetters:list<array{userId:mixed,error:string}>}
     */
    private function rebuildLocked($userIds): array
    {
        $users = [];
        $deadLetters = [];
        foreach ($userIds as $userId) {
            $entry = [
                'userId' => $userId,
                'events' => Event::query()->where('user_id', $userId)->orderBy('id')->get()
                    ->map(fn (Event $e) => EventWireCodec::toWire($e))->all(),
            ];

            if (json_encode($entry, JSON_UNESCAPED_SLASHES) === false) {
                $deadLetters[] = [
                    'userId' => $userId,
                    'error' => 'unencodable event data — '.json_last_error_msg(),
                ];

                continue;
            }

            $users[] = $entry;
        }

        if ($users === []) {
            // Every candidate was dead-lettered — nothing to send the
            // runner, and (§16) nothing may be deleted either: a rebuild
            // that rebuilds nobody must wipe nobody.
            return ['usersProcessed' => 0, 'atomsWritten' => 0, 'deadLetters' => $deadLetters];
        }

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
        $sentUserIds = array_map(fn (array $u) => $u['userId'], $users);

        DB::transaction(function () use ($sentUserIds, $rows, $now) {
            // Scoped to exactly the users sent to the runner — a
            // dead-lettered user's ID is not in this list, so their existing
            // rows are never touched by this DELETE.
            DB::table('atom_cache')->whereIn('user_id', $sentUserIds)->delete();
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

        return ['usersProcessed' => count($users), 'atomsWritten' => count($rows), 'deadLetters' => $deadLetters];
    }
}
