<?php

namespace Tests\Feature\Admin;

use App\Http\Controllers\Admin\SystemHealthController;
use App\Models\AdminAudit;
use App\Models\Event;
use App\Models\User;
use App\Support\AtomCacheRebuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
            $this->assertSame('unknown', $check['status'], '#167: an unreported check is UNKNOWN, not ok');
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
     * The rebuild runs SYNCHRONOUSLY inside the request (AtomCacheRebuilder's
     * own header explains why — matching v3-D81's CorpusHashRecomputer
     * precedent rather than dispatching to a queue worker that does not
     * exist on this deployment). That means two SEQUENTIAL requests cannot
     * exercise the mutex at all: by the time the second one fires, the first
     * has already finished and released the lock, so it legitimately runs
     * again — which is correct for two requests that never actually
     * overlapped, and is not what #168 is about.
     *
     * So concurrency is simulated directly: hold the lock ourselves first,
     * exactly as another in-flight request would, then assert a request
     * arriving while it is held queues rather than running.
     *
     * (This replaces an earlier version of this test that called the
     * endpoint twice in a row and happened to pass — but only because the
     * endpoint at the time never actually did any work and never released
     * the lock it acquired, so the SECOND call queuing was a symptom of
     * that bug, not proof the mutex worked. See DECISIONS.md.)
     *
     * MUTATION: remove the `Cache::lock` from `rebuildAtomCache`. A request
     * arriving while another genuinely holds the lock would then run
     * anyway, and interleaved folds could produce a state neither run would
     * — surfacing later as a P1 that never happened.
     */
    public function test_a_second_rebuild_queues_and_never_runs_concurrently(): void
    {
        $held = Cache::lock(SystemHealthController::REBUILD_LOCK, 600);
        $this->assertTrue($held->get(), 'test setup: must be able to acquire the lock to simulate a concurrent holder');

        $response = $this->postJson('/api/admin/health/rebuild-atom-cache');

        $response->assertStatus(202);
        $this->assertFalse($response->json('started'), '#168: a request arriving while the lock is held must NOT run');
        $this->assertTrue($response->json('queued'));

        // No rebuild ran at all — no audit row.
        $this->assertSame(0, AdminAudit::where('action', 'rebuild_atom_cache')->count());

        $held->release();
    }

    /**
     * The rebuild actually rebuilds. Before AtomCacheRebuilder existed, the
     * endpoint returned `started: true` without invoking the fold-runner or
     * writing a single `atom_cache` row — DECISIONS.md's finding. This drives
     * a REAL event through the REAL engine (via the fold-runner subprocess,
     * never a PHP re-implementation — v3-D08) and asserts the row that comes
     * back is the one the pure engine itself would produce, not merely that
     * SOME row exists.
     */
    public function test_the_rebuild_actually_writes_atom_cache_rows_from_the_real_engine(): void
    {
        Cache::lock(SystemHealthController::REBUILD_LOCK)->forceRelease();
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
        // A stale row this user's fresh fold will NOT reproduce — proves the
        // rebuild REPLACES rather than merges (WIREFRAME §16).
        DB::table('atom_cache')->insert([
            'user_id' => $user->id, 'surah' => 999, 'kind' => 'ayah', 'ref' => 1,
            'strength' => 1, 'stability' => 1, 'difficulty' => 1, 'last_retrieval' => null,
            'reps' => 1, 'lapses' => 0, 'encoded' => false, 'gate_due_at' => null,
            'gate_passed' => false, 'gate_fails' => 0, 'engine_version' => 'stale',
            'computed_at' => 0,
        ]);

        $response = $this->postJson('/api/admin/health/rebuild-atom-cache');

        $response->assertOk();
        $this->assertTrue($response->json('started'));
        $this->assertSame(1, $response->json('usersProcessed'));
        $this->assertGreaterThan(0, $response->json('atomsWritten'));

        $row = DB::table('atom_cache')->where('user_id', $user->id)->where('surah', 112)->where('ref', 1)->first();
        $this->assertNotNull($row, 'the real ayah 112:1 atom must be written from the seeded event');
        $this->assertSame(1, (int) $row->reps, 'one graded S2 retrieval → reps=1, from the ENGINE, not a stub');
        $this->assertGreaterThan(0.0, (float) $row->strength);

        $this->assertNull(
            DB::table('atom_cache')->where('user_id', $user->id)->where('surah', 999)->first(),
            'the stale row this fold does not reproduce must be gone — a rebuild replaces, never merges',
        );

        // Lock released — a rebuild that finished must not leave the mutex held.
        $this->assertTrue(Cache::lock(SystemHealthController::REBUILD_LOCK)->get(), 'lock must be released after a completed rebuild');
        Cache::lock(SystemHealthController::REBUILD_LOCK)->forceRelease();
    }

    /**
     * DEFECTS.md / edge case #130's OTHER half, deliberately left open by
     * v3-D114: `AtomCacheRebuilder` shares the nightly check's exact root
     * cause — it also batches every candidate user into ONE
     * `json_encode()`'d envelope before calling the fold-runner, so one
     * learner's unencodable event data (invalid-UTF8 `device_id`) previously
     * failed the WHOLE rebuild for every learner in the batch. Because this
     * rebuilder REPLACES (delete-then-reinsert, WIREFRAME §16), a naive fix
     * that dead-lettered the poisoned learner but still deleted their
     * EXISTING atom_cache rows before excluding them from re-insert would
     * silently WIPE their cache with nothing to replace it — strictly worse
     * than today's whole-rebuild failure. This proves both halves at once:
     * (1) the clean learner's rebuild is not wedged by the poisoned one, and
     * (2) the poisoned learner's pre-existing row is left byte-identical —
     * never deleted, never rewritten, only skipped.
     *
     * MUTATION: revert to encoding the whole `$users` batch in one
     * `json_encode()` call. This test goes back to `started: false` for the
     * WHOLE request (the clean learner's row is never written either).
     */
    public function test_a_poisoned_learner_is_dead_lettered_and_their_existing_cache_is_never_wiped(): void
    {
        Cache::lock(SystemHealthController::REBUILD_LOCK)->forceRelease();

        $clean = User::factory()->create();
        Event::create([
            'user_id' => $clean->id, 'uuid' => (string) Str::uuid(),
            'type' => 'rung_complete', 'ts' => 1_000, 'surah' => 112, 'ayah' => 1,
            'rung' => 'S2', 'correct' => true, 'received_at' => 1_000,
        ]);

        $poisoned = User::factory()->create();
        Event::create([
            'user_id' => $poisoned->id, 'uuid' => (string) Str::uuid(),
            'type' => 'rung_complete', 'ts' => 1_000, 'surah' => 112, 'ayah' => 1,
            'rung' => 'S2', 'correct' => true, 'received_at' => 1_000,
        ]);

        // A real, prior rebuild gives the poisoned learner a genuine cache
        // row FIRST — this is what proves "untouched" rather than merely
        // "present" below.
        app(AtomCacheRebuilder::class)->rebuild();
        $priorRow = DB::table('atom_cache')->where('user_id', $poisoned->id)->where('surah', 112)->first();
        $this->assertNotNull($priorRow, 'setup: the poisoned learner needs a real prior row to prove untouched');

        // NOW corrupt the poisoned learner's stored event — after their
        // cache was already correctly computed from the clean version.
        DB::table('events')->where('user_id', $poisoned->id)
            ->update(['device_id' => "\xB1\x31"]); // invalid UTF-8 — json_encode() fails on this byte alone

        $response = $this->postJson('/api/admin/health/rebuild-atom-cache');

        $response->assertOk();
        $this->assertTrue($response->json('started'));
        $this->assertSame(1, $response->json('usersProcessed'), 'only the clean learner is actually rebuilt');
        $this->assertCount(1, $response->json('deadLetters'), 'exactly the poisoned learner is quarantined');
        $this->assertSame($poisoned->id, $response->json('deadLetters.0.userId'));

        $cleanRow = DB::table('atom_cache')->where('user_id', $clean->id)->where('surah', 112)->first();
        $this->assertNotNull($cleanRow, 'the clean learner was rebuilt despite the poisoned learner sharing the batch');

        $afterRow = DB::table('atom_cache')->where('user_id', $poisoned->id)->where('surah', 112)->first();
        $this->assertNotNull($afterRow, 'the poisoned learner\'s existing row must survive — never deleted with nothing to replace it');
        $this->assertEquals(
            (array) $priorRow,
            (array) $afterRow,
            'byte-identical: the poisoned learner\'s cache is untouched, not merely non-empty',
        );

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
