<?php

namespace Tests\Feature\Events;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Build-plan step 14: "pull protocol cursored on server ingest-sequence
 * (late-arrival safe)." The cursor is the server-assigned `id` (an
 * INGEST-order sequence, not the client's `ts`) — the whole point is that a
 * late-arriving offline event with an OLD `ts` still gets picked up on the
 * client's next pull, because it gets a fresh (larger) `id` the moment the
 * server actually receives it. A `ts`-ordered cursor could silently skip it.
 */
class EventsPullTest extends TestCase
{
    use RefreshDatabase;

    private function actingUser(): array
    {
        $user = User::factory()->create();
        $token = $user->createToken('device')->plainTextToken;

        return [$user, $token];
    }

    public function test_pull_requires_auth(): void
    {
        $this->getJson('/api/events')->assertStatus(401);
    }

    public function test_first_pull_with_no_cursor_returns_everything_in_ingest_order(): void
    {
        [, $token] = $this->actingUser();
        $headers = ['Authorization' => 'Bearer '.$token];
        $this->postJson('/api/events', ['events' => [
            ['id' => 'e1', 'type' => 'session_start', 'ts' => 300],
            ['id' => 'e2', 'type' => 'session_start', 'ts' => 100],
            ['id' => 'e3', 'type' => 'session_start', 'ts' => 200],
        ]], $headers)->assertOk();

        $response = $this->getJson('/api/events', $headers)->assertOk();
        $ids = array_column($response->json('events'), 'id');
        // Ingest order (e1, e2, e3), NOT ts order — the cursor is the
        // server's own sequence, ts is opaque payload here.
        $this->assertSame(['e1', 'e2', 'e3'], $ids);
        $this->assertNotNull($response->json('nextCursor'));
    }

    public function test_pull_with_since_returns_only_rows_ingested_after_the_cursor(): void
    {
        [, $token] = $this->actingUser();
        $headers = ['Authorization' => 'Bearer '.$token];
        $this->postJson('/api/events', ['events' => [['id' => 'e1', 'type' => 'session_start', 'ts' => 1]]], $headers)->assertOk();
        $first = $this->getJson('/api/events', $headers)->assertOk();
        $cursor = $first->json('nextCursor');

        $this->postJson('/api/events', ['events' => [['id' => 'e2', 'type' => 'session_start', 'ts' => 2]]], $headers)->assertOk();
        $second = $this->getJson("/api/events?since={$cursor}", $headers)->assertOk();

        $this->assertSame(['e2'], array_column($second->json('events'), 'id'));
    }

    public function test_late_arrival_safety_a_stale_ts_row_ingested_later_still_appears_on_the_next_pull(): void
    {
        [, $token] = $this->actingUser();
        $headers = ['Authorization' => 'Bearer '.$token];

        // Device A ingests first, ts=100.
        $this->postJson('/api/events', ['events' => [['id' => 'a-online', 'type' => 'session_start', 'ts' => 100]]], $headers)->assertOk();
        $first = $this->getJson('/api/events', $headers)->assertOk();
        $cursor = $first->json('nextCursor');

        // Device B was offline and only now syncs an OLDER event, ts=1 —
        // ingested SECOND (server clock), even though its ts is earlier.
        $this->postJson('/api/events', ['events' => [['id' => 'b-late-arrival', 'type' => 'session_start', 'ts' => 1]]], $headers)->assertOk();

        // A client that already pulled up to $cursor must still see the
        // late arrival on its next pull — this is the property under test.
        $second = $this->getJson("/api/events?since={$cursor}", $headers)->assertOk();
        $this->assertSame(['b-late-arrival'], array_column($second->json('events'), 'id'));
    }

    public function test_pull_is_scoped_to_the_authenticated_user_only(): void
    {
        [, $tokenA] = $this->actingUser();
        [, $tokenB] = $this->actingUser();
        $this->postJson('/api/events', ['events' => [['id' => 'mine', 'type' => 'session_start', 'ts' => 1]]], ['Authorization' => 'Bearer '.$tokenA])->assertOk();
        $this->postJson('/api/events', ['events' => [['id' => 'theirs', 'type' => 'session_start', 'ts' => 1]]], ['Authorization' => 'Bearer '.$tokenB])->assertOk();

        $response = $this->getJson('/api/events', ['Authorization' => 'Bearer '.$tokenA])->assertOk();
        $this->assertSame(['mine'], array_column($response->json('events'), 'id'));
    }

    public function test_nextCursor_does_not_advance_when_nothing_new_is_pulled(): void
    {
        [, $token] = $this->actingUser();
        $headers = ['Authorization' => 'Bearer '.$token];
        $this->postJson('/api/events', ['events' => [['id' => 'e1', 'type' => 'session_start', 'ts' => 1]]], $headers)->assertOk();
        $first = $this->getJson('/api/events', $headers)->assertOk();
        $cursor = $first->json('nextCursor');

        $second = $this->getJson("/api/events?since={$cursor}", $headers)->assertOk();
        $this->assertSame([], $second->json('events'));
        $this->assertSame($cursor, $second->json('nextCursor'));
    }

    public function test_limit_caps_the_page_and_reports_hasMore(): void
    {
        [, $token] = $this->actingUser();
        $headers = ['Authorization' => 'Bearer '.$token];
        $events = [];
        for ($i = 1; $i <= 5; $i++) {
            $events[] = ['id' => "e{$i}", 'type' => 'session_start', 'ts' => $i];
        }
        $this->postJson('/api/events', ['events' => $events], $headers)->assertOk();

        $page = $this->getJson('/api/events?limit=2', $headers)->assertOk();
        $this->assertCount(2, $page->json('events'));
        $this->assertTrue($page->json('hasMore'));

        $rest = $this->getJson('/api/events', $headers)->assertOk();
        $this->assertCount(5, $rest->json('events'));
        $this->assertFalse($rest->json('hasMore'));
    }
}
