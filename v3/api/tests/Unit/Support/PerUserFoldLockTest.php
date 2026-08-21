<?php

namespace Tests\Unit\Support;

use App\Support\PerUserFoldLock;
use Illuminate\Support\Facades\DB;
use PDO;
use Tests\TestCase;
use Throwable;

/**
 * v3-D32/v3-D70's deferred per-user Postgres advisory lock, closed in
 * v3-D116 — see `PerUserFoldLock`'s own header for the race it closes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS TEST TALKS TO A REAL POSTGRES SERVER, TWICE OVER
 * ═══════════════════════════════════════════════════════════════════════════
 * v3-D32 deferred this exact mechanism because "sqlite, this repo's dev DB,
 * has no `pg_advisory_lock` to test against." A mock, a fake, or a test that
 * only checks the SQL string this class WOULD send would prove nothing about
 * whether Postgres actually serializes two callers on it — the same
 * vacuous-verification shape this build has already shipped nine times
 * (HANDOVER.md's own count). So every load-bearing assertion below runs
 * against a REAL Postgres connection, and the mutual-exclusion proof uses a
 * genuinely SEPARATE OS process (`pcntl_fork`), not two PHP objects sharing
 * one interpreter's memory — an advisory lock is scoped to a Postgres
 * *session*, and two PDO handles in the same process are still two sessions,
 * but forking removes any doubt that this is testing real cross-connection
 * behavior rather than some in-process shortcut.
 *
 * Skips cleanly — never a false green — when no Postgres is reachable at the
 * dedicated `PGSQL_LOCK_TEST_*` env vars (defaults match the official
 * `postgres` Docker image's own defaults: 127.0.0.1:5432, db/user/password
 * all `postgres` — see `.github/workflows/ci.yml`'s `postgres` service,
 * added alongside this test so it is NOT skipped in CI).
 */
class PerUserFoldLockTest extends TestCase
{
    private ?string $originalDefault = null;

    protected function tearDown(): void
    {
        if ($this->originalDefault !== null) {
            config(['database.default' => $this->originalDefault]);
            DB::purge('pgsql');
        }
        parent::tearDown();
    }

    /** Point the app's DEFAULT connection at a real Postgres server, or skip. */
    private function usePostgresOrSkip(): void
    {
        $this->originalDefault = (string) config('database.default');

        config(['database.connections.pgsql' => array_merge(
            config('database.connections.pgsql', []),
            [
                'host' => getenv('PGSQL_LOCK_TEST_HOST') ?: '127.0.0.1',
                'port' => getenv('PGSQL_LOCK_TEST_PORT') ?: '5432',
                'database' => getenv('PGSQL_LOCK_TEST_DATABASE') ?: 'postgres',
                'username' => getenv('PGSQL_LOCK_TEST_USERNAME') ?: 'postgres',
                'password' => getenv('PGSQL_LOCK_TEST_PASSWORD') ?: 'postgres',
            ],
        )]);
        config(['database.default' => 'pgsql']);
        DB::purge('pgsql');

        try {
            DB::select('select 1');
        } catch (Throwable $e) {
            $this->markTestSkipped(
                'no Postgres reachable at PGSQL_LOCK_TEST_* (defaults 127.0.0.1:5432/postgres/postgres) — '
                .'this test is the ONLY proof PerUserFoldLock genuinely serializes; unreachable Postgres means '
                .'that guarantee is unverified this run, not that it is fine: '.$e->getMessage(),
            );
        }
    }

