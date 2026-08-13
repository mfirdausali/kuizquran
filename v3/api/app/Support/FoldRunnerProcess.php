<?php

namespace App\Support;

use Symfony\Component\Process\Process;

/**
 * The ONE place Laravel shells out to the Node fold-runner (v3-D08: the
 * fold-runner is the sole server-side fold — PHP never re-implements engine
 * logic). Extracted from `DeterminismCheckCommand::invokeRunner()` so a
 * second caller — `AtomCacheRebuilder` — does not grow a second, silently
 * drifting copy of "how do we invoke a fold-runner bin script and decode its
 * JSON report" (the exact failure shape v3-D49 names: two detectors that
 * disagree because nobody kept them in sync).
 */
class FoldRunnerProcess
{
    /**
     * @param  list<string>  $args  bin script path (relative to the fold-runner
     *                              package root) plus any CLI flags.
     * @return array{0:int,1:array<string,mixed>} exit code, decoded JSON report.
     */
    public static function run(array $args, ?string $stdin): array
    {
        $runnerDir = (string) config('nightly.fold_runner_path', base_path('../worker/fold-runner'));
        $node = (string) config('nightly.vite_node', $runnerDir.'/node_modules/.bin/vite-node');

        if (! is_dir($runnerDir) || ! is_file($node)) {
            return [5, [
                'severity' => 'error',
                'error' => "fold-runner not runnable: expected {$node}. Run `npm install` in worker/fold-runner.",
            ]];
        }

        $process = new Process([$node, ...$args], $runnerDir, null, $stdin, 900);
        $process->run();

        $exit = $process->getExitCode() ?? 5;
        $out = trim($process->getOutput());
        $report = json_decode($out, true);
        if (! is_array($report)) {
            // The runner is contracted to print JSON on EVERY path. If it did
            // not, we do not guess — the caller gets an error report with the
            // raw output preserved as evidence.
            $report = [
                'severity' => 'error',
                'error' => 'runner produced no parseable JSON report',
                'stdout' => mb_substr($out, 0, 2000),
                'stderr' => mb_substr(trim($process->getErrorOutput()), 0, 2000),
            ];
            $exit = 5;
        }

        return [$exit, $report];
    }
}
