<?php

namespace Tests\Feature\Nightly;

use App\Console\Commands\DeterminismCheckCommand;
use App\Models\Event;
use App\Models\NightlyCheckRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The RUNNER's own contract: it invokes the Node fold-runner, decodes the
 * EXIT CODE into BUILD-PLAN's taxonomy, and appends an immutable ledger row.
 *
 * These tests run the real command against the real fold-runner (fixture
 * mode) — no mocked subprocess. A test that stubbed the runner would prove
 * only that PHP can read a number it wrote itself, which is exactly the
 * class of vacuous verification this build has already shipped eight of.
 */
class DeterminismCheckCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // The fold-runner must be present for these tests to mean anything.
        $runner = config('nightly.vite_node');
        if (! is_string($runner) || ! is_file($runner)) {
            $this->markTestSkipped("fold-runner not installed at {$runner} — run npm install in worker/fold-runner");
        }
    }

    public function test_fixture_run_is_green_and_records_a_ledger_row_per_check(): void
    {
        $this->artisan('determinism:check', ['check' => 'both', '--fixture' => true, '--night' => '2026-09-01'])
            ->assertExitCode(0);

        $runs = NightlyCheckRun::query()->orderBy('check')->get();

        $this->assertCount(2, $runs);
        $this->assertSame(NightlyCheckRun::CHECKS, $runs->pluck('check')->sort()->values()->all());
        foreach ($runs as $run) {
            $this->assertSame('green', $run->severity);
            $this->assertSame(0, $run->exit_code);
            $this->assertSame('2026-09-01', $run->night);
        }
    }

    public function test_the_fold_run_actually_compared_atoms_evidence_not_a_bare_green(): void
    {
        // The whole point of storing the report: a green row that compared
        // nothing is indistinguishable from a green row that compared
        // everything, unless the evidence is on the row.
        $this->artisan('determinism:check', ['check' => 'fold', '--fixture' => true])->assertExitCode(0);

        $run = NightlyCheckRun::query()->where('check', 'fold_determinism_check')->firstOrFail();

        $this->assertGreaterThan(0, $run->report['atomsCompared']);
        $this->assertSame(0, $run->report['divergentCount']);
    }

    public function test_the_selection_run_actually_compared_traces(): void
    {
        $this->artisan('determinism:check', ['check' => 'selection'])->assertExitCode(0);

        $run = NightlyCheckRun::query()->where('check', 'selection_determinism_check')->firstOrFail();

        $this->assertGreaterThan(0, $run->report['tracesCompared']);
        $this->assertSame([], $run->report['divergences']);
    }

    /**
     * `config('nightly.sample_size')` ("How many learners the fold check
     * samples per night") is the operator-facing knob for the nightly's
     * sample size — but `DeterminismCheckCommand`'s own signature hardcodes
     * a SECOND, independent default (`{--sample=50}`), and the scheduled
     * invocation (`routes/console.php`) never passes `--sample` at all. So
     * `NIGHTLY_SAMPLE_SIZE` had zero effect on the run that actually feeds
     * the launch-gate ledger every night — an operator narrowing or
     * widening the nightly sample in production silently did nothing.
     *
     * MUTATION: reverting the config-fallback (making `runFold()` always
     * use the signature default regardless of config) goes back to
     * `usersChecked === 3` here, proving this assertion is load-bearing.
     */
    public function test_the_nightly_sample_size_config_is_honoured_when_no_sample_flag_is_given(): void
    {
        $users = collect(range(1, 3))->map(function (int $i) {
            $user = User::factory()->create();
            Event::create([
                'user_id' => $user->id, 'uuid' => (string) Str::uuid(),
                'type' => 'rung_complete', 'ts' => 1_000 + $i, 'surah' => 112, 'ayah' => 1,
                'rung' => 'S2', 'correct' => true, 'received_at' => 1_000 + $i,
            ]);

            return $user;
        });

        // Genuine clean atom_cache for all three, via the real fold-runner —
        // same discipline as the poisoned-learner test above.
        app(\App\Support\AtomCacheRebuilder::class)->rebuild();

        config(['nightly.sample_size' => 2]);

        // No --sample flag — this is exactly what the nightly schedule does.
        $this->artisan('determinism:check', ['check' => 'fold'])->assertExitCode(0);

        $run = NightlyCheckRun::query()->where('check', 'fold_determinism_check')->firstOrFail();

        $this->assertSame(
            2,
            $run->report['usersChecked'],
            'config(nightly.sample_size) must cap the sample when --sample is not given',
        );
        $this->assertCount(3, $users, 'sanity: three learners exist so the cap is actually exercised');
    }

    public function test_an_explicit_sample_flag_still_overrides_config(): void
    {
        $users = collect(range(1, 3))->map(function (int $i) {
            $user = User::factory()->create();
            Event::create([
                'user_id' => $user->id, 'uuid' => (string) Str::uuid(),
                'type' => 'rung_complete', 'ts' => 1_000 + $i, 'surah' => 112, 'ayah' => 1,
                'rung' => 'S2', 'correct' => true, 'received_at' => 1_000 + $i,
            ]);

            return $user;
        });

        app(\App\Support\AtomCacheRebuilder::class)->rebuild();

        config(['nightly.sample_size' => 2]);

        $this->artisan('determinism:check', ['check' => 'fold', '--sample' => 1])->assertExitCode(0);

        $run = NightlyCheckRun::query()->where('check', 'fold_determinism_check')->firstOrFail();

        $this->assertSame(1, $run->report['usersChecked'], 'an explicit --sample must win over config');
        $this->assertCount(3, $users);
    }

    public function test_an_empty_database_sample_is_an_ERROR_night_never_a_green_one(): void
    {
        // No users, no events — the DB-fed path with nothing to sample.
        // BUILD-PLAN counts green nights; a night that compared nothing must
        // not be one of them.
        $this->artisan('determinism:check', ['check' => 'fold'])->assertExitCode(1);

        $run = NightlyCheckRun::query()->where('check', 'fold_determinism_check')->firstOrFail();

        $this->assertSame('error', $run->severity);
        $this->assertSame(5, $run->exit_code);
        $this->assertStringContainsString('no learners', $run->report['error']);
    }

    public function test_an_error_night_does_NOT_publish_a_fabricated_zero_to_the_health_cache(): void
    {
        // Edge case #167: "THE FAILURE PATH RETURNS NULL, NOT ZERO. A `?? 0`
        // here would paint a green dashboard over a blind system."
        Cache::forget('health:fold_determinism_check');

        $this->artisan('determinism:check', ['check' => 'fold'])->assertExitCode(1);

        $this->assertNull(
            Cache::get('health:fold_determinism_check'),
            'an error night must leave the dashboard at `unknown`, never write 0',
        );
    }

    public function test_a_green_run_publishes_the_health_key_the_dashboard_reads(): void
    {
        Cache::forget('health:fold_determinism_check');

        $this->artisan('determinism:check', ['check' => 'fold', '--fixture' => true])->assertExitCode(0);

        // Before this command existed, NOTHING in the codebase wrote this
        // key — SystemHealthController read it and always found null.
        $this->assertSame(0, Cache::get('health:fold_determinism_check'));
    }

    public function test_no_record_runs_the_check_without_appending_to_the_ledger(): void
    {
        $this->artisan('determinism:check', ['check' => 'fold', '--fixture' => true, '--no-record' => true])
            ->assertExitCode(0);

        $this->assertSame(0, NightlyCheckRun::query()->count());
    }

    public function test_a_held_lock_makes_the_run_skip_rather_than_record_a_bogus_night(): void
    {
        // Single-flight: two overlapping runs comparing the same cache can
        // produce a divergence neither would see alone. The second must not
        // append a row at all — a skipped run is not a night.
        $lock = Cache::lock(DeterminismCheckCommand::LOCK, 60);
        $this->assertTrue($lock->get());

        try {
            $this->artisan('determinism:check', ['check' => 'fold', '--fixture' => true])
                ->assertExitCode(1);
            $this->assertSame(0, NightlyCheckRun::query()->count());
        } finally {
            $lock->release();
        }
    }

    public function test_an_unknown_check_name_is_rejected(): void
    {
        $this->artisan('determinism:check', ['check' => 'nonsense'])->assertExitCode(1);
        $this->assertSame(0, NightlyCheckRun::query()->count());
    }

    /**
     * Edge case #130 (BUILD-PLAN.md:346) — "Malformed/unparseable snapshot:
     * poison event wedges fold" → "dead-letter quarantine; fold skips +
     * alerts; log intact."
     *
     * `sampleFromDatabase()` batches every sampled learner into ONE envelope
     * and `json_encode()`s it whole before handing it to the fold-runner.
     * That call fails ATOMICALLY on the first invalid-UTF8 byte anywhere in
     * the payload (PHP's own `json_encode` contract) — so one learner's
     * corrupted `device_id` (a real reachable shape: a buggy client, a bad
     * migration, or direct DB surgery; nothing here goes through Eloquent's
     * casts) silently blanks the WHOLE stdin envelope. Without a fix, the
     * fold-runner then reports "no input on stdin" as an ERROR night — for
     * every OTHER, perfectly clean, learner sampled alongside the poisoned
     * one, night after night, until a human happens to notice and hand-fixes
     * the row.
     *
     * MUTATION: skip the per-learner `json_encode` guard in
     * `sampleFromDatabase()` and merge every sample into the envelope
     * unconditionally — this test goes back to asserting `error`/`no input`.
     */
    public function test_a_single_poisoned_learner_never_wedges_the_whole_nightly_run(): void
    {
        $clean = User::factory()->create();
        Event::create([
            'user_id' => $clean->id, 'uuid' => (string) Str::uuid(),
            'type' => 'rung_complete', 'ts' => 1_000, 'surah' => 112, 'ayah' => 1,
            'rung' => 'S2', 'correct' => true, 'received_at' => 1_000,
        ]);

        $poisoned = User::factory()->create();
        Event::create([
            'user_id' => $poisoned->id, 'uuid' => (string) Str::uuid(),
            'type' => 'rung_complete', 'ts' => 1_000, 'surah' => 112, 'ayah' => 1,
            'rung' => 'S2', 'correct' => true, 'received_at' => 1_000,
        ]);

        // Seed BOTH learners' atom_cache from their still-clean events, via
        // the real fold-runner (the same mechanism SystemHealthTest's own
        // rebuild proof uses) — so the CLEAN learner's cache genuinely
        // matches a fresh fold and contributes zero findings of its own.
        // Without this, an empty cache reads as its own real divergence
        // (foldCheck.ts: "a key present in the fresh fold but ABSENT from
        // the cache... is a genuine divergence"), which would confound a
        // dead-letter-only night with an ordinary P1 for a different reason.
        app(\App\Support\AtomCacheRebuilder::class)->rebuild();

        // NOW corrupt the poisoned learner's stored row — after their cache
        // was already (correctly) computed from the clean version, so this
        // reproduces a row whose corruption exists specifically at
        // determinism-check time. A raw update bypasses Eloquent's casts
        // entirely, the same route a corrupted row can reach this table
        // through in production. `device_id` is forwarded verbatim by
        // EventWireCodec.
        DB::table('events')->where('user_id', $poisoned->id)
            ->update(['device_id' => "\xB1\x31"]); // invalid UTF-8 — json_encode() fails on this byte alone

        $this->artisan('determinism:check', ['check' => 'fold'])->assertExitCode(0);

        $run = NightlyCheckRun::query()->where('check', 'fold_determinism_check')->firstOrFail();

        $this->assertSame(
            'warn',
            $run->severity,
            'a dead-lettered learner is never silently green, but the poisoned row alone must not page a P1 either',
        );
        $this->assertGreaterThan(
            0,
            $run->report['atomsCompared'],
            'the clean learner was actually compared — the poisoned one did not swallow the whole run',
        );
        $this->assertCount(1, $run->report['deadLetters'], 'exactly the poisoned learner is quarantined, not the clean one');
        $this->assertSame($poisoned->id, $run->report['deadLetters'][0]['userId']);

        $this->assertNotNull(
            Event::where('user_id', $poisoned->id)->first(),
            '"log intact" — the poisoned event is quarantined from tonight\'s comparison, never deleted or edited',
        );
    }

    public function test_the_exit_code_map_matches_the_runners_severity_module(): void
    {
        // If worker/fold-runner/src/severity.ts ever changes its EXIT_CODE
        // table, this assertion is where the drift surfaces — before a
        // 3am P1 gets silently decoded as green.
        $severityTs = file_get_contents(
            base_path('../worker/fold-runner/src/severity.ts')
        );
        $this->assertIsString($severityTs);

        foreach (DeterminismCheckCommand::SEVERITY_BY_EXIT as $code => $severity) {
            $this->assertMatchesRegularExpression(
                '/'.preg_quote($severity, '/').':\s*'.$code.'\b/',
                $severityTs,
                "severity.ts no longer maps '{$severity}' to exit {$code}",
            );
        }
    }
}
