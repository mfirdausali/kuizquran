<?php

namespace Tests\Feature\Nightly;

use App\Models\Event;
use App\Models\User;
use App\Support\AtomCacheRebuilder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PDO;
use Tests\TestCase;
use Throwable;

/**
 * v3-D32/v3-D70 → closed in v3-D116. `PerUserFoldLockTest` proves the lock
 * PRIMITIVE genuinely serializes two Postgres sessions. This file proves the
 * two real CALLERS — `AtomCacheRebuilder::rebuild()` and
 * `DeterminismCheckCommand`'s DB-sampling path — actually route through it,
 * rather than merely existing beside it unused (exactly DEFECTS.md's
 * recurring "built and tested, zero production callers" shape, applied here
 * to a lock instead of a feature).
 *
 * Runs against a REAL, throwaway Postgres database — a mocked lock or a
 * behavior-only assertion on sqlite could not tell "wired" from "not wired",
 * since both paths return the identical result there (the no-op IS correct
 * on sqlite). Skips cleanly when Postgres is unreachable, for the same
 * reason `PerUserFoldLockTest` does.
 */
class PerUserFoldLockWiringTest extends TestCase
{
    private ?string $originalDefault = null;

    protected function tearDown(): void
    {
        if ($this->originalDefault !== null) {
            try {
                DB::table('atom_cache')->truncate();
                DB::table('events')->truncate();
                DB::table('users')->truncate();
            } catch (Throwable) {
                // Connection never came up (test was skipped) — nothing to clean.
            }
            config(['database.default' => $this->originalDefault]);
            DB::purge('pgsql');
        }
        parent::tearDown();
    }

    private function usePostgresOrSkip(): void
    {
        $this->originalDefault = (string) config('database.default');

        config(['database.connections.pgsql' => array_merge(
            config('database.connections.pgsql', []),
            [
                'host' => getenv('PGSQL_LOCK_TEST_HOST') ?: '127.0.0.1',
                'port' => getenv('PGSQL_LOCK_TEST_PORT') ?: '5432',
                'database' => getenv('PGSQL_LOCK_TEST_WIRING_DATABASE') ?: 'imanapp_lock_test',
                'username' => getenv('PGSQL_LOCK_TEST_USERNAME') ?: 'postgres',
                'password' => getenv('PGSQL_LOCK_TEST_PASSWORD') ?: 'postgres',
            ],
        )]);
        config(['database.default' => 'pgsql']);
        DB::purge('pgsql');

        try {
            // This database must already carry the app's schema (migrated
            // once, out of band — see .github/workflows/ci.yml and
            // NIGHTLY.md's setup notes) — this test never runs migrations
            // itself, matching PerUserFoldLockTest's read-only footprint.
            DB::table('users')->count();
        } catch (Throwable $e) {
            $this->markTestSkipped(
                'no migrated Postgres reachable at PGSQL_LOCK_TEST_* / PGSQL_LOCK_TEST_WIRING_DATABASE — '
                .'this test is the ONLY proof the real callers route through PerUserFoldLock: '.$e->getMessage(),
            );
        }
    }

