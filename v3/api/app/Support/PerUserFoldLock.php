<?php

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\DB;

/**
 * v3-D32/v3-D70's deferred per-user Postgres advisory lock, built now that
 * this build's deployment target (DECISIONS.md: Forge + managed Postgres)
 * has a real Postgres server this sandbox can test against — v3-D32
 * deferred exactly this because "sqlite, this repo's dev DB, has no
 * equivalent to test against", and that premise no longer holds.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RACE THIS CLOSES
 * ═══════════════════════════════════════════════════════════════════════════
 * `DeterminismCheckCommand`'s own header names the gap precisely: its
 * `Cache::lock` is RUN-level (two nightlies cannot overlap) but does nothing
 * to stop a nightly's per-user read interleaving with `AtomCacheRebuilder`'s
 * per-user write for the SAME learner — two entirely different lock keys, on
 * two entirely different admin/cron trigger paths, that both touch the same
 * `atom_cache` rows. A nightly that reads a learner's events at one moment
 * and their cache at another, while an admin's rebuild deletes-and-reinserts
 * that learner's rows in between, compares two states that were never
 * simultaneously true — a "confirmed" P1 that is really just this race.
 *
 * A per-user lock is the right grain: unrelated learners must never block
 * each other (a rebuild of learner A must not stall the nightly's read of
 * learner B), but the SAME learner must never be read by one caller while
 * written by another.
 *
 * ── WHY SESSION-LEVEL (`pg_advisory_lock`/`pg_advisory_unlock`), NOT
 *    TRANSACTION-SCOPED (`pg_advisory_xact_lock`) ──
 * The critical sections this guards span an external process call
 * (`FoldRunnerProcess::run`, out to Node and back) that can run for real
 * wall-clock time. A transaction-scoped lock would mean holding a DB
 * transaction open — and a pooled connection tied up — for the duration of a
 * subprocess, which is its own operational hazard on a small deployment.
 * Session-level locks let the caller do non-transactional work (the runner
 * call) while still excluding a same-user reader/writer for that whole span,
 * released explicitly in a `finally` so a thrown exception can never leak a
 * held lock — a leaked lock would wedge every future rebuild/nightly check
 * for that learner forever, strictly worse than the race it replaces.
 *
 * ── FIXED ACQUISITION ORDER ──
 * Callers may need more than one user locked at once (`AtomCacheRebuilder`
 * locks every candidate in its batch). Locks are always acquired in sorted
 * id order, the standard fix for the classic deadlock where two callers each
 * want an overlapping set of ids in different orders.
 *
 * ── NO-OP ON A NON-POSTGRES CONNECTION ──
 * `pg_advisory_lock`/`pg_advisory_unlock` are Postgres-only; sqlite (this
 * repo's dev/test default) has no equivalent primitive. Rather than fail
 * loudly on sqlite or fake a lock that does nothing, this degrades to
 * calling `$fn()` directly: sqlite is single-connection, single-process in
 * this codebase's own usage (a CLI test run, `php artisan test`), so there
 * is no second process for a real lock to exclude in the first place. This
 * is stated here, not hidden — and it is exactly why the load-bearing proof
 * of this class runs against a REAL Postgres connection (see
 * `PerUserFoldLockTest`), never sqlite standing in for it.
 */
class PerUserFoldLock
{
    public static function isSupported(): bool
    {
        return DB::connection()->getDriverName() === 'pgsql';
    }

    /**
     * Run `$fn` while holding a session-level Postgres advisory lock for
     * every id in `$userIds`. Always releases every lock it acquired, even
     * when `$fn` throws.
     *
     * @template T
     *
     * @param  list<int>  $userIds
     * @param  Closure(): T  $fn
     * @return T
     */
    public static function withLocks(array $userIds, Closure $fn): mixed
    {
        if ($userIds === [] || ! self::isSupported()) {
            return $fn();
        }

        $ids = array_values(array_unique(array_map('intval', $userIds)));
        sort($ids);

        foreach ($ids as $id) {
            DB::select('select pg_advisory_lock(?)', [$id]);
        }

        try {
            return $fn();
        } finally {
            foreach (array_reverse($ids) as $id) {
                DB::select('select pg_advisory_unlock(?)', [$id]);
            }
        }
    }
}
