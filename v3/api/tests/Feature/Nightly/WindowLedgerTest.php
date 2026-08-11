<?php

namespace Tests\Feature\Nightly;

use App\Models\NightlyCheckRun;
use App\Models\NightlyWindow;
use App\Support\NightlyWindowLedger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BUILD-PLAN M10 / edge case #169: "7-green-nights arithmetic → contested
 * gate → defined: confirmed P1 resets the window; WARN (version skew) does
 * not."
 *
 * These tests assert the OUTPUT — the derived streak number and which nights
 * it counted — never the ingredient. Every case builds ledger rows and asks
 * the ledger what the streak is; none of them checks that a method was
 * called or that a row exists.
 */
class WindowLedgerTest extends TestCase
{
    use RefreshDatabase;

    private function window(string $start = '2026-09-01'): void
    {
        NightlyWindow::current()->fill([
            'window_started_at' => $start,
            'reason' => 'test',
            'updated_at_ms' => 0,
        ])->save();
    }

    /** Append a run for one check on one night. */
    private function appendRun(string $night, string $check, string $severity): void
    {
        $exit = ['green' => 0, 'warn' => 3, 'p1' => 4, 'error' => 5][$severity];
        NightlyCheckRun::create([
            'check' => $check,
            'night' => $night,
            'severity' => $severity,
            'exit_code' => $exit,
            'report' => ['atomsCompared' => 8],
            'trigger' => 'test',
            'ran_at' => 0,
        ]);
    }

    /** A full night: both checks at the same severity. */
    private function night(string $night, string $severity): void
    {
        foreach (NightlyCheckRun::CHECKS as $check) {
            $this->appendRun($night, $check, $severity);
        }
    }

    /** @return list<string> seven consecutive dates from 2026-09-01 */
    private function week(): array
    {
        return array_map(fn (int $i) => date('Y-m-d', strtotime("2026-09-01 +{$i} day")), range(0, 6));
    }

    public function test_seven_green_nights_satisfies_the_window(): void
    {
        $this->window();
        foreach ($this->week() as $d) {
            $this->night($d, 'green');
        }

        $status = NightlyWindowLedger::status();

        $this->assertSame(7, $status['streak']);
        $this->assertTrue($status['satisfied']);
        $this->assertNull($status['blockedBy']);
    }

    public function test_six_green_nights_does_not_satisfy_the_window(): void
    {
        $this->window();
        foreach (array_slice($this->week(), 0, 6) as $d) {
            $this->night($d, 'green');
        }

        $status = NightlyWindowLedger::status();

        $this->assertSame(6, $status['streak']);
        $this->assertFalse($status['satisfied']);
        $this->assertSame('6 of 7 consecutive green nights', $status['blockedBy']);
    }

    // ══════════════════════════════════════════════════════════════════════
    // THE TWO RULES THE GATE TURNS ON
    // ══════════════════════════════════════════════════════════════════════

    public function test_a_confirmed_p1_RESETS_the_window_to_zero(): void
    {
        $this->window();
        $days = $this->week();
        // Six green, then a P1 on the seventh. Without the reset rule this
        // would read as a 6-night streak one night from launch.
        foreach (array_slice($days, 0, 6) as $d) {
            $this->night($d, 'green');
        }
        $this->night($days[6], 'p1');

        $status = NightlyWindowLedger::status();

        $this->assertSame(0, $status['streak'], 'a P1 must reset the streak to zero, not merely pause it');
        $this->assertFalse($status['satisfied']);
        $this->assertSame($days[6], $status['lastP1']['night']);
    }

    public function test_a_p1_mid_window_restarts_counting_from_the_night_after(): void
    {
        $this->window();
        $days = $this->week();
        $this->night($days[0], 'green');
        $this->night($days[1], 'p1');       // resets
        $this->night($days[2], 'green');    // 1
        $this->night($days[3], 'green');    // 2
        $this->night($days[4], 'green');    // 3

        $status = NightlyWindowLedger::status();

        $this->assertSame(3, $status['streak']);
        $this->assertSame($days[1], $status['lastP1']['night']);
    }

    public function test_a_WARN_does_NOT_reset_the_window(): void
    {
        $this->window();
        $days = $this->week();
        // A version-skew WARN in the middle of the week. BUILD-PLAN: "WARN
        // does not [reset]". If it did, no engine could be deployed inside
        // the seven days and the gate would be unreachable, not strict.
        foreach ([0, 1, 2] as $i) {
            $this->night($days[$i], 'green');
        }
        $this->night($days[3], 'warn');
        foreach ([4, 5, 6] as $i) {
            $this->night($days[$i], 'green');
        }

        $status = NightlyWindowLedger::status();

        $this->assertSame(7, $status['streak'], 'a WARN night still counts toward the seven');
        $this->assertTrue($status['satisfied']);
        $this->assertNull($status['lastP1']);
    }

    public function test_a_warn_on_one_check_and_green_on_the_other_still_counts(): void
    {
        $this->window();
        foreach ($this->week() as $d) {
            $this->appendRun($d, 'fold_determinism_check', 'warn');
            $this->appendRun($d, 'selection_determinism_check', 'green');
        }

        $this->assertSame(7, NightlyWindowLedger::status()['streak']);
    }

