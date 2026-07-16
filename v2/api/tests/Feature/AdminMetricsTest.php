<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/** ROADMAP Phase 6: §3 metrics ported from v1's metrics.ts, over the v2 events table. */
class AdminMetricsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('admin.emails', ['qari@example.com']);
    }

    private function adminHeaders(): array
    {
        $user = User::factory()->create(['email' => 'qari@example.com', 'is_anonymous' => false]);

        return ['Authorization' => 'Bearer '.$user->createToken('device')->plainTextToken];
    }

    public function test_metrics_are_honest_placeholders_with_no_data(): void
    {
        $res = $this->getJson('/api/admin/metrics', $this->adminHeaders());
        $res->assertOk();
        $metrics = collect($res->json('metrics'))->keyBy('key');
        $this->assertNull($metrics['gate_pass']['value']);
        $this->assertEquals('no cold gates attempted yet', $metrics['gate_pass']['note']);
        $this->assertEquals(0, $metrics['gate_pass']['n']);
    }

    public function test_gate_pass_rate_computes_from_gate_result_events(): void
    {
        $user = User::factory()->create();
        Event::insert([
            ['id' => 'g1', 'user_id' => $user->id, 'type' => 'gate_result', 'ts' => 1000, 'surah' => 12, 'ayah' => 1, 'rung' => 'S3', 'correct' => true, 'received_at' => 1000],
            ['id' => 'g2', 'user_id' => $user->id, 'type' => 'gate_result', 'ts' => 1000, 'surah' => 12, 'ayah' => 2, 'rung' => 'S3', 'correct' => true, 'received_at' => 1000],
            ['id' => 'g3', 'user_id' => $user->id, 'type' => 'gate_result', 'ts' => 1000, 'surah' => 12, 'ayah' => 3, 'rung' => 'S3', 'correct' => false, 'received_at' => 1000],
        ]);

        $res = $this->getJson('/api/admin/metrics', $this->adminHeaders());
        $metrics = collect($res->json('metrics'))->keyBy('key');
        $this->assertEquals('67%', $metrics['gate_pass']['value']);
        $this->assertEquals(3, $metrics['gate_pass']['n']);
    }

    public function test_look_alike_slip_rate_excludes_pretest_taps(): void
    {
        $user = User::factory()->create();
        Event::insert([
            ['id' => 't1', 'user_id' => $user->id, 'type' => 'tap', 'ts' => 1000, 'surah' => 12, 'ayah' => 1, 'rung' => 'S2', 'correct' => false, 'pretest' => null, 'received_at' => 1000],
            ['id' => 't2', 'user_id' => $user->id, 'type' => 'tap', 'ts' => 1000, 'surah' => 12, 'ayah' => 1, 'rung' => 'S1', 'correct' => false, 'pretest' => true, 'received_at' => 1000],
            ['id' => 't3', 'user_id' => $user->id, 'type' => 'tap', 'ts' => 1000, 'surah' => 12, 'ayah' => 1, 'rung' => 'S2', 'correct' => true, 'pretest' => null, 'received_at' => 1000],
        ]);

        $res = $this->getJson('/api/admin/metrics', $this->adminHeaders());
        $metrics = collect($res->json('metrics'))->keyBy('key');
        // pretest tap excluded -> 1 slip / 2 graded taps = 50%
        $this->assertEquals('50%', $metrics['slip_rate']['value']);
        $this->assertEquals(2, $metrics['slip_rate']['n']);
    }

    public function test_confusion_pairs_group_by_target_and_choice(): void
    {
        $user = User::factory()->create();
        Event::insert([
            ['id' => 'c1', 'user_id' => $user->id, 'type' => 'tap', 'ts' => 1000, 'surah' => 12, 'ayah' => 1, 'rung' => 'S2', 'position' => 3, 'choice' => 'قَالَ', 'correct' => false, 'received_at' => 1000],
            ['id' => 'c2', 'user_id' => $user->id, 'type' => 'tap', 'ts' => 1000, 'surah' => 12, 'ayah' => 1, 'rung' => 'S2', 'position' => 3, 'choice' => 'قَالَ', 'correct' => false, 'received_at' => 1000],
        ]);

        $res = $this->getJson('/api/admin/metrics', $this->adminHeaders());
        $pairs = $res->json('confusionPairs');
        $this->assertCount(1, $pairs);
        $this->assertEquals(2, $pairs[0]['count']);
        $this->assertEquals('قَالَ', $pairs[0]['chosen']);
    }

    public function test_user_drill_down_reports_encoded_count_and_gate_stats(): void
    {
        $user = User::factory()->create();
        Event::insert([
            ['id' => 'd1', 'user_id' => $user->id, 'type' => 'ayah_produced', 'ts' => 1000, 'surah' => 12, 'ayah' => 1, 'rung' => 'S3', 'correct' => null, 'received_at' => 1000],
            ['id' => 'd2', 'user_id' => $user->id, 'type' => 'ayah_produced', 'ts' => 1000, 'surah' => 12, 'ayah' => 2, 'rung' => 'S3', 'correct' => null, 'received_at' => 1000],
            ['id' => 'd3', 'user_id' => $user->id, 'type' => 'gate_result', 'ts' => 1000, 'surah' => 12, 'ayah' => 1, 'rung' => 'S3', 'correct' => true, 'received_at' => 1000],
        ]);

        $res = $this->getJson("/api/admin/users/{$user->id}", $this->adminHeaders());
        $res->assertOk()
            ->assertJsonPath('ayatEncoded', 2)
            ->assertJsonPath('gatesPassed', 1)
            ->assertJsonPath('gatesTotal', 1);
    }

    public function test_unknown_user_is_404(): void
    {
        $this->getJson('/api/admin/users/999999', $this->adminHeaders())->assertStatus(404);
    }

    public function test_users_list_orders_by_event_count(): void
    {
        $quiet = User::factory()->create();
        $active = User::factory()->create();
        Event::insert([
            ['id' => 'u1', 'user_id' => $active->id, 'type' => 'reconstruct_tap', 'ts' => 1000, 'surah' => 12, 'ayah' => 1, 'rung' => 'RC', 'received_at' => 1000],
            ['id' => 'u2', 'user_id' => $active->id, 'type' => 'reconstruct_tap', 'ts' => 1000, 'surah' => 12, 'ayah' => 1, 'rung' => 'RC', 'received_at' => 1000],
        ]);

        $res = $this->getJson('/api/admin/users', $this->adminHeaders());
        $users = $res->json('users');
        $this->assertEquals($active->id, $users[0]['id']);
        $this->assertEquals(2, $users[0]['events']);
        $this->assertEquals(0, collect($users)->firstWhere('id', $quiet->id)['events']);
    }
}
