<?php

namespace Tests\Feature\Nightly;

use App\Console\Commands\DeterminismCheckCommand;
use App\Models\NightlyCheckRun;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
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
