<?php

namespace Tests\Feature\Events;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
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
}
