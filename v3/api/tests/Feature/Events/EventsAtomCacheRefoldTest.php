<?php

namespace Tests\Feature\Events;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * DEFECTS.md/DECISIONS.md v3-D32's other deferred half: until now this build
 * had NO automatic refold-on-ingest pipeline. `atom_cache` was populated only
 * by the admin's manual "rebuild atom cache" action, so a real learner's
 * cache went stale the moment they synced a new event and stayed stale until
 * a human clicked rebuild — defeating `DeterminismCheckCommand`'s DB-sampling
 * path (it compares a fresh fold against `atom_cache`) for every active
 * learner, and leaving `/progress`/`/home` due-counts one admin click behind
 * reality. `EventsController::store()` now refolds the ingesting learner via
 * `AtomCacheRebuilder::rebuildOne()` after any batch that writes new rows —
 * scoped to exactly that one learner, via the real Node fold-runner (v3-D08:
 * PHP never folds), never a PHP re-implementation of engine logic.
 */
class EventsAtomCacheRefoldTest extends TestCase
{
    use RefreshDatabase;

    private function actingUser(): User
    {
        $user = User::factory()->create();
        $token = $user->createToken('device')->plainTextToken;
        $this->withHeaders(['Authorization' => 'Bearer '.$token]);

        return $user;
    }

    /**
     * Drives a real graded event through the REAL engine (via the fold-runner
     * subprocess, v3-D08) and asserts the atom_cache row it produces matches
     * what the pure engine itself would compute — not merely that some row
     * exists. Mirrors SystemHealthTest's own "actually rebuilds" proof, here
     * fired by an ordinary sync POST rather than an admin click.
     */
    public function test_ingesting_a_graded_event_refreshes_atom_cache_without_an_admin_rebuild(): void
    {
        $user = $this->actingUser();

        $this->postJson('/api/events', ['events' => [[
            'id' => 'ev-refold-1',
            'type' => 'rung_complete',
            'ts' => 1000,
            'surah' => 112,
            'ayah' => 1,
            'rung' => 'S2',
            'position' => 0,
            'choice' => 'w0',
            'correct' => true,
        ]]])->assertOk()->assertJson(['accepted' => 1, 'ignored' => 0]);

        $row = DB::table('atom_cache')->where('user_id', $user->id)->where('surah', 112)->where('ref', 1)->first();
        $this->assertNotNull($row, 'the real ayah 112:1 atom must be written from the just-synced event — no admin rebuild ran');
        $this->assertSame(1, (int) $row->reps, 'one graded S2 retrieval → reps=1, from the ENGINE, not a stub');
        $this->assertGreaterThan(0.0, (float) $row->strength);
    }

    /**
     * A later batch re-derives the WHOLE cache from the whole log — never
     * merges — so a second sync with a second graded event must move
     * `reps` from 1 to 2, proving each ingest genuinely re-runs the fold
     * rather than caching the first request's own result forever.
     */
    public function test_a_second_batch_advances_the_cache_again(): void
    {
        $user = $this->actingUser();

        $this->postJson('/api/events', ['events' => [[
            'id' => 'ev-refold-a', 'type' => 'rung_complete', 'ts' => 1000,
            'surah' => 112, 'ayah' => 1, 'rung' => 'S2', 'correct' => true,
        ]]])->assertOk();

        $afterFirst = DB::table('atom_cache')->where('user_id', $user->id)->where('surah', 112)->first();
        $this->assertSame(1, (int) $afterFirst->reps);

        $this->postJson('/api/events', ['events' => [[
            'id' => 'ev-refold-b', 'type' => 'rung_complete', 'ts' => 2000,
            'surah' => 112, 'ayah' => 1, 'rung' => 'S3', 'correct' => true,
        ]]])->assertOk();

        $afterSecond = DB::table('atom_cache')->where('user_id', $user->id)->where('surah', 112)->first();
        $this->assertSame(2, (int) $afterSecond->reps, 'the second sync must re-fold the WHOLE log, not just cache the first result');
    }

    /**
     * The append-only event log is truth (invariant #2); `atom_cache` is a
     * derived cache. A refold failure (a crashed/unreachable fold-runner)
     * must never reject or roll back an already-accepted event.
     *
     * MUTATION CHECK (documented, not asserted mechanically): removing the
     * try/catch around `rebuildOne()` in EventsController would turn this
     * test RED — the response would 500 instead of accepting the event.
     */
    public function test_a_refold_failure_does_not_reject_the_event(): void
    {
        Config::set('nightly.fold_runner_path', '/nonexistent-fold-runner-path');
        Log::spy();
        $user = $this->actingUser();

        $this->postJson('/api/events', ['events' => [[
            'id' => 'ev-refold-fail', 'type' => 'rung_complete', 'ts' => 1000,
            'surah' => 112, 'ayah' => 1, 'rung' => 'S2', 'correct' => true,
        ]]])->assertOk()->assertJson(['accepted' => 1, 'ignored' => 0]);

        $this->assertDatabaseHas('events', ['uuid' => 'ev-refold-fail', 'user_id' => $user->id]);
        $this->assertNull(
            DB::table('atom_cache')->where('user_id', $user->id)->first(),
            'no row is fabricated when the runner cannot run',
        );
        Log::shouldHaveReceived('error')->once();
    }

    /** An idempotent replay (nothing new accepted) is still a plain success. */
    public function test_an_idempotent_replay_never_needs_a_working_fold_runner(): void
    {
        $this->actingUser();
        $payload = ['events' => [[
            'id' => 'ev-refold-dup', 'type' => 'rung_complete', 'ts' => 1000,
            'surah' => 112, 'ayah' => 1, 'rung' => 'S2', 'correct' => true,
        ]]];

        $this->postJson('/api/events', $payload)->assertOk()->assertJson(['accepted' => 1, 'ignored' => 0]);

        Config::set('nightly.fold_runner_path', '/nonexistent-fold-runner-path');
        $this->postJson('/api/events', $payload)->assertOk()->assertJson(['accepted' => 0, 'ignored' => 1]);
    }
}
