<?php

namespace Tests\Feature\Overrides;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * Build-plan step 15. v2-D21/D55's override layer, carried forward — PUBLIC
 * read (every client needs these to build correct questions, including an
 * anonymous not-yet-synced device — same reasoning v2's OverridesController
 * used), admin-gated write.
 *
 * DEFECTS.md#B1 closing test: `field: "custom"` is rejected forever, not
 * merely unresolved downstream — the write path itself is the gate.
 */
class OverridesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('admin.emails', ['admin@example.com']);
    }

    private function adminHeaders(): array
    {
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        $token = $admin->createToken('device')->plainTextToken;

        return ['Authorization' => 'Bearer '.$token];
    }

    public function test_read_is_public_no_auth_required(): void
    {
        $this->getJson('/api/overrides?surah=12')->assertOk()->assertJson(['overrides' => []]);
    }

    public function test_read_is_scoped_to_the_requested_surah(): void
    {
        $headers = $this->adminHeaders();
        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
        ], $headers)->assertCreated();
        $this->postJson('/api/overrides', [
            'surah' => 67, 'ayah' => 1, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'x'],
        ], $headers)->assertCreated();

        $response = $this->getJson('/api/overrides?surah=12')->assertOk();
        $this->assertCount(1, $response->json('overrides'));
        $this->assertSame(12, $response->json('overrides.0.surah'));
    }

    public function test_write_requires_admin(): void
    {
        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
        ])->assertStatus(401);

        $nonAdmin = User::factory()->create(['email' => 'nobody@example.com']);
        $token = $nonAdmin->createToken('device')->plainTextToken;
        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
        ], ['Authorization' => 'Bearer '.$token])->assertStatus(403);
    }

    public function test_an_admin_can_write_a_gloss_override(): void
    {
        $response = $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
            'note' => 'clarify archaic English',
        ], $this->adminHeaders())->assertCreated();

        $this->assertDatabaseHas('overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'field' => 'gloss',
        ]);
        $this->assertNotNull($response->json('override.createdAt'));
    }

    /** DEFECTS.md#B1's own closing language: "POST rejects kind=custom
     *  forever." */
    public function test_field_custom_is_rejected_forever(): void
    {
        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => null, 'questionType' => 'S1',
            'field' => 'custom', 'payload' => ['prompt' => 'who spoke?', 'options' => ['a', 'b'], 'correct' => 'a'],
        ], $this->adminHeaders())->assertStatus(422);

        $this->assertDatabaseCount('overrides', 0);
    }

    public function test_field_must_be_one_of_the_closed_set(): void
    {
        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'anything-else', 'payload' => [],
        ], $this->adminHeaders())->assertStatus(422);
    }

    public function test_editor_id_is_always_the_authenticated_admin_never_the_body(): void
    {
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        $someoneElse = User::factory()->create();
        $token = $admin->createToken('device')->plainTextToken;

        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
            'editorId' => $someoneElse->id,
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        $this->assertDatabaseHas('overrides', ['editor_id' => $admin->id]);
        $this->assertDatabaseMissing('overrides', ['editor_id' => $someoneElse->id]);
    }

    public function test_rows_are_append_only_a_correction_is_a_new_row(): void
    {
        $headers = $this->adminHeaders();
        $body = [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
        ];
        $this->postJson('/api/overrides', $body, $headers)->assertCreated();
        $body['payload'] = ['lang' => 'en', 'text' => 'at the time'];
        $this->postJson('/api/overrides', $body, $headers)->assertCreated();

        $this->assertDatabaseCount('overrides', 2);
        $response = $this->getJson('/api/overrides?surah=12')->assertOk();
        $this->assertCount(2, $response->json('overrides'));
    }
}
