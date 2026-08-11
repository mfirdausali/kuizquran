<?php

namespace App\Console\Commands;

use App\Models\NightlyWindow;
use App\Support\NightlyWindowLedger;
use Illuminate\Console\Command;

/**
 * Reports the 7-consecutive-green-nights streak WITH ITS EVIDENCE, and
 * stamps the window start.
 *
 * The evidence is the point. LAUNCH-CHECKLIST gate 10 currently reads
 * "BLOCKED-ON-INFRA … the window has not started". When it eventually reads
 * something else, the sentence that replaces it should be checkable by
 * running one command and looking at seven dated rows — not by trusting a
 * number. Edge case #169 anticipates this gate being CONTESTED; a table of
 * nights, each naming what its checks actually compared, is what settles a
 * contest.
 *
 * `--start` is BUILD-PLAN's "starts only after the last engine/selection
 * merge". It is deliberately a human action with a required reason: no
 * automation can know whether today's merge touched selection semantics, and
 * a window that silently restarted itself would be worthless.
 *
 * Exit code is the gate: 0 when the window is satisfied, 1 when it is not,
 * so a launch script can depend on it rather than on a human reading output.
 */
class NightlyWindowCommand extends Command
{
    protected $signature = 'nightly:window
        {--start= : Stamp the window start date (YYYY-MM-DD or "today") — do this after the last engine/selection merge}
        {--reason= : Why the window (re)started — required with --start}
        {--json : Emit the full status as JSON}';

    protected $description = 'Report the 7-consecutive-green-nights streak with its evidence, or stamp the window start';

    public function handle(): int
    {
        if ($start = $this->option('start')) {
            $reason = (string) ($this->option('reason') ?? '');
            if (trim($reason) === '') {
                $this->error('--reason is required with --start (e.g. --reason="engine merge abc1234"). An unexplained window start is unauditable.');

                return self::FAILURE;
            }
            $date = $start === 'today' ? gmdate('Y-m-d') : (string) $start;
            if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                $this->error("--start must be YYYY-MM-DD or 'today', got '{$date}'");

                return self::FAILURE;
            }
            $window = NightlyWindow::current();
            $window->fill([
                'window_started_at' => $date,
                'reason' => $reason,
                'updated_at_ms' => (int) round(microtime(true) * 1000),
            ])->save();
            $this->info("window start stamped: {$date} — {$reason}");
            $this->line('Nights before this date will NOT count toward the streak, however green.');
        }

        $status = NightlyWindowLedger::status();

        if ($this->option('json')) {
            $this->line((string) json_encode($status, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return $status['satisfied'] ? self::SUCCESS : self::FAILURE;
        }

        $this->newLine();
        $this->line('7-consecutive-green-nights window');
        $this->line(str_repeat('─', 60));
        $this->line('  window started : '.($status['windowStartedAt'] ?? 'NOT DECLARED'));
        if ($status['windowReason']) {
            $this->line('  reason         : '.$status['windowReason']);
        }
        $this->line(sprintf('  streak         : %d of %d', $status['streak'], $status['required']));
        $this->line('  satisfied      : '.($status['satisfied'] ? 'YES' : 'NO'));
        if ($status['lastP1']) {
            $this->line(sprintf(
                '  last P1        : %s (%s) — reset the window',
                $status['lastP1']['night'],
                $status['lastP1']['check'],
            ));
        }
        if ($status['blockedBy']) {
            $this->line('  blocked by     : '.$status['blockedBy']);
        }

        if ($status['nights'] !== []) {
            $this->newLine();
            $this->line('  Evidence — every night since the window start:');
            $rows = [];
            foreach ($status['nights'] as $n) {
                $detail = [];
                foreach ($n['severities'] as $check => $sev) {
                    $detail[] = str_replace('_determinism_check', '', $check).'='.$sev;
                }
                foreach ($n['missing'] as $m) {
                    $detail[] = str_replace('_determinism_check', '', $m).'=MISSING';
                }
                $rows[] = [$n['night'], $n['green'] ? 'green' : 'NOT GREEN', implode('  ', $detail)];
            }
            $this->table(['night', 'counts?', 'checks'], $rows);
        }

        $this->newLine();

        return $status['satisfied'] ? self::SUCCESS : self::FAILURE;
    }
}
