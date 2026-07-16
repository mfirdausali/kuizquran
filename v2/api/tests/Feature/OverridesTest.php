<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * v2-D21/D55/ROADMAP Phase 6: the question-bank override layer. GET /overrides
 * is public (every device, including anonymous, must resolve overrides at
 * question-build time); POST /admin/overrides is admin-only and append-only.
 */
class OverridesTest extends TestCase
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

    public function test_public_overrides_list_requires_no_auth(): void
    {
        $this->getJson('/api/overrides?surah=12')->assertOk()->assertJson(['overrides' => []]);
    }

    public function test_creating_an_override_requires_admin(): void
    {
        $user = User::factory()->create(['email' => 'nobody@example.com', 'is_anonymous' => false]);
        $token = $user->createToken('device')->plainTextToken;

        $this->withHeaders(['Authorization' => "Bearer $token"])
            ->postJson('/api/admin/overrides', [
                'surah' => 12, 'ayah' => 1, 'position' => 1,
                'questionType' => 'S1', 'field' => 'gloss',
                'payload' => ['lang' => 'en', 'text' => 'By the clear Book'],
            ])
            ->assertStatus(403);
    }

    public function test_admin_creates_an_override_and_it_surfaces_in_the_public_list(): void
    {
        $res = $this->withHeaders($this->adminHeaders())->postJson('/api/admin/overrides', [
            'surah' => 12, 'ayah' => 1, 'position' => 1,
            'questionType' => 'S1', 'field' => 'gloss',
            'payload' => ['lang' => 'en', 'text' => 'Indeed'],
            'note' => 'clarified for beginners',
        ]);
        $res->assertCreated()->assertJsonPath('override.field', 'gloss');

        $list = $this->getJson('/api/overrides?surah=12')->assertOk()->json('overrides');
        $this->assertCount(1, $list);
        $this->assertEquals('gloss', $list[0]['field']);
        $this->assertEquals('Indeed', $list[0]['payload']['text']);
        $this->assertNotNull($list[0]['editor_id']);
    }

    public function test_a_correction_is_a_new_row_not_an_update_append_only(): void
    {
        $headers = $this->adminHeaders();
        $first = ['surah' => 12, 'ayah' => 1, 'position' => 1, 'questionType' => 'S1', 'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'first try']];
        $second = ['surah' => 12, 'ayah' => 1, 'position' => 1, 'questionType' => 'S1', 'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'corrected']];

        $this->withHeaders($headers)->postJson('/api/admin/overrides', $first)->assertCreated();
        $this->withHeaders($headers)->postJson('/api/admin/overrides', $second)->assertCreated();

        $list = $this->getJson('/api/overrides?surah=12')->json('overrides');
        $this->assertCount(2, $list); // both rows persist; the client resolves latest-wins
    }

    public function test_rejects_an_unknown_field(): void
    {
        $this->withHeaders($this->adminHeaders())->postJson('/api/admin/overrides', [
            'surah' => 12, 'ayah' => 1, 'questionType' => 'S1', 'field' => 'bogus', 'payload' => ['x' => 1],
        ])->assertStatus(422);
    }

    public function test_overrides_are_scoped_per_surah(): void
    {
        $this->withHeaders($this->adminHeaders())->postJson('/api/admin/overrides', [
            'surah' => 12, 'ayah' => 1, 'questionType' => 'S1', 'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'x'],
        ])->assertCreated();

        $this->getJson('/api/overrides?surah=2')->assertOk()->assertJson(['overrides' => []]);
    }
}
