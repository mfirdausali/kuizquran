<?php

namespace Tests\Feature\Admin;

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

    private function night(string $night, string $severity): void
    {
        foreach (NightlyCheckRun::CHECKS as $check) {
            $this->appendRun($night, $check, $severity);
        }
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
        $this->window();
        foreach (range(0, 6) as $i) {
            $this->night(date('Y-m-d', strtotime("2026-09-01 +{$i} day")), 'green');
        }

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        $this->assertSame(7, $response->json('streak'));
        $this->assertTrue($response->json('satisfied'));
        $this->assertSame('2026-09-01', $response->json('windowStartedAt'));
        $this->assertCount(7, $response->json('nights'));
        $this->assertSame('2026-09-07', $response->json('nights.6.night'));
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
        $this->window();
        $this->night('2026-09-01', 'green');
        $this->night('2026-09-02', 'green');
        $this->appendRun('2026-09-03', 'fold_determinism_check', 'p1');
        $this->appendRun('2026-09-03', 'selection_determinism_check', 'green');
        $this->night('2026-09-04', 'green');

        $response = $this->getJson('/api/admin/nightly-window')->assertOk();

        $this->assertSame(1, $response->json('streak'));
        $this->assertFalse($response->json('satisfied'));
        $this->assertSame('2026-09-03', $response->json('lastP1.night'));
        $this->assertSame('fold_determinism_check', $response->json('lastP1.check'));
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

    /** READ-ONLY BY CONSTRUCTION — this screen may never declare or reset
     *  the window; that stays a deliberate human CLI action. */
    public function test_the_route_accepts_no_writes(): void
    {
        $this->admin();
        $this->postJson('/api/admin/nightly-window', ['start' => '2026-09-01'])->assertStatus(405);
    }
}
