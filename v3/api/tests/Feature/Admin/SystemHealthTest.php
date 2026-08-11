<?php

namespace Tests\Feature\Admin;

use App\Http\Controllers\Admin\SystemHealthController;
use App\Models\AdminAudit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Build-plan step 24 (M8). SYSTEM HEALTH — edge cases #167, #168, and §16's
 * prohibition on engagement-bait metrics.
 */
class SystemHealthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.emails' => ['ops@example.com'], 'admin.pseudonym_pepper' => 'test-pepper']);
        Sanctum::actingAs(User::factory()->create(['email' => 'ops@example.com', 'email_verified_at' => now()]));
    }

    /**
     * EDGE CASE #167 — "Laravel down, console up → zeros look healthy."
     *
     * With NO recorded check result, the probe must render `unknown` with a NULL
     * value, never `0` with status `ok`.
     *
     * MUTATION: change the catch branch to `return ['value' => 0, 'status' =>
     * 'ok']`. A dashboard then paints green over a blind system.
     */
    public function test_a_failed_probe_renders_unknown_never_zero(): void
    {
        Cache::forget('health:fold_determinism_check');
        Cache::forget('health:selection_determinism_check');

        $response = $this->getJson('/api/admin/health');
        $response->assertOk();

        foreach ($response->json('checks') as $check) {
            $this->assertSame('unknown', $check['status'], "#167: an unreported check is UNKNOWN, not ok");
            $this->assertNull($check['value'], '#167: an unreported check has NO value — never 0');
            $this->assertNotNull($check['detail'], 'the reason must be shown, not swallowed');
        }
    }

    /**
     * The other side: a genuine ZERO is `ok`, and is DISTINGUISHABLE from unknown.
     * Without this, the test above could pass on a console that always says
     * "unknown" and never actually reports health.
     */
    public function test_a_genuine_zero_is_ok_and_distinguishable_from_unknown(): void
    {
        Cache::put('health:fold_determinism_check', 0);
        Cache::put('health:selection_determinism_check', 0);

        $checks = collect($this->getJson('/api/admin/health')->json('checks'))->keyBy('metric');

        $this->assertSame('ok', $checks['fold_determinism_check']['status']);
        $this->assertSame(0, $checks['fold_determinism_check']['value']);
        $this->assertNotSame(
            $checks['fold_determinism_check']['status'],
            'unknown',
            'a real 0 and an unknown must never render the same',
        );
    }

    /** A divergence is reported as divergent, never silently rounded to ok. */
    public function test_a_divergence_is_reported(): void
    {
        Cache::put('health:fold_determinism_check', 3);
        Cache::put('health:selection_determinism_check', 0);

        $checks = collect($this->getJson('/api/admin/health')->json('checks'))->keyBy('metric');

        $this->assertSame('divergent', $checks['fold_determinism_check']['status']);
        $this->assertSame(3, $checks['fold_determinism_check']['value']);
    }

    /**
     * EDGE CASE #168 — the rebuild mutex.
     *
     * "second click queues, never runs concurrently."
     *
     * MUTATION: remove the `Cache::lock` from `rebuildAtomCache`. Two concurrent
     * rebuilds then both start, and interleaved folds produce a state neither
     * would — surfacing later as a P1 that never happened.
     */
    public function test_a_second_rebuild_queues_and_never_runs_concurrently(): void
    {
        Cache::lock(SystemHealthController::REBUILD_LOCK)->forceRelease();

        $first = $this->postJson('/api/admin/health/rebuild-atom-cache');
        $first->assertOk();
        $this->assertTrue($first->json('started'));

        $second = $this->postJson('/api/admin/health/rebuild-atom-cache');
        $second->assertStatus(202);
        $this->assertFalse($second->json('started'), '#168: the second click must NOT run');
        $this->assertTrue($second->json('queued'));

        // Exactly ONE run happened, not two.
        $this->assertSame(1, AdminAudit::where('action', 'rebuild_atom_cache')->count());

        Cache::lock(SystemHealthController::REBUILD_LOCK)->forceRelease();
    }

    /** The rebuild is audited — it is the only mutating action on this surface. */
    public function test_the_rebuild_is_audited(): void
    {
        Cache::lock(SystemHealthController::REBUILD_LOCK)->forceRelease();

        $this->postJson('/api/admin/health/rebuild-atom-cache')->assertOk();

        $audit = AdminAudit::where('action', 'rebuild_atom_cache')->first();
        $this->assertNotNull($audit);

        Cache::lock(SystemHealthController::REBUILD_LOCK)->forceRelease();
    }

    /**
     * WIREFRAME §16: "Deliberately no DAU tile, no streak leaderboard, no
     * session-count hero."
     *
     * The metric registry is a CLOSED union, so this is mechanical rather than a
     * convention someone remembers. MUTATION: add `dau` to METRICS.
     */
    public function test_no_engagement_bait_metrics_exist(): void
    {
        foreach (SystemHealthController::FORBIDDEN_METRICS as $banned) {
            $this->assertNotContains(
                $banned,
                SystemHealthController::METRICS,
                "WIREFRAME §16 forbids `{$banned}` — the north star is P(recall @ 10y), not engagement",
            );
        }

        // And the rendered response carries none of them either.
        Cache::put('health:fold_determinism_check', 0);
        Cache::put('health:selection_determinism_check', 0);
        $body = strtolower($this->getJson('/api/admin/health')->getContent());
        foreach (SystemHealthController::FORBIDDEN_METRICS as $banned) {
            $this->assertStringNotContainsString($banned, $body);
        }
    }

    /** The health surface is admin-gated like everything else. */
    public function test_health_requires_admin(): void
    {
        config(['admin.emails' => []]);
        $this->getJson('/api/admin/health')->assertStatus(403);
    }
}
