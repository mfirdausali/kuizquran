<?php

namespace Tests\Feature\Nightly;

use App\Mail\DeterminismP1Alert;
use App\Models\Event;
use App\Models\NightlyCheckRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * LAUNCH-CHECKLIST gate 20's named sub-gap: "The pager is not wired. v3-D18
 * says a `fold_determinism` P1 'pages by email, not phone'... but no mail
 * dispatch exists — there is no operational mailer configured. A P1 at 3am
 * currently pages nobody." `DeterminismCheckCommand::record()` said the same
 * thing in its own docblock: "MAIL DISPATCH IS NOT WIRED".
 *
 * This does NOT close gate 20 — no live SMTP account exists in this sandbox,
 * that half stays BLOCKED-ON-INFRA. What it closes is the CODE gap: the
 * command must actually attempt to page its configured recipients on a
 * confirmed P1, using the mail infra step 13 already built (MAIL_MAILER
 * defaults to `log`, swappable to `smtp` by env — no code change needed to
 * go live).
 *
 * No corrupted fixture and no oracle regeneration is used to trigger the P1:
 * a P1 is any live-cache row the fresh fold does not reproduce
 * (`foldCheck.ts`'s own contract — "a key present in the fresh fold but
 * ABSENT from the cache... is a genuine divergence"). Seeding one atom_cache
 * row for a user with ZERO events is exactly that shape and needs no golden
 * log, no fixture, and no Arabic.
 */
class DeterminismP1PagerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $runner = config('nightly.vite_node');
        if (! is_string($runner) || ! is_file($runner)) {
            $this->markTestSkipped("fold-runner not installed at {$runner} — run npm install in worker/fold-runner");
        }
    }

    /**
     * A DB-fed run with one real event (so `sampleFromDatabase()`'s
     * Event-driven query even sees this learner) and one atom_cache row for
     * an ayah NO event ever touches, at the CURRENT engine version — exactly
     * `foldCheck.ts`'s own contract for "genuine divergence": "a key
     * present in the fresh fold but ABSENT from the cache... [or vice
     * versa]... is a genuine divergence". No fixture, no oracle, no
     * corrupted golden log — just a stray cache row, the shape a live
     * corruption actually takes.
     */
    private function seedAP1Row(): User
    {
        $user = User::factory()->create();

        Event::create([
            'user_id' => $user->id,
            'uuid' => (string) Str::uuid(),
            'type' => 'rung_complete',
            'ts' => 1000,
            'surah' => 112,
            'ayah' => 1,
            'rung' => 'S2',
            'position' => 0,
            'choice' => 'w0',
            'correct' => true,
            'received_at' => 1000,
        ]);

        \DB::table('atom_cache')->insert([
            'user_id' => $user->id,
            'surah' => 112,
            'kind' => 'ayah',
            'ref' => 999, // no event ever names this ayah
            'strength' => 0.5,
            'stability' => 1.0,
            'difficulty' => 0.3,
            'last_retrieval' => null,
            'reps' => 1,
            'lapses' => 0,
            'encoded' => true,
            'gate_due_at' => null,
            'gate_passed' => false,
            'gate_fails' => 0,
            'engine_version' => (string) config('nightly.engine_version'),
            'computed_at' => 0,
        ]);

        return $user;
    }

    public function test_a_confirmed_p1_pages_every_configured_recipient(): void
    {
        config(['nightly.pager_emails' => ['ops@iman.app', 'firdaus@iman.app']]);
        Mail::fake();
        $this->seedAP1Row();

        $this->artisan('determinism:check', ['check' => 'fold', '--night' => '2026-08-12'])
            ->assertExitCode(1);

        $run = NightlyCheckRun::query()->where('check', 'fold_determinism_check')->firstOrFail();
        $this->assertSame('p1', $run->severity);

        Mail::assertSent(DeterminismP1Alert::class, function (DeterminismP1Alert $mail) use ($run) {
            return $mail->hasTo('ops@iman.app')
                && $mail->hasTo('firdaus@iman.app')
                && $mail->night === '2026-08-12'
                && $mail->check === 'fold_determinism_check'
                && $mail->run->is($run);
        });
        Mail::assertSentCount(1);
    }

    public function test_a_green_or_warn_night_never_pages_anyone(): void
    {
        config(['nightly.pager_emails' => ['ops@iman.app']]);
        Mail::fake();

        $this->artisan('determinism:check', ['check' => 'fold', '--fixture' => true])
            ->assertExitCode(0);

        Mail::assertNothingSent();
    }

    public function test_a_dry_run_p1_is_not_paged_only_a_recorded_one(): void
    {
        // --no-record exists for manual/test invocations that must not count
        // toward the 7-night streak. A p1 nobody recorded is not a night
        // that "just reset the window", so it must not page either — paging
        // on an unrecorded run would train the on-call to distrust pages.
        config(['nightly.pager_emails' => ['ops@iman.app']]);
        Mail::fake();
        $this->seedAP1Row();

        $this->artisan('determinism:check', ['check' => 'fold', '--no-record' => true])
            ->assertExitCode(1);

        $this->assertSame(0, NightlyCheckRun::query()->count());
        Mail::assertNothingSent();
    }

    public function test_no_recipients_configured_logs_a_warning_instead_of_paging_silently(): void
    {
        config(['nightly.pager_emails' => []]);
        Mail::fake();
        $this->seedAP1Row();
        Log::spy();

        $this->artisan('determinism:check', ['check' => 'fold'])
            ->assertExitCode(1);

        Mail::assertNothingSent();
        // The ledger row must still exist — an unconfigured pager must never
        // block the check itself from recording a real night.
        $this->assertSame('p1', NightlyCheckRun::query()->firstOrFail()->severity);
        Log::shouldHaveReceived('warning')
            ->withArgs(fn (string $message) => str_contains($message, 'no pager recipients configured'))
            ->once();
    }

    public function test_a_failed_send_is_logged_and_never_crashes_the_command_or_loses_the_ledger_row(): void
    {
        // A misconfigured SMTP host (or any transport failure) must not turn
        // a real P1 into an uncaught exception that hides the ledger row —
        // the whole point of this feature is that the check's own record of
        // the night is more durable than any one delivery attempt.
        config(['nightly.pager_emails' => ['ops@iman.app']]);
        $this->seedAP1Row();

        Mail::shouldReceive('to')->andThrow(new \RuntimeException('smtp connection refused'));
        Log::spy();

        $this->artisan('determinism:check', ['check' => 'fold'])
            ->assertExitCode(1);

        $this->assertSame('p1', NightlyCheckRun::query()->firstOrFail()->severity);
        Log::shouldHaveReceived('error')
            ->withArgs(fn (string $message) => str_contains($message, 'smtp connection refused'))
            ->once();
    }

    /**
     * `DeterminismP1Alert::content()` reads `report['divergentCount']` /
     * `['skewCount']` / `['atomsCompared']` / `['usersChecked']` —
     * `fold_determinism_check`'s own `FoldCheckReport` shape
     * (worker/fold-runner/src/foldCheck.ts). `runSelection()`'s own
     * `SelectionCheckReport` (worker/fold-runner/src/selectionCheck.ts) has
     * none of those keys — it has `seeds`, `eventsReplayed`,
     * `tracesCompared`, `divergences` instead — so every one of those four
     * `??` fallbacks silently reads 0 for a selection P1, and the fixed body
     * prose ("a live atom_cache row that disagrees with a fresh fold...
     * Invariant #2 is broken") is flatly wrong for a shuffle-order
     * divergence. This is the page a 3am on-call engineer reads to decide
     * whether to act, for the highest-severity signal in this codebase.
     *
     * Mirrors `NightlyWindowTest::test_a_selection_confirmed_p1_carries_its_
     * divergence_findings()`'s own precedent for constructing a
     * selection-shaped `NightlyCheckRun.report` directly — the runner's own
     * committed fixture is never touched, so this triggers a genuine test
     * scenario without regenerating any oracle.
     */
    public function test_a_selection_p1_email_renders_selection_shaped_content_not_fold_zeros(): void
    {
        $run = NightlyCheckRun::create([
            'check' => 'selection_determinism_check',
            'night' => '2026-09-14',
            'severity' => 'p1',
            'exit_code' => 4,
            'report' => [
                'check' => 'selection_determinism_check',
                'seeds' => [7, 42, 99],
                'eventsReplayed' => 36,
                'tracesCompared' => 108,
                'divergences' => [
                    [
                        'seed' => 7,
                        'traceKey' => 'site-a:device-1:3',
                        'baseline' => ['lane' => 's1', 'variantIndex' => 0],
                        'replayed' => ['lane' => 'cloze', 'variantIndex' => 1],
                    ],
                    [
                        'seed' => 42,
                        'traceKey' => 'site-b:device-2:1',
                        'baseline' => null,
                        'replayed' => ['lane' => 'junction', 'variantIndex' => 0],
                    ],
                ],
            ],
            'trigger' => 'test',
            'ran_at' => 0,
        ]);

        $html = (new DeterminismP1Alert($run))->render();

        // The real, computed selection evidence must reach the email.
        $this->assertStringContainsString('Seeds compared', $html);
        $this->assertStringContainsString('3', $html); // 3 seeds
        $this->assertStringContainsString('Traces compared', $html);
        $this->assertStringContainsString('108', $html);
        $this->assertStringContainsString('Divergent traces', $html);
        $this->assertStringContainsString('2', $html); // 2 divergences

        // Never the fold check's own wrong-for-this-check body prose.
        $this->assertStringNotContainsString('atom_cache', $html);
        $this->assertStringNotContainsString('a fresh fold', $html);

        // Never a fabricated fold-shaped zero standing in for a real count
        // this check never produces — a bare "0" would silently read as
        // "checked, nothing found" rather than "wrong template".
        $this->assertStringNotContainsString('Divergent atoms', $html);
        $this->assertStringNotContainsString('Skewed atoms', $html);
        $this->assertStringNotContainsString('Atoms compared', $html);
        $this->assertStringNotContainsString('Learners sampled', $html);
    }

    /**
     * `NightlyCheckRun.trigger` (schedule|manual|ci) reaches the admin
     * console's `NightlyWindowPanel` (v3-D225 — "fold_determinism_check=
     * green (schedule)" vs "(manual)", built precisely so a human watching
     * that screen can tell real unattended automation from a manual re-run)
     * but `DeterminismP1Alert::content()` never read `$this->run->trigger`
     * at all, on EITHER report shape — the constructor takes the whole
     * model but only extracted `check`/`night`. The pager email is the
     * highest-severity, most time-critical artifact in this codebase (a
     * confirmed P1 resets the 7-night launch window), and it could not
     * answer, from the page itself, whether tonight's P1 is happening to
     * production right now via the real cron or is a manual/CI run the
     * on-call may already know about — exactly the fact v3-D225 built for
     * a DIFFERENT reader (the admin panel) the night before this one.
     *
     * Two different triggers on the two report shapes, so neither assertion
     * can pass on a hardcoded string.
     */
    public function test_a_fold_p1_email_renders_its_own_trigger(): void
    {
        $run = NightlyCheckRun::create([
            'check' => 'fold_determinism_check',
            'night' => '2026-09-18',
            'severity' => 'p1',
            'exit_code' => 4,
            'report' => [
                'check' => 'fold_determinism_check',
                'divergentCount' => 1,
                'skewCount' => 0,
                'atomsCompared' => 10,
                'usersChecked' => 1,
            ],
            'trigger' => 'schedule',
            'ran_at' => 0,
        ]);

        $html = (new DeterminismP1Alert($run))->render();

        $this->assertStringContainsString('<strong>Triggered by:</strong> schedule.', $html);
    }

    public function test_a_selection_p1_email_renders_its_own_trigger_not_a_fold_one(): void
    {
        $run = NightlyCheckRun::create([
            'check' => 'selection_determinism_check',
            'night' => '2026-09-18',
            'severity' => 'p1',
            'exit_code' => 4,
            'report' => [
                'check' => 'selection_determinism_check',
                'seeds' => [1],
                'eventsReplayed' => 1,
                'tracesCompared' => 1,
                'divergences' => [],
            ],
            'trigger' => 'ci',
            'ran_at' => 0,
        ]);

        $html = (new DeterminismP1Alert($run))->render();

        $this->assertStringContainsString('<strong>Triggered by:</strong> ci.', $html);
        $this->assertStringNotContainsString('<strong>Triggered by:</strong> schedule.', $html);
        $this->assertStringNotContainsString('<strong>Triggered by:</strong> manual.', $html);
    }

    /** The fold branch's own rendered content is unchanged by the fix — a
     *  regression guard alongside the pre-existing `Mail::assertSent` props
     *  check above, which never inspected rendered HTML at all. */
    public function test_a_fold_p1_email_still_renders_fold_shaped_content(): void
    {
        $run = NightlyCheckRun::create([
            'check' => 'fold_determinism_check',
            'night' => '2026-09-14',
            'severity' => 'p1',
            'exit_code' => 4,
            'report' => [
                'check' => 'fold_determinism_check',
                'divergentCount' => 2,
                'skewCount' => 1,
                'atomsCompared' => 40,
                'usersChecked' => 5,
            ],
            'trigger' => 'test',
            'ran_at' => 0,
        ]);

        $html = (new DeterminismP1Alert($run))->render();

        $this->assertStringContainsString('atom_cache', $html);
        $this->assertStringContainsString('Divergent atoms', $html);
        $this->assertStringContainsString('2', $html);
        $this->assertStringContainsString('Atoms compared', $html);
        $this->assertStringContainsString('40', $html);
        $this->assertStringContainsString('Learners sampled', $html);
        $this->assertStringContainsString('5', $html);
        $this->assertStringNotContainsString('Seeds compared', $html);
        $this->assertStringNotContainsString('Traces compared', $html);
    }
}