    private function rawPdo(): PDO
    {
        $host = getenv('PGSQL_LOCK_TEST_HOST') ?: '127.0.0.1';
        $port = getenv('PGSQL_LOCK_TEST_PORT') ?: '5432';
        $db = getenv('PGSQL_LOCK_TEST_WIRING_DATABASE') ?: 'imanapp_lock_test';
        $user = getenv('PGSQL_LOCK_TEST_USERNAME') ?: 'postgres';
        $pass = getenv('PGSQL_LOCK_TEST_PASSWORD') ?: 'postgres';

        return new PDO("pgsql:host={$host};port={$port};dbname={$db}", $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
    }

    /** Forks a genuinely separate process that holds `pg_advisory_lock($id)`
     *  for `$holdMs` milliseconds, then releases and hard-exits. Returns the
     *  child pid — caller must `pcntl_waitpid` it. */
    private function forkHolder(int $id, int $holdMs): int
    {
        $pid = pcntl_fork();
        $this->assertNotFalse($pid, 'fork failed');

        if ($pid === 0) {
            try {
                $child = $this->rawPdo();
                $child->prepare('select pg_advisory_lock(?)')->execute([$id]);
                usleep($holdMs * 1000);
                $child->prepare('select pg_advisory_unlock(?)')->execute([$id]);
            } finally {
                posix_kill(posix_getpid(), SIGKILL);
            }
        }

        usleep(100_000); // let the child actually acquire before we race it

        return $pid;
    }

    protected function setUp(): void
    {
        parent::setUp();
        if (! function_exists('pcntl_fork') || ! function_exists('posix_kill')) {
            $this->markTestSkipped('pcntl/posix not available — cannot fork a genuine second process');
        }
    }

    /**
     * BASELINE-RELATIVE, NOT A FIXED THRESHOLD. Both `rebuild()` and the
     * determinism check shell out to the Node fold-runner (`FoldRunnerProcess`)
     * even with zero lock contention — measured on this machine at ~390-410ms
     * of pure subprocess-startup overhead. A fixed "elapsed > 250ms" assertion
     * would pass on an UNWIRED tree too, on that overhead alone — exactly the
     * vacuous-verification shape this build has already shipped nine times
     * (HANDOVER.md's own count), just wearing a stopwatch. So every assertion
     * below measures this run's OWN unlocked baseline first, then requires the
     * locked run to exceed baseline by a margin tied to the fork's hold time,
     * not an assumed absolute number.
     */
    private const HOLD_MS = 1800;

    private const MARGIN_MS = 1200; // must exceed baseline by at least this much

    /**
     * MUTATION: revert `AtomCacheRebuilder::rebuild()` to call
     * `rebuildLocked()` directly, skipping `PerUserFoldLock::withLocks()` —
     * this test's margin assertion goes red (the locked run finishes at
     * roughly the same elapsed time as the baseline, racing past the other
     * session's held lock instead of waiting for it).
     */
    public function test_atom_cache_rebuilder_waits_for_a_concurrently_held_same_user_lock(): void
    {
        $this->usePostgresOrSkip();

        $user = User::factory()->create();
        Event::create([
            'user_id' => $user->id, 'uuid' => (string) Str::uuid(),
            'type' => 'rung_complete', 'ts' => 1_000, 'surah' => 112, 'ayah' => 1,
            'rung' => 'S2', 'correct' => true, 'received_at' => 1_000,
        ]);

        $baselineStart = microtime(true);
        app(AtomCacheRebuilder::class)->rebuild();
        $baselineMs = (microtime(true) - $baselineStart) * 1000;

        $pid = $this->forkHolder($user->id, self::HOLD_MS);

        $lockedStart = microtime(true);
        $result = app(AtomCacheRebuilder::class)->rebuild();
        $lockedMs = (microtime(true) - $lockedStart) * 1000;

        pcntl_waitpid($pid, $status);

        $this->assertGreaterThan(
            $baselineMs + self::MARGIN_MS,
            $lockedMs,
            sprintf(
                'rebuild() must wait for the other session\'s advisory lock on this exact user, not race past '
                .'it (baseline %.0fms, locked run %.0fms, expected at least %.0fms)',
                $baselineMs,
                $lockedMs,
                $baselineMs + self::MARGIN_MS,
            ),
        );
        $this->assertSame(1, $result['usersProcessed'], 'the rebuild still ran correctly once the lock freed');
        $this->assertGreaterThan(0, $result['atomsWritten']);

        $row = DB::table('atom_cache')->where('user_id', $user->id)->first();
        $this->assertNotNull($row, 'the rebuild actually wrote the row once unblocked');
    }

    /**
     * MUTATION: revert `sampleFromDatabase()`'s loop to read events/atom_cache
     * directly, skipping the `PerUserFoldLock::withLocks()` wrap around
     * `sampleOneUserLocked()` — this test's margin assertion goes red.
     */
    public function test_determinism_check_waits_for_a_concurrently_held_same_user_lock(): void
    {
        $this->usePostgresOrSkip();

        $user = User::factory()->create();
        Event::create([
            'user_id' => $user->id, 'uuid' => (string) Str::uuid(),
            'type' => 'rung_complete', 'ts' => 1_000, 'surah' => 112, 'ayah' => 1,
            'rung' => 'S2', 'correct' => true, 'received_at' => 1_000,
        ]);
        // A real prior rebuild so the fold check compares against a genuine
        // cache rather than reporting an unrelated divergence — timing is
        // what this test is about, not severity.
        app(AtomCacheRebuilder::class)->rebuild();

        $baselineStart = microtime(true);
        $baselineExit = Artisan::call('determinism:check', [
            'check' => 'fold',
            '--sample' => 5,
            '--no-record' => true,
        ]);
        $baselineMs = (microtime(true) - $baselineStart) * 1000;

        $pid = $this->forkHolder($user->id, self::HOLD_MS);

        $lockedStart = microtime(true);
        $lockedExit = Artisan::call('determinism:check', [
            'check' => 'fold',
            '--sample' => 5,
            '--no-record' => true,
        ]);
        $lockedMs = (microtime(true) - $lockedStart) * 1000;

        pcntl_waitpid($pid, $status);

        $this->assertSame(0, $baselineExit);
        $this->assertGreaterThan(
            $baselineMs + self::MARGIN_MS,
            $lockedMs,
            sprintf(
                'the nightly sampling read must wait for the other session\'s lock on this exact user, not race '
                .'past it (baseline %.0fms, locked run %.0fms, expected at least %.0fms)',
                $baselineMs,
                $lockedMs,
                $baselineMs + self::MARGIN_MS,
            ),
        );
        $this->assertSame(0, $lockedExit, 'the check still completed correctly once unblocked');
    }
}
