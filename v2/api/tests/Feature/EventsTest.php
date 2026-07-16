<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * v2-D18/ROADMAP Phase 5 exit criterion: events created offline sync
 * idempotently on reconnect; a second device hydrates the same history.
 */
class EventsTest extends TestCase
{
    use RefreshDatabase;

    private function authHeader(): array
    {
        $user = User::factory()->create();
        $token = $user->createToken('device')->plainTextToken;

        return ['headers' => ['Authorization' => "Bearer $token"], 'user' => $user];
    }

    private function sampleEvent(string $id, int $ts = 1000): array
    {
        return [
            'id' => $id,
            'type' => 'reconstruct_tap',
            'ts' => $ts,
            'surah' => 12,
            'ayah' => 4,
            'rung' => 'RC',
            'position' => 3,
            'choice' => 'قَالَ',
            'correct' => true,
            'structured' => true,
        ];
    }

    public function test_post_events_requires_auth(): void
    {
        $this->postJson('/api/events', ['events' => [$this->sampleEvent('e1')]])
            ->assertStatus(401);
    }

    public function test_post_events_rejects_a_batch_missing_an_id(): void
    {
        ['headers' => $headers] = $this->authHeader();
        $bad = $this->sampleEvent('e1');
        unset($bad['id']);

        $this->withHeaders($headers)
            ->postJson('/api/events', ['events' => [$bad]])
            ->assertStatus(400);
    }

    public function test_post_events_inserts_and_reports_accepted(): void
    {
        ['headers' => $headers] = $this->authHeader();

        $res = $this->withHeaders($headers)->postJson('/api/events', [
            'events' => [$this->sampleEvent('e1'), $this->sampleEvent('e2', 1001)],
        ]);

        $res->assertOk()->assertJson(['accepted' => 2, 'ignored' => 0]);
        $this->assertDatabaseCount('events', 2);
    }

    public function test_post_events_is_idempotent_by_client_id_a_resend_is_a_noop(): void
    {
        ['headers' => $headers] = $this->authHeader();
        $events = ['events' => [$this->sampleEvent('e1'), $this->sampleEvent('e2', 1001)]];

        $this->withHeaders($headers)->postJson('/api/events', $events)->assertOk();
        $this->assertDatabaseCount('events', 2);

        // Simulates the outbox retrying an already-synced batch after a dropped
        // connection (the offline -> reconnect exit criterion): re-sending the
        // exact same ids must not duplicate rows.
        $retry = $this->withHeaders($headers)->postJson('/api/events', $events);
        $retry->assertOk()->assertJson(['accepted' => 0, 'ignored' => 2]);
        $this->assertDatabaseCount('events', 2);
    }

    public function test_post_events_mixed_batch_accepts_only_new_ids(): void
    {
        ['headers' => $headers] = $this->authHeader();
        $this->withHeaders($headers)->postJson('/api/events', ['events' => [$this->sampleEvent('e1')]])->assertOk();

        $res = $this->withHeaders($headers)->postJson('/api/events', [
            'events' => [$this->sampleEvent('e1'), $this->sampleEvent('e3', 1002)],
        ]);
        $res->assertOk()->assertJson(['accepted' => 1, 'ignored' => 1]);
        $this->assertDatabaseCount('events', 2);
    }

    public function test_get_events_hydrates_a_second_device_with_the_same_history(): void
    {
        ['headers' => $headers, 'user' => $user] = $this->authHeader();
        $this->withHeaders($headers)->postJson('/api/events', [
            'events' => [$this->sampleEvent('e1'), $this->sampleEvent('e2', 1001)],
        ])->assertOk();

        // A second device signs into the SAME account (fresh token) and pulls history.
        $secondDeviceToken = $user->createToken('device-2')->plainTextToken;
        $res = $this->withHeader('Authorization', "Bearer $secondDeviceToken")->getJson('/api/events');

        $res->assertOk();
        $events = $res->json('events');
        $this->assertCount(2, $events);
        $this->assertEquals(['e1', 'e2'], array_column($events, 'id'));
        $this->assertEquals(12, $events[0]['surah']);
        $this->assertTrue($events[0]['correct']);
        $this->assertArrayNotHasKey('to', $events[0]); // absent optional fields stay absent, not null
    }

    public function test_get_events_never_leaks_another_users_events(): void
    {
        ['headers' => $headersA] = $this->authHeader();
        ['headers' => $headersB] = $this->authHeader();

        $this->withHeaders($headersA)->postJson('/api/events', ['events' => [$this->sampleEvent('a1')]])->assertOk();
        $this->withHeaders($headersB)->postJson('/api/events', ['events' => [$this->sampleEvent('b1')]])->assertOk();

        $res = $this->withHeaders($headersA)->getJson('/api/events');
        $res->assertOk();
        $this->assertEquals(['a1'], array_column($res->json('events'), 'id'));
    }

    public function test_events_count(): void
    {
        ['headers' => $headers] = $this->authHeader();
        $this->withHeaders($headers)->postJson('/api/events', [
            'events' => [$this->sampleEvent('e1'), $this->sampleEvent('e2', 1001)],
        ])->assertOk();

        $this->withHeaders($headers)->getJson('/api/events/count')->assertOk()->assertJson(['count' => 2]);
    }
}
