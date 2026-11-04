<?php

namespace Tests\Feature\Events;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Build-plan step 14: ingestion. v2-D18's idempotent-by-uuid contract
 * carried forward, PLUS every v3-D10 wire field (build-plan step 10) gets
 * a real column. `user_id` NEVER comes from the request body — only from
 * the Sanctum-authenticated caller (same rule v2's EventsController used).
 */
class EventsIngestionTest extends TestCase
{
    use RefreshDatabase;

    private function actingUser(): User
    {
        $user = User::factory()->create();
        $token = $user->createToken('device')->plainTextToken;
        $this->withHeaders(['Authorization' => 'Bearer '.$token]);

        return $user;
    }

    public function test_ingestion_requires_auth(): void
    {
        $this->postJson('/api/events', ['events' => []])->assertStatus(401);
    }

    public function test_accepts_a_batch_and_stores_every_wire_field(): void
    {
        $this->actingUser();

        $this->postJson('/api/events', [
            'events' => [[
                'id' => 'uuid-1',
                'type' => 'rung_complete',
                'ts' => 1000,
                'surah' => 12,
                'ayah' => 4,
                'rung' => 'S2',
                'position' => 3,
                'choice' => 'w3',
                'correct' => true,
                'siteKey' => '12:ayah:4',
                'visitOrdinal' => 1,
                'deviceId' => 'device-a',
                'deviceSeq' => 1,
                'tz' => 'Asia/Kuala_Lumpur',
                'corpusHash' => '875a4a0230b9c69d',
                'locale' => 'en',
                'specSnapshot' => ['lane' => 'cloze', 'variantId' => 'v1'],
                'gradeClass' => 's2_partial',
            ]],
        ])->assertOk()->assertJson(['accepted' => 1, 'ignored' => 0]);

        $this->assertDatabaseHas('events', [
            'uuid' => 'uuid-1',
            'surah' => 12,
            'ayah' => 4,
            'site_key' => '12:ayah:4',
            'visit_ordinal' => 1,
            'device_id' => 'device-a',
            'device_seq' => 1,
            'tz' => 'Asia/Kuala_Lumpur',
            'corpus_hash' => '875a4a0230b9c69d',
            'locale' => 'en',
            'grade_class' => 's2_partial',
        ]);
    }

    public function test_a_day_marked_away_event_stores_the_absolute_day_index_and_the_toggle(): void
    {
        // v3-D207: WIREFRAME §14 "Planned absences" — a genuinely new event
        // type, not a field on an existing one. `awayDayIndex`/`away` did
        // not exist in the original v3-D10 wire freeze at all.
        $this->actingUser();

        $this->postJson('/api/events', [
            'events' => [[
                'id' => 'away-1',
                'type' => 'day_marked_away',
                'ts' => 1000,
                'surah' => 12,
                'ayah' => 0,
                'rung' => 'S4',
                'awayDayIndex' => 20345,
                'away' => true,
            ]],
        ])->assertOk()->assertJson(['accepted' => 1, 'ignored' => 0]);

        $this->assertDatabaseHas('events', [
            'uuid' => 'away-1',
            'type' => 'day_marked_away',
            'away_day_index' => 20345,
            'away' => true,
        ]);
    }

    public function test_an_interruption_event_stores_the_resume_classification_and_its_massed_flag(): void
    {
        // v3-D218: `resumeMassed` (packages/engine/src/resume.ts) was fully
        // computed by `resumePolicy()` but discarded at the one real call
        // site (`acknowledgeReentry`) that builds the `interruption` event —
        // its sibling `resume` field already had a real column and reached
        // this far; `resumeMassed` never did.
        $this->actingUser();

        $this->postJson('/api/events', [
            'events' => [[
                'id' => 'interruption-1',
                'type' => 'interruption',
                'ts' => 1000,
                'surah' => 12,
                'ayah' => 4,
                'rung' => 'S4',
                'structured' => false,
                'resume' => 'restart',
                'resumeMassed' => true,
            ]],
        ])->assertOk()->assertJson(['accepted' => 1, 'ignored' => 0]);

        $this->assertDatabaseHas('events', [
            'uuid' => 'interruption-1',
            'type' => 'interruption',
            'resume' => 'restart',
            'resume_massed' => true,
        ]);
    }

    public function test_user_id_is_never_taken_from_the_request_body(): void
    {
        $me = $this->actingUser();
        $other = User::factory()->create();

        $this->postJson('/api/events', [
            'events' => [['id' => 'uuid-x', 'type' => 'session_start', 'ts' => 1, 'user_id' => $other->id]],
        ])->assertOk();

        $this->assertDatabaseHas('events', ['uuid' => 'uuid-x', 'user_id' => $me->id]);
        $this->assertDatabaseMissing('events', ['uuid' => 'uuid-x', 'user_id' => $other->id]);
    }

    public function test_reposting_the_same_uuid_is_idempotent(): void
    {
        $this->actingUser();
        $payload = ['events' => [['id' => 'uuid-dup', 'type' => 'session_start', 'ts' => 1]]];

        $this->postJson('/api/events', $payload)->assertOk()->assertJson(['accepted' => 1, 'ignored' => 0]);
        $this->postJson('/api/events', $payload)->assertOk()->assertJson(['accepted' => 0, 'ignored' => 1]);

        $this->assertDatabaseCount('events', 1);
    }

    public function test_two_different_users_may_independently_use_the_same_client_uuid(): void
    {
        // Sanctum::actingAs (not a manually-set Bearer header) is required
        // here: within ONE test method, the auth guard resolves and caches
        // its user on the FIRST authenticated request and does not
        // re-resolve from a changed Authorization header on later requests
        // in the same method — a test-harness quirk, not a production bug
        // (a real HTTP request is always freshly resolved). actingAs sets
        // the guard's resolved user directly, sidestepping it.
        $a = User::factory()->create();
        $b = User::factory()->create();
        $body = ['events' => [['id' => 'shared-uuid', 'type' => 'session_start', 'ts' => 1]]];

        Sanctum::actingAs($a);
        $this->postJson('/api/events', $body)->assertOk()->assertJson(['accepted' => 1, 'ignored' => 0]);

        Sanctum::actingAs($b);
        $this->postJson('/api/events', $body)->assertOk()->assertJson(['accepted' => 1, 'ignored' => 0]);

        $this->assertDatabaseCount('events', 2);
    }

    public function test_rejects_a_malformed_batch(): void
    {
        $this->actingUser();
        $this->postJson('/api/events', ['events' => [['type' => 'session_start', 'ts' => 1]]])->assertStatus(400);
        $this->postJson('/api/events', ['events' => 'not-an-array'])->assertStatus(400);
    }

    public function test_empty_batch_is_a_no_op(): void
    {
        $this->actingUser();
        $this->postJson('/api/events', ['events' => []])->assertOk()->assertJson(['accepted' => 0, 'ignored' => 0]);
    }

    public function test_cap_is_log_only_never_enforced(): void
    {
        Config::set('events.daily_cap', 2);
        $this->actingUser();
        Log::spy();

        $this->postJson('/api/events', ['events' => [
            ['id' => 'c1', 'type' => 'session_start', 'ts' => 1],
            ['id' => 'c2', 'type' => 'session_start', 'ts' => 2],
            ['id' => 'c3', 'type' => 'session_start', 'ts' => 3],
        ]])->assertOk()->assertJson(['accepted' => 3, 'ignored' => 0]);

        Log::shouldHaveReceived('warning')->once();
        $this->assertDatabaseCount('events', 3);
    }

    // ───────────── the append-only gap: no structural enforcement at all ──────────

    /**
     * `events` is append-only by this class's own header and invariant #2 —
     * "the event log is truth" only holds if a row, once ingested, can
     * never be rewritten. But unlike `AdminAudit`/`PurgeLedgerEntry`/
     * `AyahVerification`/`GlossDraftReview`/`Override`/`NightlyCheckRun`,
     * `Event` carried no ORM `booted()` guard: nothing stopped a future
     * developer (or a bug in a refactor — e.g. a late-arrival refold
     * "helper" that edits instead of appending) from calling
     * `->update()`/`->delete()` on a fetched row directly.
     *
     * This guard must coexist with `events.user_id`'s `cascadeOnDelete()`
     * — DECISIONS.md v3-D374 proves (and the second case below
     * re-confirms) that a PDPA purge's cascade never dispatches this
     * model's `deleting` event at all, so the guard cannot interfere with it.
     *
     * MUTATION: remove the `updating`/`deleting` guards from the model.
     */
    public function test_a_row_can_never_be_updated_or_deleted_directly_on_the_model(): void
    {
        $user = $this->actingUser();
        $row = Event::create([
            'user_id' => $user->id, 'uuid' => (string) Str::uuid(),
            'type' => 'tap', 'ts' => 1_700_000_000_000, 'received_at' => 1_700_000_000_100,
        ]);

        try {
            $row->update(['type' => 'tampered']);
            $this->fail('an event row must never be updatable directly — invariant #2 depends on it');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('APPEND-ONLY', $e->getMessage());
        }

        try {
            $row->delete();
            $this->fail('an event row must never be deletable directly');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('APPEND-ONLY', $e->getMessage());
        }

        $this->assertDatabaseHas('events', ['id' => $row->id, 'type' => 'tap']);
    }

    /**
     * The load-bearing counter-proof: the guard above must NOT break the
     * PDPA purge's `ON DELETE CASCADE` on `events.user_id`. If it did, this
     * would fail with the guard's own `RuntimeException` instead of
     * completing — it does not, because a database-level cascade is
     * executed by the database engine in response to the single
     * `DELETE FROM users ...` statement and never re-enters Eloquent, so
     * `Event`'s `deleting` event is never dispatched for the cascaded rows.
     */
    public function test_the_append_only_guard_does_not_block_a_pdpa_purge_cascade(): void
    {
        $doomed = User::factory()->create();
        Event::create([
            'user_id' => $doomed->id, 'uuid' => (string) Str::uuid(),
            'type' => 'tap', 'ts' => 1_700_000_000_000, 'received_at' => 1_700_000_000_100,
        ]);

        $doomed->delete();

        $this->assertNull(User::find($doomed->id));
        $this->assertSame(0, Event::where('user_id', $doomed->id)->count());
    }

    /**
     * Same reasoning as the other append-only tables' identical check — the
     * ORM guard above is layer 2 only. Layer 1 (`REVOKE UPDATE, DELETE` on
     * the app's Postgres role) cannot be asserted from inside the app that
     * lacks it, so the strongest available check is that the runnable
     * grant for `events` exists in the document the other append-only
     * tables' grants already live in.
     *
     * MUTATION: remove the `events` GRANT block from docs/ADMIN-CONSOLE.md. Red.
     */
    public function test_the_database_level_append_only_grant_is_documented(): void
    {
        $path = dirname(__DIR__, 3).'/docs/ADMIN-CONSOLE.md';
        $this->assertFileExists($path);

        $doc = file_get_contents($path);

        $this->assertMatchesRegularExpression(
            '/REVOKE\s+UPDATE,\s*DELETE.*ON\s+TABLE\s+events/is',
            $doc,
            'the document must carry the actual REVOKE for events, not just the other append-only tables',
        );
        $this->assertMatchesRegularExpression(
            '/GRANT\s+INSERT,\s*SELECT\s+ON\s+TABLE\s+events/is',
            $doc,
            'the app role still needs INSERT and SELECT, or an event could never be ingested',
        );
    }
}