    /** A brand-new raw PDO connection — deliberately NOT Laravel's DB
     *  facade, so it is unambiguously a second, independent Postgres
     *  session, usable safely from inside a forked child. */
    private function rawPdo(): PDO
    {
        $host = getenv('PGSQL_LOCK_TEST_HOST') ?: '127.0.0.1';
        $port = getenv('PGSQL_LOCK_TEST_PORT') ?: '5432';
        $db = getenv('PGSQL_LOCK_TEST_DATABASE') ?: 'postgres';
        $user = getenv('PGSQL_LOCK_TEST_USERNAME') ?: 'postgres';
        $pass = getenv('PGSQL_LOCK_TEST_PASSWORD') ?: 'postgres';

        return new PDO("pgsql:host={$host};port={$port};dbname={$db}", $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
    }

    public function test_is_supported_reflects_the_active_connection_driver(): void
    {
        $this->usePostgresOrSkip();

        $this->assertTrue(PerUserFoldLock::isSupported());
    }

    public function test_no_ops_on_a_non_postgres_connection(): void
    {
        // Deliberately does NOT call usePostgresOrSkip() — this proves the
        // sqlite path this suite normally runs under (config/database.php's
        // 'sqlite' default) never issues a Postgres-only statement, which
        // would throw ("no such function: pg_advisory_lock") if the no-op
        // guard were ever removed.
        $this->assertSame('sqlite', DB::connection()->getDriverName());
        $this->assertFalse(PerUserFoldLock::isSupported());

        $ran = PerUserFoldLock::withLocks([1, 2, 3], fn () => 'ran-without-postgres');

        $this->assertSame('ran-without-postgres', $ran);
    }

    public function test_the_lock_is_released_after_a_successful_run(): void
    {
        $this->usePostgresOrSkip();
        $raw = $this->rawPdo();

        $result = PerUserFoldLock::withLocks([501], fn () => 'ok');
        $this->assertSame('ok', $result);

        // A held-and-leaked lock would make this fail: a SEPARATE session's
        // pg_try_advisory_lock is non-blocking and returns false immediately
        // if anyone else still holds 501.
        $stmt = $raw->prepare('select pg_try_advisory_lock(501) as got');
        $stmt->execute();
        $got = (bool) $stmt->fetch()['got'];
        $this->assertTrue($got, 'the lock must be released once withLocks() returns');

        $raw->prepare('select pg_advisory_unlock(501)')->execute();
    }

    public function test_the_lock_is_released_even_when_the_callback_throws(): void
    {
        $this->usePostgresOrSkip();
        $raw = $this->rawPdo();

        try {
            PerUserFoldLock::withLocks([502], function () {
                throw new \RuntimeException('boom');
            });
            $this->fail('expected the callback exception to propagate');
        } catch (\RuntimeException $e) {
            $this->assertSame('boom', $e->getMessage());
        }

        // A leaked lock here would wedge every future rebuild/nightly check
        // for this "user" forever — worse than the race this class exists
        // to prevent. MUTATION: replace the `finally` release with only a
        // post-`try` release (unreachable after a throw) — this goes red.
        $stmt = $raw->prepare('select pg_try_advisory_lock(502) as got');
        $stmt->execute();
        $got = (bool) $stmt->fetch()['got'];
        $this->assertTrue($got, 'a thrown callback must not leak the advisory lock');

        $raw->prepare('select pg_advisory_unlock(502)')->execute();
    }

    /**
     * THE LOAD-BEARING PROOF. A genuinely separate OS process holds the
     * advisory lock for user 601 for ~400ms. Meanwhile:
     *  - `withLocks([601], ...)` from THIS process must BLOCK until the
     *    child releases it (elapsed time proves real waiting, not a
     *    coincidental pass).
     *  - `withLocks([602], ...)` — a DIFFERENT user, while 601 is still
     *    held — must return almost immediately: unrelated learners must
     *    never contend.
     *
     * MUTATION: replace `pg_advisory_lock` with `pg_try_advisory_lock`
     * (silently succeeding without ever actually waiting) — the same-id
     * assertion below goes red (elapsed drops under the sleep floor).
     */
    public function test_same_user_id_serializes_across_processes_but_different_ids_never_contend(): void
    {
        $this->usePostgresOrSkip();

        if (! function_exists('pcntl_fork') || ! function_exists('posix_kill')) {
            $this->markTestSkipped('pcntl/posix not available — cannot fork a genuine second process');
        }

        $holdMs = 450_000; // microseconds the child holds the lock
        $pid = pcntl_fork();
        $this->assertNotFalse($pid, 'fork failed');

        if ($pid === 0) {
            // CHILD: fresh raw connection, hold lock 601, then release and
            // hard-exit. No Laravel, no shared file handles with the
            // parent's app container — this process only ever touches its
            // own brand-new PDO connection.
            try {
                $child = $this->rawPdo();
                $child->prepare('select pg_advisory_lock(601)')->execute();
                usleep($holdMs);
                $child->prepare('select pg_advisory_unlock(601)')->execute();
            } finally {
                // Hard-exit: never run PHPUnit/Laravel shutdown handlers in
                // the forked child, which would double-report results into
                // the parent's test run.
                posix_kill(posix_getpid(), SIGKILL);
            }
        }

        // PARENT. Give the child a head start to actually acquire 601
        // before either assertion below races it.
        usleep(100_000);

        // Different id: must not be blocked by the child's lock on 601 at
        // all — the fast path proves per-user granularity, not a global
        // serialization masquerading as one.
        $start = microtime(true);
        $result = PerUserFoldLock::withLocks([602], fn () => 'fast');
        $elapsedFastMs = (microtime(true) - $start) * 1000;
        $this->assertSame('fast', $result);
        $this->assertLessThan(
            200,
            $elapsedFastMs,
            'a different user id must never be blocked by another user\'s held lock',
        );

        // Same id: must block until the child's usleep + unlock complete.
        $start = microtime(true);
        $result = PerUserFoldLock::withLocks([601], fn () => 'waited');
        $elapsedSameMs = (microtime(true) - $start) * 1000;
        $this->assertSame('waited', $result);
        $this->assertGreaterThan(
            250,
            $elapsedSameMs,
            'the same user id must genuinely wait for the other session\'s lock to release, not race past it',
        );

        pcntl_waitpid($pid, $status);
    }
}
