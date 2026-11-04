<?php

namespace Tests\Feature\Admin;

use App\Http\Controllers\Admin\Pseudonymizer;
use App\Models\NightlyCheckRun;
use App\Models\NightlyWindow;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * THE 7-CONSECUTIVE-GREEN-NIGHTS WINDOW VIEWER — the read half of
 * `NightlyWindowLedger::status()`, which has been computable since the
 * ledger shipped but reachable only via `php artisan nightly:window` on a
 * machine with SSH access. `NightlyCheckRun`/`NightlyWindow` had a nightly
 * writer and zero admin-facing readers — the same "built + populated + zero
 * read surface" shape v3-D129/D130/D141/D142 each closed for
 * `admin_audit`/`flag_ramp_audit`/`entitlement_transitions`/`purge_ledger`.
 *
 * These tests assert the HTTP CONTRACT (auth, shape, method) — the streak
 * ARITHMETIC itself is already exhaustively covered by
 * `tests/Feature/Nightly/WindowLedgerTest.php` and is not re-proven here;
 * this controller is a thin, untransformed pass-through to
 * `NightlyWindowLedger::status()`.
 */
class NightlyWindowTest extends TestCase
{
    use RefreshDatabase;

    private function admin(string $email = 'ops@example.com'): User
    {
        config(['admin.emails' => [$email]]);
        $admin = User::factory()->create(['email' => $email, 'email_verified_at' => now()]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function window(string $start = '2026-09-01'): void
    {
        NightlyWindow::current()->fill([
            'window_started_at' => $start,
            'reason' => 'test',
            'updated_at_ms' => 0,
        ])->save();
    }

    private function appendRun(
        string $night,
        string $check,
        string $severity,
        ?array $report = null,
        string $trigger = 'test',
    ): void {
        $exit = ['green' => 0, 'warn' => 3, 'p1' => 4, 'error' => 5][$severity];
        NightlyCheckRun::create([
            'check' => $check,
            'night' => $night,
            'severity' => $severity,
            'exit_code' => $exit,
            'report' => $report ?? ['atomsCompared' => 8],
            'trigger' => $trigger,
            'ran_at' => 0,
        ]);
    }

    private function night(string $night, string $severity): void
    {
        foreach (NightlyCheckRun::CHECKS as $check) {
            $this->appendRun($night, $check, $severity);
        }
    }

    /** @return list<string> seven consecutive dates ENDING TODAY (UTC) — for
     *  any test hitting this controller, since v3-D360 made it pass today's
     *  date into `NightlyWindowLedger::status()`'s own `$today`. A fixed past
     *  week reads as a scheduler dead since the day after its last recorded
     *  night, regardless of how green that week actually was. */
    private function recentWeek(): array
    {
        return array_map(fn (int $i) => gmdate('Y-m-d', strtotime("-{$i} day")), range(6, 0, -1));
    }

    public function test_the_route_requires_admin(): void
    {
        $this->getJson('/api/admin/nightly-window')->assertStatus(401);

        $learner = User::factory()->create();
        Sanctum::actingAs($learner);
        $this->getJson('/api/admin/nightly-window')->assertStatus(403);
    }

    public function test_no_window_declared_reports_streak_zero_with_a_reason(): void
    {
        $this->admin();

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        $this->assertSame(0, $response->json('streak'));
        $this->assertSame(7, $response->json('required'));
        $this->assertFalse($response->json('satisfied'));
        $this->assertNull($response->json('windowStartedAt'));
        $this->assertStringContainsString('nightly:window --start', $response->json('blockedBy'));
    }

    public function test_it_reports_a_real_seven_night_streak_with_evidence(): void
    {
        $this->admin();
        $days = $this->recentWeek();
        $this->window($days[0]);
        foreach ($days as $d) {
            $this->night($d, 'green');
        }

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        $this->assertSame(7, $response->json('streak'));
        $this->assertTrue($response->json('satisfied'));
        $this->assertSame($days[0], $response->json('windowStartedAt'));
        $this->assertCount(7, $response->json('nights'));
        $this->assertSame($days[6], $response->json('nights.6.night'));
        $this->assertTrue($response->json('nights.6.green'));
    }

    /**
     * The load-bearing case for this screen's whole reason to exist: a
     * confirmed P1 must be VISIBLE on the admin surface, not just resettable
     * from a terminal — an operator reading this screen has to be able to
     * see WHY the streak is zero, not just that it is.
     */
    public function test_a_confirmed_p1_is_visible_and_resets_the_streak(): void
    {
        $this->admin();
        [$d1, $d2, $d3, $d4] = [
            gmdate('Y-m-d', strtotime('-3 day')),
            gmdate('Y-m-d', strtotime('-2 day')),
            gmdate('Y-m-d', strtotime('-1 day')),
            gmdate('Y-m-d'),
        ];
        $this->window($d1);
        $this->night($d1, 'green');
        $this->night($d2, 'green');
        $this->appendRun($d3, 'fold_determinism_check', 'p1');
        $this->appendRun($d3, 'selection_determinism_check', 'green');
        $this->night($d4, 'green');

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        $this->assertSame(1, $response->json('streak'));
        $this->assertFalse($response->json('satisfied'));
        $this->assertSame($d3, $response->json('lastP1.night'));
        $this->assertSame('fold_determinism_check', $response->json('lastP1.check'));
    }

    /**
     * v3-D178: `NightlyCheckRun.report` — the runner's "full JSON verdict...
     * the evidence" (this migration's own docblock) — is written every
     * night and was never read by this controller: an operator paged on a
     * confirmed P1 could see THAT it happened but not which learner or atom
     * key diverged. This is the load-bearing case: findings for the P1's
     * OWN run reach the wire, keyed to the correct (night, check) pair, and
     * the learner id is pseudonymized exactly like every other admin
     * surface (`AdminBillingController::toWire()`'s `subjectPseudonym`) —
     * never the raw integer.
     */
    public function test_a_confirmed_p1_carries_its_pseudonymized_findings(): void
    {
        config(['admin.pseudonym_pepper' => 'test-pepper']);
        $this->admin();
        [$d1, $d2, $d3, $d4] = [
            gmdate('Y-m-d', strtotime('-3 day')),
            gmdate('Y-m-d', strtotime('-2 day')),
            gmdate('Y-m-d', strtotime('-1 day')),
            gmdate('Y-m-d'),
        ];
        $this->window($d1);
        $this->night($d1, 'green');
        $this->night($d2, 'green');
        $this->appendRun($d3, 'fold_determinism_check', 'p1', [
            'atomsCompared' => 4,
            'findings' => [
                ['userId' => 42, 'key' => '12:ayah:5', 'kind' => 'divergence', 'cachedVersion' => null],
                ['userId' => 43, 'key' => '12:ayah:9', 'kind' => 'skew', 'cachedVersion' => '2026.08.01'],
            ],
        ]);
        $this->appendRun($d3, 'selection_determinism_check', 'green');
        $this->night($d4, 'green');

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        $this->assertCount(2, $response->json('lastP1Findings'));
        $this->assertSame('fold', $response->json('lastP1Findings.0.type'));
        $this->assertSame('12:ayah:5', $response->json('lastP1Findings.0.key'));
        $this->assertSame('divergence', $response->json('lastP1Findings.0.kind'));
        $this->assertNull($response->json('lastP1Findings.0.cachedVersion'));
        $this->assertSame('skew', $response->json('lastP1Findings.1.kind'));
        $this->assertSame('2026.08.01', $response->json('lastP1Findings.1.cachedVersion'));

        // Pseudonymized — the raw integer id must never appear on the wire.
        $this->assertStringNotContainsString('"userId"', $response->getContent());
        $pseudonymizer = app(Pseudonymizer::class);
        $this->assertSame($pseudonymizer->for(42), $response->json('lastP1Findings.0.subjectPseudonym'));
        $this->assertSame($pseudonymizer->for(43), $response->json('lastP1Findings.1.subjectPseudonym'));
        $this->assertNotSame(
            $response->json('lastP1Findings.0.subjectPseudonym'),
            $response->json('lastP1Findings.1.subjectPseudonym'),
        );
    }

    /**
     * v3-D179: `selection_determinism_check`'s own per-seed evidence
     * (`SelectionCheckReport.divergences`, worker/fold-runner/src/
     * selectionCheck.ts) is a DIFFERENT shape than the fold check's
     * `findings` — `findingsFor()` read `report['findings']` unconditionally,
     * so a selection-check P1 silently discarded its own evidence and
     * reported an empty list, indistinguishable from "nothing found". This
     * is the load-bearing case: a selection P1's divergences reach the wire
     * under their own `type`, keyed to the correct (night, check) pair.
     * `divergences` carries no learner id at all (the check replays a
     * committed fixture log, never production data — `runSelection()`'s own
     * `report['scope']`), so unlike a fold finding there is nothing to
     * pseudonymize here.
     */
    public function test_a_selection_confirmed_p1_carries_its_divergence_findings(): void
    {
        $this->admin();
        [$d1, $d2, $d3, $d4] = [
            gmdate('Y-m-d', strtotime('-3 day')),
            gmdate('Y-m-d', strtotime('-2 day')),
            gmdate('Y-m-d', strtotime('-1 day')),
            gmdate('Y-m-d'),
        ];
        $this->window($d1);
        $this->night($d1, 'green');
        $this->night($d2, 'green');
        $this->appendRun($d3, 'fold_determinism_check', 'green');
        $this->appendRun($d3, 'selection_determinism_check', 'p1', [
            'seeds' => [7, 42],
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
        ]);
        $this->night($d4, 'green');

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        $this->assertSame('selection_determinism_check', $response->json('lastP1.check'));
        $this->assertCount(2, $response->json('lastP1Findings'));
        $this->assertSame('selection', $response->json('lastP1Findings.0.type'));
        $this->assertSame(7, $response->json('lastP1Findings.0.seed'));
        $this->assertSame('site-a:device-1:3', $response->json('lastP1Findings.0.traceKey'));
        $this->assertSame(['lane' => 's1', 'variantIndex' => 0], $response->json('lastP1Findings.0.baseline'));
        $this->assertSame(['lane' => 'cloze', 'variantIndex' => 1], $response->json('lastP1Findings.0.replayed'));
        $this->assertSame(42, $response->json('lastP1Findings.1.seed'));
        $this->assertNull($response->json('lastP1Findings.1.baseline'));

        // No learner id exists on this check's evidence at all.
        $this->assertStringNotContainsString('"userId"', $response->getContent());
    }

    /** A window with no confirmed P1 must report `null` findings, never an
     *  empty array masquerading as "checked, nothing found". */
    public function test_no_confirmed_p1_reports_null_findings(): void
    {
        $this->admin();
        $this->window();
        foreach (range(0, 6) as $i) {
            $this->night(date('Y-m-d', strtotime("2026-09-01 +{$i} day")), 'green');
        }

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        $this->assertNull($response->json('lastP1'));
        $this->assertNull($response->json('lastP1Findings'));
    }

    /**
     * v3-D225: `NightlyCheckRun.trigger` (`schedule|manual|ci`,
     * `DeterminismCheckCommand`'s own `--trigger` option) is written on
     * every run and was never read by `NightlyWindowLedger::nights()` — an
     * operator relying on this exact screen ("a human watching this number
     * by hand is the ENTIRE safety net for the gate that blocks public
     * launch", this controller's own docblock) had no way to tell a real
     * unattended `schedule` run apart from a human's `manual` re-run
     * quietly keeping the streak alive after the real cron died. This is
     * the load-bearing case: each check's own winning-run trigger reaches
     * the wire, per night, per check — not a single flattened value.
     */
    public function test_each_nights_own_trigger_reaches_the_wire_per_check(): void
    {
        $this->admin();
        $this->window();
        $this->appendRun('2026-09-01', 'fold_determinism_check', 'green', trigger: 'schedule');
        $this->appendRun('2026-09-01', 'selection_determinism_check', 'green', trigger: 'manual');

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        $this->assertSame('schedule', $response->json('nights.0.triggers.fold_determinism_check'));
        $this->assertSame('manual', $response->json('nights.0.triggers.selection_determinism_check'));
    }

    /** A missing night — the scheduler silently stopped running — must show
     *  up as an explicit gap, never be skipped over as if it never existed. */
    public function test_a_missing_night_reports_which_check_never_ran(): void
    {
        $this->admin();
        $this->window();
        $this->night('2026-09-01', 'green');
        // 2026-09-02: only ONE of the two checks ran.
        $this->appendRun('2026-09-02', 'fold_determinism_check', 'green');

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        $this->assertFalse($response->json('nights.1.green'));
        $this->assertSame(['selection_determinism_check'], $response->json('nights.1.missing'));
    }

    /**
     * v3-D230 — THE LOAD-BEARING CASE. `report['deadLetters']` (edge case
     * #130's quarantine) is written whenever a sampled learner's own
     * event/atom rows cannot be encoded, and it had NO admin-facing reader:
     * `findingsFor()` only ever loads the run that produced `lastP1`, and a
     * dead letter never produces a P1 — `DeterminismCheckCommand` upgrades
     * an otherwise-green run to exit 3 / `severity: warn` and says in its
     * own comment that it "never pages a P1 on its own".
     *
     * That matters on THIS screen because `NightlyWindowLedger` counts a
     * WARN night as GREEN. This test proves both halves at once: the
     * quarantined night still advances the streak (so nothing on the old
     * screen said anything was wrong at all) AND the quarantine is now
     * named, per learner, pseudonymized.
     */
    public function test_a_quarantined_learner_is_named_on_a_warn_night_that_still_counts_green(): void
    {
        config(['admin.pseudonym_pepper' => 'test-pepper']);
        $this->admin();
        $d1 = gmdate('Y-m-d', strtotime('-1 day'));
        $d2 = gmdate('Y-m-d');
        $this->window($d1);
        $this->night($d1, 'green');
        $this->appendRun($d2, 'fold_determinism_check', 'warn', [
            'atomsCompared' => 6,
            'deadLetters' => [
                ['userId' => 42, 'error' => 'Malformed UTF-8 characters in device_id'],
                ['userId' => 43, 'error' => 'Inf and NaN cannot be JSON encoded'],
            ],
        ], trigger: 'schedule');
        $this->appendRun($d2, 'selection_determinism_check', 'green');

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        // The night the quarantine happened on still reads green and still
        // extends the launch-gate streak — the exact reason the quarantine
        // has to be visible somewhere else on this screen.
        $this->assertTrue($response->json('nights.1.green'));
        $this->assertSame(2, $response->json('streak'));

        $this->assertSame($d2, $response->json('lastQuarantine.night'));
        $this->assertSame('fold_determinism_check', $response->json('lastQuarantine.check'));
        $this->assertCount(2, $response->json('lastQuarantine.entries'));
        $this->assertSame(
            'Malformed UTF-8 characters in device_id',
            $response->json('lastQuarantine.entries.0.error'),
        );
        $this->assertSame(
            'Inf and NaN cannot be JSON encoded',
            $response->json('lastQuarantine.entries.1.error'),
        );

        // Pseudonymized — the raw integer id must never reach the wire, the
        // same rule every other admin finding list on this console follows.
        $this->assertStringNotContainsString('"userId"', $response->getContent());
        $pseudonymizer = app(Pseudonymizer::class);
        $this->assertSame($pseudonymizer->for(42), $response->json('lastQuarantine.entries.0.subjectPseudonym'));
        $this->assertSame($pseudonymizer->for(43), $response->json('lastQuarantine.entries.1.subjectPseudonym'));
        $this->assertNotSame(
            $response->json('lastQuarantine.entries.0.subjectPseudonym'),
            $response->json('lastQuarantine.entries.1.subjectPseudonym'),
        );
    }

    /** v3-D230: a window where nobody was ever quarantined reports `null`,
     *  never an empty list masquerading as "checked, nothing skipped" — the
     *  same discipline `lastP1Findings` already follows. */
    public function test_no_quarantine_reports_null(): void
    {
        $this->admin();
        $this->window();
        $this->night('2026-09-01', 'green');
        $this->night('2026-09-02', 'green');

        $this->getJson('/api/admin/nightly-window')
            ->assertOk()
            ->assertJsonPath('lastQuarantine', null);
    }

    /** v3-D230: window-scoped exactly as `NightlyWindowLedger::nights()` is.
     *  A quarantine from before the declared window start belongs to a
     *  window this screen is not counting, and reporting it here would point
     *  an operator at evidence that has nothing to do with the streak on
     *  screen. */
    public function test_a_quarantine_from_before_the_window_start_is_not_reported(): void
    {
        $this->admin();
        $this->window('2026-09-05');
        $this->appendRun('2026-09-01', 'fold_determinism_check', 'warn', [
            'deadLetters' => [['userId' => 42, 'error' => 'before the window']],
        ]);
        $this->night('2026-09-05', 'green');

        $this->getJson('/api/admin/nightly-window')
            ->assertOk()
            ->assertJsonPath('lastQuarantine', null);
    }

    /**
     * v3-D360: this controller used to call `NightlyWindowLedger::status()`
     * with no `$today`, so a gap AFTER the last recorded run never
     * materialized — the streak was only ever checked against the last row
     * in the table, never against the clock. A scheduler that produced 7
     * green nights and then died outright (host decommissioned, cron
     * disabled) left this endpoint reporting `satisfied: true` forever
     * after. This is the load-bearing case: 7 consecutive green nights, the
     * most recent one 10 days ago, nothing since.
     */
    public function test_a_dead_scheduler_after_seven_green_nights_does_not_stay_satisfied(): void
    {
        $this->admin();
        $this->window(gmdate('Y-m-d', strtotime('-30 day')));
        foreach (range(0, 6) as $i) {
            $this->night(gmdate('Y-m-d', strtotime(sprintf('-%d day', 10 + $i))), 'green');
        }

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        $this->assertSame(0, $response->json('streak'));
        $this->assertFalse($response->json('satisfied'));
    }

    /** READ-ONLY BY CONSTRUCTION — this screen may never declare or reset
     *  the window; that stays a deliberate human CLI action. */
    public function test_the_route_accepts_no_writes(): void
    {
        $this->admin();
        $this->postJson('/api/admin/nightly-window', ['start' => '2026-09-01'])->assertStatus(405);
    }

    // ───────────── the append-only gap: no structural enforcement at all ──────────

    /**
     * `NightlyCheckRun`'s own docblock calls this table append-only "for the
     * same reason the event log is append-only — a streak whose evidence can
     * be edited afterwards is not evidence" (edge case #169). But unlike
     * `AdminAudit`/`PurgeLedgerEntry`/`AyahVerification`/`GlossDraftReview`/
     * `Override`, it carried no ORM `booted()` guard: nothing stopped a
     * future developer (or a bug in a refactor) from fetching a P1 row and
     * calling `->update()` to silently launder it into a `green` one, or
     * `->delete()`-ing it outright — exactly the "contested gate" scenario
     * edge case #169 exists to rule out, reachable by code, not just by a
     * rogue DBA. This table carries no FK to `users`, so there is no
     * PDPA-purge cascade to reconcile the guard against.
     *
     * MUTATION: remove the `updating`/`deleting` guards from the model.
     */
    public function test_a_check_run_can_never_be_updated_or_deleted(): void
    {
        $this->appendRun('2026-09-01', 'fold_determinism_check', 'p1', ['atomsCompared' => 8]);
        $row = NightlyCheckRun::where('night', '2026-09-01')->first();

        try {
            $row->update(['severity' => 'green', 'exit_code' => 0]);
            $this->fail('a check run must never be updatable — a launderable P1 defeats the gate');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('APPEND-ONLY', $e->getMessage());
        }

        try {
            $row->delete();
            $this->fail('a check run must never be deletable');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('APPEND-ONLY', $e->getMessage());
        }

        $this->assertDatabaseHas('nightly_check_runs', ['id' => $row->id, 'severity' => 'p1']);
    }

    /**
     * Same reasoning as `VerificationsTest`'s/`GlossDraftsTest`'s identical
     * check — the ORM guard above is layer 2 only. Layer 1 (`REVOKE UPDATE,
     * DELETE` on the app's Postgres role) cannot be asserted from inside the
     * app that lacks it, so the strongest available check is that the
     * runnable grant for `nightly_check_runs` exists in the document the
     * other append-only tables' grants already live in.
     *
     * MUTATION: remove the `nightly_check_runs` GRANT block from
     * docs/ADMIN-CONSOLE.md. Red.
     */
    public function test_the_database_level_append_only_grant_is_documented(): void
    {
        $path = dirname(__DIR__, 3).'/docs/ADMIN-CONSOLE.md';
        $this->assertFileExists($path);

        $doc = file_get_contents($path);

        $this->assertMatchesRegularExpression(
            '/REVOKE\s+UPDATE,\s*DELETE.*ON\s+TABLE\s+nightly_check_runs/is',
            $doc,
            'the document must carry the actual REVOKE for nightly_check_runs, not just the other append-only tables',
        );
        $this->assertMatchesRegularExpression(
            '/GRANT\s+INSERT,\s*SELECT\s+ON\s+TABLE\s+nightly_check_runs/is',
            $doc,
            'the app role still needs INSERT and SELECT, or a nightly run could never be recorded',
        );
    }
}
