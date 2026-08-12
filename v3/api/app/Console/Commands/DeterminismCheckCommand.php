<?php

namespace App\Console\Commands;

use App\Mail\DeterminismP1Alert;
use App\Models\Event;
use App\Models\NightlyCheckRun;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE NIGHTLY RUNNER — the thing that makes the 7-night window STARTABLE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Before this command, `SystemHealthController::foldDeterminism()` read
 * `Cache::get('health:fold_determinism_check')` and **nothing in the entire
 * codebase ever wrote that key**. The dashboard correctly rendered `unknown`
 * (edge case #167) — forever, because the check it was reporting on had no
 * runner. LAUNCH-CHECKLIST gates 3 and 4 say exactly this:
 * "**Missing:** a live staging host running the fold-runner nightly."
 *
 * This command is the missing half. It:
 *   1. samples learners' server logs + their live atom_cache rows,
 *   2. hands them to the Node fold-runner over stdin (v3-D08: Node is the
 *      SOLE server-side fold; PHP never re-implements engine logic — note
 *      there is no fold arithmetic anywhere in this file),
 *   3. decodes the runner's EXIT CODE into the BUILD-PLAN taxonomy,
 *   4. appends an immutable ledger row, and
 *   5. writes the health cache key the dashboard has been waiting for.
 *
 * ── SINGLE-FLIGHT, HONESTLY ──
 * v3-D32 deferred per-user Postgres advisory locks, and this repo's dev DB
 * is sqlite, which has no `pg_advisory_lock` to test against. Rather than
 * write an untestable Postgres-only path and claim it works, this command
 * single-flights at the RUN level with Laravel's own atomic cache lock
 * (`Cache::lock`) — the same mechanism `SystemHealthController::REBUILD_LOCK`
 * already uses for the atom-cache rebuild, and for the same reason: two
 * concurrent runs comparing the same cache while a rebuild interleaves can
 * produce a divergence neither run would see alone, which then reads as a
 * P1 that never happened.
 *
 * What that buys and what it does not: a run-level lock prevents two
 * NIGHTLIES overlapping. It does NOT prevent a nightly from reading a
 * learner's cache midway through a concurrent per-user refold — that is what
 * the deferred per-user advisory lock is for, and it remains deferred. This
 * command therefore SNAPSHOTS each learner's event log by ingest-sequence
 * ceiling (`id <= :cursor`) so at least the log side of the comparison is a
 * consistent read; the cache side can still be mid-write, which is why a
 * live P1 must be re-run before it is called "confirmed". `--confirm-reruns`
 * exists for exactly that, and the ledger's own reset semantics use the word
 * BUILD-PLAN uses: *confirmed* P1.
 */
class DeterminismCheckCommand extends Command
{
    protected $signature = 'determinism:check
        {check=both : fold | selection | both}
        {--fixture : Run against committed fixtures instead of the database (no DB needed)}
        {--sample=50 : How many learners to sample for the fold check}
        {--trigger=manual : Recorded on the ledger row: schedule | manual | ci}
        {--night= : Override the UTC night date (YYYY-MM-DD) — tests and backfills only}
        {--no-record : Run and print the verdict without appending a ledger row}';

    protected $description = 'Run fold_determinism_check / selection_determinism_check and record the verdict in the nightly window ledger';

    public const LOCK = 'nightly:determinism-check';

    /** worker/fold-runner/src/severity.ts's EXIT_CODE, inverted. An
     *  unrecognized code is 'error' — never silently 'green'. */
    public const SEVERITY_BY_EXIT = [
        0 => 'green',
        3 => 'warn',
        4 => 'p1',
        5 => 'error',
    ];

    public function handle(): int
    {
        $which = (string) $this->argument('check');
        $checks = match ($which) {
            'fold' => ['fold'],
            'selection' => ['selection'],
            'both' => ['fold', 'selection'],
            default => null,
        };
        if ($checks === null) {
            $this->error("unknown check '{$which}' — expected fold | selection | both");

            return self::FAILURE;
        }

        $lock = Cache::lock(self::LOCK, 3600);
        if (! $lock->get()) {
            // NOT a green run and NOT a failure of the checks — another run
            // holds the lock. Reported as such rather than recorded.
            $this->warn('another determinism run holds the lock; skipping (no ledger row appended)');

            return self::FAILURE;
        }

        try {
            $worst = 'green';
            foreach ($checks as $check) {
                $severity = $check === 'fold' ? $this->runFold() : $this->runSelection();
                $worst = $this->worse($worst, $severity);
            }

            // The command's own exit code mirrors the taxonomy so a cron
            // wrapper or CI step sees the same verdict the ledger recorded.
            return match ($worst) {
                'green', 'warn' => self::SUCCESS,
                default => self::FAILURE,
            };
        } finally {
            $lock->release();
        }
    }

    private function worse(string $a, string $b): string
    {
        $rank = ['green' => 0, 'warn' => 1, 'error' => 2, 'p1' => 3];

        return ($rank[$b] ?? 3) > ($rank[$a] ?? 3) ? $b : $a;
    }

    // ══════════════════════════════════════════════════════════════════════
    // fold_determinism_check
    // ══════════════════════════════════════════════════════════════════════

    private function runFold(): string
    {
        if ($this->option('fixture')) {
            [$exit, $report] = $this->invokeRunner(
                ['bin/fold-determinism-check.ts', '--fixture'],
                null,
            );

            return $this->record('fold_determinism_check', $exit, $report);
        }

        $envelope = $this->sampleFromDatabase((int) $this->option('sample'));

        // v3-D50's lesson, at the sampling layer: an empty sample is an
        // ERROR night, not a green one. The runner enforces this too; doing
        // it here as well means a broken sampler is reported by whichever
        // layer notices first, never swallowed by both.
        if ($envelope['samples'] === []) {
            $report = [
                'check' => 'fold_determinism_check',
                'severity' => 'error',
                'error' => 'sampler returned no learners — nothing to compare, refusing to report green',
                'usersChecked' => 0,
                'atomsCompared' => 0,
            ];

            return $this->record('fold_determinism_check', 5, $report);
        }

        [$exit, $report] = $this->invokeRunner(
            ['bin/fold-determinism-check.ts'],
            json_encode($envelope, JSON_UNESCAPED_SLASHES),
        );

        return $this->record('fold_determinism_check', $exit, $report);
    }

    /**
     * Build the runner's stdin envelope from the database.
     *
     * SNAPSHOT DISCIPLINE. Each learner's log is read with an ingest-sequence
     * ceiling (`events.id <= max at sample time`). Without it, an event
     * arriving between the log read and the cache read would appear in the
     * fold but not in the cache and be reported as a divergence that is
     * really just a race — the single most likely source of a false P1 at
     * 3am, and the fastest way to teach a team to ignore the pager.
     *
     * NOTE ON THE SAMPLE. `--sample` picks the learners with the most
     * recent activity, not a random subset: the cache rows most likely to be
     * wrong are the ones most recently written. A uniform random sample over
     * a mostly-idle user base spends its budget re-verifying atoms that have
     * not changed in months.
     *
     * @return array{engineVersion:string,samples:list<array<string,mixed>>}
     */
    private function sampleFromDatabase(int $limit): array
    {
        $cursor = (int) (Event::query()->max('id') ?? 0);

        $userIds = Event::query()
            ->where('id', '<=', $cursor)
            ->select('user_id')
            ->groupBy('user_id')
            ->orderByRaw('MAX(id) desc')
            ->limit(max(1, $limit))
            ->pluck('user_id')
            ->all();

        $samples = [];
        foreach ($userIds as $userId) {
            $events = Event::query()
                ->where('user_id', $userId)
                ->where('id', '<=', $cursor)
                ->orderBy('id')
                ->get()
                ->map(fn (Event $e) => $this->toWireEvent($e))
                ->all();

            $liveCache = [];
            $versions = [];
            $rows = DB::table('atom_cache')->where('user_id', $userId)->get();
            foreach ($rows as $row) {
                $key = "{$row->surah}:{$row->kind}:{$row->ref}";
                $liveCache[$key] = [
                    'surah' => (int) $row->surah,
                    'kind' => (string) $row->kind,
                    'ref' => (int) $row->ref,
                    'strength' => (float) $row->strength,
                    'stability' => (float) $row->stability,
                    'difficulty' => (float) $row->difficulty,
                    'lastRetrieval' => $row->last_retrieval === null ? null : (int) $row->last_retrieval,
                    'reps' => (int) $row->reps,
                    'lapses' => (int) $row->lapses,
                    'encoded' => (bool) $row->encoded,
                    'gateDueAt' => $row->gate_due_at === null ? null : (int) $row->gate_due_at,
                    'gatePassed' => (bool) $row->gate_passed,
                    'gateFails' => (int) $row->gate_fails,
                ];
                $versions[$key] = (string) $row->engine_version;
            }

            // A learner with neither events nor cached atoms contributes
            // nothing to compare — including them would inflate
            // `usersChecked` while comparing zero atoms.
            if ($events === [] && $liveCache === []) {
                continue;
            }

            $samples[] = [
                'userId' => $userId,
                'events' => $events,
                'liveCache' => (object) $liveCache,
                'cachedEngineVersion' => (object) $versions,
            ];
        }

        return [
            'engineVersion' => (string) config('nightly.engine_version', 'v3-engine-0.1.0'),
            'samples' => $samples,
        ];
    }

    /**
     * Storage columns → the frozen DrillEvent wire shape (v3-D10). A pure
     * rename: nothing here computes, reinterprets, or defaults an engine
     * value — Laravel stores the wire and hands it back (v3-D08).
     *
     * @return array<string,mixed>
     */
    private function toWireEvent(Event $e): array
    {
        $wire = [
            'type' => $e->type,
            'ts' => (int) $e->ts,
            'surah' => (int) $e->surah,
            'ayah' => (int) $e->ayah,
            'rung' => $e->rung,
        ];
        $optional = [
            'id' => $e->uuid, 'position' => $e->position, 'correct' => $e->correct,
            'pretest' => $e->pretest, 'to' => $e->to_ayah, 'stepKind' => $e->step_kind,
            'structured' => $e->structured, 'latency' => $e->latency, 'resume' => $e->resume,
            'testKind' => $e->test_kind, 'score' => $e->score, 'total' => $e->total,
            'sentToReviews' => $e->sent_to_reviews, 'siteKey' => $e->site_key,
            'visitOrdinal' => $e->visit_ordinal, 'deviceId' => $e->device_id,
            'deviceSeq' => $e->device_seq, 'tz' => $e->tz, 'corpusHash' => $e->corpus_hash,
            'locale' => $e->locale, 'gradeClass' => $e->grade_class,
        ];
        foreach ($optional as $k => $v) {
            if ($v !== null) {
                $wire[$k] = $v;
            }
        }

        // `choice` is deliberately NOT forwarded. It holds tapped answer
        // text — Arabic for S2/S3 — and the fold never reads it
        // (rebuild.ts/applyEvent depend only on structural coordinates).
        // Sending it would push sacred text through a subprocess pipe and
        // into a stored JSON report for no benefit whatsoever.
        return $wire;
    }

    // ══════════════════════════════════════════════════════════════════════
    // selection_determinism_check
    // ══════════════════════════════════════════════════════════════════════

    private function runSelection(): string
    {
        // Always fixture-driven for now, and this is a real limitation
        // rather than a shortcut: replaying selection against a REAL server
        // log needs the pinned corpus for every surah that log names,
        // resolved through each event's `corpusHash`, and no corpus store
        // exists server-side yet (selection.ts's own replaySelection header
        // says so: "a real fold would resolve this via the event's own
        // corpusHash, once a corpus store exists — out of scope here").
        // So the nightly proves the DEPLOYED code is shuffle-invariant
        // against the committed selection log. It does not yet prove it
        // against production's own logs. Stated here, and in the report.
        [$exit, $report] = $this->invokeRunner(['bin/selection-determinism-check.ts'], null);
        $report['scope'] = 'committed selection-log fixture — not production logs (no server-side corpus store yet)';

        return $this->record('selection_determinism_check', $exit, $report);
    }

    // ══════════════════════════════════════════════════════════════════════
    // Runner invocation + ledger
    // ══════════════════════════════════════════════════════════════════════

    /**
     * @param  list<string>  $args
     * @return array{0:int,1:array<string,mixed>}
     */
    private function invokeRunner(array $args, ?string $stdin): array
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
            // The runner is contracted to print JSON on EVERY path. If it
            // did not, we do not guess — the night is an error night with
            // the raw output preserved as evidence.
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

    /**
     * Decode the exit code into the taxonomy, append the immutable ledger
     * row, and publish the health cache key.
     *
     * THE DECODE IS FROM THE EXIT CODE, NOT FROM `report.severity`. Both are
     * stored, and if the runner's JSON ever disagreed with its own exit code
     * the row would show it — but the ledger counts the exit code, because
     * that is the channel a broken JSON serializer cannot quietly corrupt
     * into a green.
     *
     * @param  array<string,mixed>  $report
     */
    private function record(string $check, int $exit, array $report): string
    {
        $severity = self::SEVERITY_BY_EXIT[$exit] ?? 'error';
        $night = (string) ($this->option('night') ?: gmdate('Y-m-d'));

        $line = sprintf(
            '%s: %s (exit %d)%s',
            $check,
            strtoupper($severity),
            $exit,
            isset($report['error']) ? ' — '.$report['error'] : '',
        );
        match ($severity) {
            'green' => $this->info($line),
            'warn' => $this->warn($line),
            default => $this->error($line),
        };

        if ($severity === 'p1') {
            $this->error('  ↳ P1: this resets the 7-night window. Paging v3-D18\'s configured recipients by email.');
        }

        if ($this->option('no-record')) {
            // A dry run (manual/test invocation, `--no-record`) never counts
            // toward the streak, so it must never page either — paging on a
            // run nobody recorded would train the on-call to distrust pages.
            return $severity;
        }

        $run = NightlyCheckRun::create([
            'check' => $check,
            'night' => $night,
            'severity' => $severity,
            'exit_code' => $exit,
            'report' => $report,
            'trigger' => (string) $this->option('trigger'),
            'ran_at' => (int) round(microtime(true) * 1000),
        ]);

        if ($severity === 'p1') {
            $this->pageOnCall($run);
        }

        // The key SystemHealthController has always read and nothing ever
        // wrote. Its contract is a COUNT of divergences (0 = ok), so an
        // error night must not write 0 — it writes nothing, leaving the
        // dashboard at `unknown`, which is edge case #167's whole point.
        if ($severity !== 'error') {
            $divergences = (int) ($report['divergentCount'] ?? count($report['divergences'] ?? []));
            Cache::put("health:{$check}", $divergences, now()->addHours(36));
        }

        return $severity;
    }

    /**
     * v3-D18: "A `fold_determinism` P1 pages by email, not phone." Only
     * reached for a RECORDED p1 (a real, ledgered night) — never for
     * `--no-record`.
     *
     * A send failure (unconfigured SMTP, network error) is logged and
     * swallowed, never rethrown: the P1's own record in the ledger is the
     * durable fact, and it must survive regardless of whether any one
     * delivery attempt succeeds — the same "the write itself is never
     * blocked" discipline v3-D81's synchronous hash recompute already
     * established for this codebase.
     */
    private function pageOnCall(NightlyCheckRun $run): void
    {
        $recipients = config('nightly.pager_emails', []);
        if ($recipients === []) {
            Log::warning('determinism P1: no pager recipients configured (NIGHTLY_PAGER_EMAILS/ADMIN_EMAILS both empty) — nobody paged', [
                'check' => $run->check,
                'night' => $run->night,
            ]);

            return;
        }

        try {
            Mail::to($recipients)->send(new DeterminismP1Alert($run));
        } catch (Throwable $e) {
            Log::error('determinism P1: paging failed — '.$e->getMessage(), [
                'check' => $run->check,
                'night' => $run->night,
            ]);
        }
    }
}
