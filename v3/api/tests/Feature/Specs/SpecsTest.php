<?php

namespace Tests\Feature\Specs;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Build-plan step 15 / v3-D33. Immutable, versioned, tombstone-as-flip.
 * `payload`'s inner shape is a placeholder for M4 (build-plan step 16) —
 * the one guarantee enforced now is WIREFRAME's hard problem 1: no spec
 * can ever carry a grading field.
 */
class SpecsTest extends TestCase
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
        $this->getJson('/api/specs?surah=12')->assertOk()->assertJson(['specs' => []]);
    }

    public function test_write_requires_admin(): void
    {
        $this->postJson('/api/specs', [
            'surah' => 12, 'siteKey' => '12:ayah:4', 'lane' => 's1', 'payload' => ['prompt' => 'x'],
        ])->assertStatus(401);
    }

    public function test_creating_a_spec_with_no_spec_id_starts_a_new_lineage_at_version_1(): void
    {
        $response = $this->postJson('/api/specs', [
            'surah' => 12, 'siteKey' => '12:ayah:4', 'lane' => 's1', 'payload' => ['prompt' => 'x'],
        ], $this->adminHeaders())->assertCreated();

        $this->assertSame(1, $response->json('spec.version'));
        $this->assertTrue($response->json('spec.active'));
        $this->assertNotNull($response->json('spec.specId'));
    }

    public function test_editing_an_existing_spec_id_creates_a_new_row_at_version_plus_1_never_updates_in_place(): void
    {
        $headers = $this->adminHeaders();
        $v1 = $this->postJson('/api/specs', [
            'surah' => 12, 'siteKey' => '12:ayah:4', 'lane' => 's1', 'payload' => ['prompt' => 'v1'],
        ], $headers)->assertCreated();
        $specId = $v1->json('spec.specId');

        $v2 = $this->postJson('/api/specs', [
            'specId' => $specId, 'surah' => 12, 'siteKey' => '12:ayah:4', 'lane' => 's1', 'payload' => ['prompt' => 'v2'],
        ], $headers)->assertCreated();

        $this->assertSame(2, $v2->json('spec.version'));
        $this->assertDatabaseCount('specs', 2);
        $this->assertDatabaseHas('specs', ['spec_id' => $specId, 'version' => 1]);
        $this->assertDatabaseHas('specs', ['spec_id' => $specId, 'version' => 2]);
    }

    public function test_read_returns_only_the_latest_version_per_lineage(): void
    {
        $headers = $this->adminHeaders();
        $v1 = $this->postJson('/api/specs', [
            'surah' => 12, 'siteKey' => '12:ayah:4', 'lane' => 's1', 'payload' => ['prompt' => 'v1'],
        ], $headers)->assertCreated();
        $specId = $v1->json('spec.specId');
        $this->postJson('/api/specs', [
            'specId' => $specId, 'surah' => 12, 'siteKey' => '12:ayah:4', 'lane' => 's1', 'payload' => ['prompt' => 'v2'],
        ], $headers)->assertCreated();

        $response = $this->getJson('/api/specs?surah=12')->assertOk();
        $this->assertCount(1, $response->json('specs'));
        $this->assertSame('v2', $response->json('specs.0.payload.prompt'));
        $this->assertSame(2, $response->json('specs.0.version'));
    }

    public function test_tombstone_as_flip_a_new_inactive_version_is_never_a_delete(): void
    {
        $headers = $this->adminHeaders();
        $v1 = $this->postJson('/api/specs', [
            'surah' => 12, 'siteKey' => '12:ayah:4', 'lane' => 's1', 'payload' => ['prompt' => 'x'],
        ], $headers)->assertCreated();
        $specId = $v1->json('spec.specId');

        $this->postJson('/api/specs', [
            'specId' => $specId, 'surah' => 12, 'siteKey' => '12:ayah:4', 'lane' => 's1',
            'payload' => ['prompt' => 'x'], 'active' => false,
        ], $headers)->assertCreated();

        $this->assertDatabaseCount('specs', 2); // never deleted
        $response = $this->getJson('/api/specs?surah=12')->assertOk();
        // Tombstoned specs are excluded from the servable set...
        $this->assertCount(0, $response->json('specs'));
        // ...but the full audit history is still readable.
        $this->assertCount(2, $response->json('all'));
    }

    /** WIREFRAME.md's hard problem 1: "no spec contains a bound check...
     *  the fold never dereferences a spec id." A grading field in a
     *  payload must never even reach the database. */
    public function test_payload_may_never_carry_a_grading_field_at_any_depth(): void
    {
        $headers = $this->adminHeaders();
        foreach (['rung', 'pretest', 'atom', 'structured'] as $forbidden) {
            $this->postJson('/api/specs', [
                'surah' => 12, 'siteKey' => '12:ayah:4', 'lane' => 's1',
                'payload' => [$forbidden => 'S3'],
            ], $headers)->assertStatus(422);

            $this->postJson('/api/specs', [
                'surah' => 12, 'siteKey' => '12:ayah:4', 'lane' => 's1',
                'payload' => ['nested' => ['deeper' => [$forbidden => 'S3']]],
            ], $headers)->assertStatus(422);
        }
        $this->assertDatabaseCount('specs', 0);
    }

    public function test_lane_must_be_one_of_the_six_closed_lanes(): void
    {
        $this->postJson('/api/specs', [
            'surah' => 12, 'siteKey' => '12:ayah:4', 'lane' => 'not-a-real-lane', 'payload' => [],
        ], $this->adminHeaders())->assertStatus(422);
    }

    public function test_editing_a_nonexistent_spec_id_fails(): void
    {
        $this->postJson('/api/specs', [
            'specId' => (string) Str::uuid(), 'surah' => 12,
            'siteKey' => '12:ayah:4', 'lane' => 's1', 'payload' => [],
        ], $this->adminHeaders())->assertStatus(422);
    }
}
