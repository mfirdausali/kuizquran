<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * v2-D30/D57/ROADMAP Phase 6: the "verified frontier stays ahead of the
 * learner frontier" admin metric. `verifiedThrough` is the longest unbroken
 * 1..N prefix of verified ayat — a gap anywhere caps it, since a scattered
 * verified set can't safely summarize as "verified through N".
 */
class AyahVerificationTest extends TestCase
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

    public function test_marking_ayat_verified_extends_the_prefix(): void
    {
        $headers = $this->adminHeaders();
        foreach ([1, 2, 3] as $ayah) {
            $this->withHeaders($headers)->postJson('/api/admin/verifications', ['surah' => 12, 'ayah' => $ayah])->assertOk();
        }

        $res = $this->getJson('/api/admin/frontier?surah=12&ayahCount=111', $headers);
        $res->assertOk()->assertJson(['verifiedThrough' => 3, 'learnerFrontier' => 0, 'bufferAyat' => 3]);
    }

    public function test_a_gap_caps_the_verified_prefix(): void
    {
        $headers = $this->adminHeaders();
        foreach ([1, 2, 4] as $ayah) { // 3 is skipped
            $this->withHeaders($headers)->postJson('/api/admin/verifications', ['surah' => 12, 'ayah' => $ayah])->assertOk();
        }

        $res = $this->withHeaders($headers)->getJson('/api/admin/frontier?surah=12&ayahCount=111');
        $res->assertOk()->assertJsonPath('verifiedThrough', 2);
    }

    public function test_reverifying_the_same_ayah_upserts_not_duplicates(): void
    {
        $headers = $this->adminHeaders();
        $this->withHeaders($headers)->postJson('/api/admin/verifications', ['surah' => 12, 'ayah' => 1, 'note' => 'first pass'])->assertOk();
        $this->withHeaders($headers)->postJson('/api/admin/verifications', ['surah' => 12, 'ayah' => 1, 'note' => 'second pass'])->assertOk();

        $list = $this->withHeaders($headers)->getJson('/api/admin/verifications?surah=12')->json('verifications');
        $this->assertCount(1, $list);
        $this->assertEquals('second pass', $list[0]['note']);
    }

    public function test_learner_frontier_is_the_furthest_any_user_has_encoded(): void
    {
        $u1 = User::factory()->create();
        $u2 = User::factory()->create();
        Event::insert([
            ['id' => 'e1', 'user_id' => $u1->id, 'type' => 'ayah_produced', 'ts' => 1000, 'surah' => 12, 'ayah' => 5, 'rung' => 'S3', 'received_at' => 1000],
            ['id' => 'e2', 'user_id' => $u2->id, 'type' => 'rung_complete', 'ts' => 1000, 'surah' => 12, 'ayah' => 9, 'rung' => 'S3', 'received_at' => 1000],
            ['id' => 'e3', 'user_id' => $u2->id, 'type' => 'ayah_produced', 'ts' => 1000, 'surah' => 12, 'ayah' => 30, 'rung' => 'S2', 'received_at' => 1000], // partial, doesn't count
        ]);

        $headers = $this->adminHeaders();
        $res = $this->withHeaders($headers)->getJson('/api/admin/frontier?surah=12&ayahCount=111');
        $res->assertOk()->assertJsonPath('learnerFrontier', 9);
    }

    public function test_non_admin_cannot_mark_verified(): void
    {
        $user = User::factory()->create(['email' => 'nobody@example.com', 'is_anonymous' => false]);
        $token = $user->createToken('device')->plainTextToken;

        $this->withHeaders(['Authorization' => "Bearer $token"])
            ->postJson('/api/admin/verifications', ['surah' => 12, 'ayah' => 1])
            ->assertStatus(403);
    }
}