    public function test_a_p1_on_EITHER_check_alone_resets_the_window(): void
    {
        $this->window();
        $days = $this->week();
        foreach (array_slice($days, 0, 3) as $d) {
            $this->night($d, 'green');
        }
        // Only selection went P1; fold was green that night.
        $this->appendRun($days[3], 'fold_determinism_check', 'green');
        $this->appendRun($days[3], 'selection_determinism_check', 'p1');

        $status = NightlyWindowLedger::status();

        $this->assertSame(0, $status['streak']);
        $this->assertSame('selection_determinism_check', $status['lastP1']['check']);
    }

    // ══════════════════════════════════════════════════════════════════════
    // THE WAYS THE GATE GETS PASSED BY ACCIDENT
    // ══════════════════════════════════════════════════════════════════════

    public function test_a_missing_night_breaks_the_streak_gaps_are_not_green(): void
    {
        $this->window();
        $days = $this->week();
        // Four green, a night where the scheduler never fired, then three
        // more green. A naive count(green) would say 7.
        foreach ([0, 1, 2, 3] as $i) {
            $this->night($days[$i], 'green');
        }
        foreach ([5, 6] as $i) {
            $this->night($days[$i], 'green');
        }

        $status = NightlyWindowLedger::status();

        $this->assertSame(2, $status['streak'], 'a night with no runs at all cannot count as green');
        $this->assertFalse($status['satisfied']);
        $gap = collect($status['nights'])->firstWhere('night', $days[4]);
        $this->assertFalse($gap['green']);
        $this->assertSame(NightlyCheckRun::CHECKS, $gap['missing']);
    }

    public function test_a_night_with_only_ONE_check_is_not_a_green_night(): void
    {
        $this->window();
        $days = $this->week();
        foreach ($days as $i => $d) {
            $this->appendRun($d, 'fold_determinism_check', 'green');
            // selection never ran on day 3
            if ($i !== 3) {
                $this->appendRun($d, 'selection_determinism_check', 'green');
            }
        }

        $status = NightlyWindowLedger::status();

        $this->assertSame(3, $status['streak'], 'BUILD-PLAN requires BOTH checks green nightly');
        $missing = collect($status['nights'])->firstWhere('night', $days[3])['missing'];
        $this->assertSame(['selection_determinism_check'], $missing);
    }

    public function test_an_ERROR_night_does_not_count_green_and_does_not_reset_to_zero(): void
    {
        $this->window();
        $days = $this->week();
        $this->night($days[0], 'green');
        $this->night($days[1], 'error');   // check could not run
        $this->night($days[2], 'green');
        $this->night($days[3], 'green');

        $status = NightlyWindowLedger::status();

        // The error ends the run (unobserved night), but is not a confirmed
        // divergence — no lastP1 is recorded for it.
        $this->assertSame(2, $status['streak']);
        $this->assertNull($status['lastP1']);
    }

    public function test_nights_BEFORE_the_window_start_never_count(): void
    {
        // Seven perfectly green nights in August; the window starts in
        // September because that is when the engine last merged. BUILD-PLAN:
        // "starts only after the last engine/selection merge."
        foreach (range(0, 6) as $i) {
            $this->night(date('Y-m-d', strtotime("2026-08-01 +{$i} day")), 'green');
        }
        $this->window('2026-09-01');

        $status = NightlyWindowLedger::status();

        $this->assertSame(0, $status['streak']);
        $this->assertFalse($status['satisfied']);
        $this->assertSame('no check runs recorded since the window start', $status['blockedBy']);
    }

    public function test_no_declared_window_start_reports_zero_with_a_reason_never_a_usable_number(): void
    {
        foreach ($this->week() as $d) {
            $this->night($d, 'green');
        }
        // No window() call — nothing declared.

        $status = NightlyWindowLedger::status();

        $this->assertSame(0, $status['streak']);
        $this->assertFalse($status['satisfied']);
        $this->assertStringContainsString('no window start declared', $status['blockedBy']);
    }

    public function test_a_rerun_after_a_p1_does_not_launder_that_night(): void
    {
        $this->window();
        $days = $this->week();
        foreach (array_slice($days, 0, 3) as $d) {
            $this->night($d, 'green');
        }
        $this->night($days[3], 'p1');
        // Someone fixes the cause and re-runs the SAME night, green.
        $this->night($days[3], 'green');

        $status = NightlyWindowLedger::status();

        $night = collect($status['nights'])->firstWhere('night', $days[3]);
        $this->assertFalse($night['green'], 'a re-run must not erase a confirmed P1 from its own night');
        $this->assertSame(0, $status['streak']);
    }

    public function test_the_window_command_exit_code_is_the_gate(): void
    {
        $this->window();
        foreach (array_slice($this->week(), 0, 6) as $d) {
            $this->night($d, 'green');
        }
        $this->artisan('nightly:window')->assertExitCode(1);

        $this->night($this->week()[6], 'green');
        $this->artisan('nightly:window')->assertExitCode(0);
    }

    public function test_window_start_requires_a_reason(): void
    {
        $this->artisan('nightly:window', ['--start' => 'today'])->assertExitCode(1);
        $this->assertNull(NightlyWindow::current()->window_started_at);

        $this->artisan('nightly:window', ['--start' => '2026-09-01', '--reason' => 'engine merge abc1234'])
            ->assertExitCode(1); // still not satisfied — 0 nights
        $this->assertSame('2026-09-01', NightlyWindow::current()->fresh()->window_started_at);
    }
}
