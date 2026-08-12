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
}
