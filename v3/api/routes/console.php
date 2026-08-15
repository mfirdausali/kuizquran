<?php

use App\Console\Commands\AutoWaiveKillsCommand;
use App\Console\Commands\DeterminismCheckCommand;
use App\Console\Commands\PurgeDueAccountsCommand;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| THE NIGHTLY SCHEDULE
|--------------------------------------------------------------------------
|
| BUILD-PLAN.md's gates section: fold_determinism_check "runs nightly + in CI
| against the shuffled golden log"; selection_determinism_check is the
| nightly harness gate 4 names. Both feed the 7-consecutive-green-nights
| window (M10), which cannot START until something actually runs the checks
| it counts. This block is that something.
|
| ── WHY BOTH CHECKS IN ONE INVOCATION ──
| The ledger requires BOTH checks to have run on a night for that night to
| count green (a night with only one is a night with a missing check, not a
| green one). Scheduling them as two independent entries would let one
| succeed and the other never fire — silently producing nights that can
| never count, discovered seven days later. One invocation, both checks, one
| lock.
|
| ── UTC, DELIBERATELY ──
| `->timezone('UTC')` matches the ledger's own UTC calendar-night grouping
| (config/nightly.php explains the coupling). Without it, a host in a DST
| zone runs twice in one UTC night each spring and skips one each autumn —
| the ledger would correctly report the skipped night as a GAP that breaks
| the streak, and the cause would be nearly impossible to find.
|
| ── withoutOverlapping ──
| Belt to DeterminismCheckCommand's own Cache::lock braces. The command's
| lock is the real guard (it protects manual runs too); this stops the
| scheduler from even queueing a second one while a long run is in flight.
|
| ── onFailure ──
| v3-D18: "A fold_determinism P1 pages by email, not phone." The MAIL side of
| that is M3 infra and is not wired — there is no mailer configured for
| operational alerts in this repo, and inventing one here would produce a
| pager nobody receives. What IS wired: a non-zero exit is logged at error
| level, and the ledger row records the P1 permanently. The gap is named in
| LAUNCH-CHECKLIST rather than hidden behind a green schedule entry.
*/
Schedule::command(DeterminismCheckCommand::class, ['both', '--trigger=schedule'])
    ->dailyAt((string) config('nightly.run_at_utc', '03:00'))
    ->timezone('UTC')
    ->withoutOverlapping()
    ->onFailure(function () {
        \Illuminate\Support\Facades\Log::error(
            'nightly determinism check exited non-zero — see nightly_check_runs for the verdict and evidence. '
            .'A confirmed P1 RESETS the 7-consecutive-green-nights window (BUILD-PLAN M10).'
        );
    });

/*
|--------------------------------------------------------------------------
| PDPA PURGE
|--------------------------------------------------------------------------
|
| Build-plan step 23 (M7) / LAUNCH-CHECKLIST.md gate 19. Runs daily, well
| clear of the determinism nightly above — a purge deletes `events` rows,
| and running it concurrently with a fold sampling those same rows is
| exactly the kind of interleaving that page a false P1 (the same reasoning
| DeterminismCheckCommand's own header gives for its single-flight lock).
| `withoutOverlapping` guards a slow run against the next day's tick, same
| belt-and-braces as the determinism schedule entry.
*/
Schedule::command(PurgeDueAccountsCommand::class)
    ->dailyAt('02:00')
    ->timezone('UTC')
    ->withoutOverlapping();

/*
|--------------------------------------------------------------------------
| FLAG KILL AUTO-WAIVE
|--------------------------------------------------------------------------
|
| v3-D17 / LAUNCH-CHECKLIST.md gate 9: "72h auto-waive, audited." Until this
| entry, `FlagService::autoWaiveDueKills()` was built and unit-tested but had
| ZERO production callers — a killed flag's admin banner never actually
| cleared after 72 hours in a running app. Scheduled well clear of the other
| two nightly jobs above (02:00/03:00 UTC) for the same "don't interleave
| unrelated writers over the same tables" reasoning the PDPA entry already
| gives, though this job touches only `flags`/`flag_ramp_audit`, never
| `events` or `users`. Never re-enables a flag (#159) — see
| AutoWaiveKillsCommand's own docblock.
*/
Schedule::command(AutoWaiveKillsCommand::class)
    ->dailyAt('04:00')
    ->timezone('UTC')
    ->withoutOverlapping();
