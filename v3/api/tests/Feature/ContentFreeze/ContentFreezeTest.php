<?php

namespace Tests\Feature\ContentFreeze;

use App\Models\AyahVerification;
use App\Models\CorpusAyahHash;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * Build-plan step 28 (M9). The freeze gate's database-side criteria.
 *
 * The load-bearing property: the gate reports NOT MET when the corpus is not
 * ready. A gate that reports MET on an empty or partial database would be
 * worse than no gate — it would license booking a scholar.
 */
class ContentFreezeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('admin.emails', ['admin@example.com']);
    }

    private function adminHeaders(): array
    {
        $admin = User::factory()->create([
            'email' => 'admin@example.com',
            'email_verified_at' => now(),
        ]);

        return ['Authorization' => 'Bearer '.$admin->createToken('device')->plainTextToken];
    }

    public function test_the_freeze_report_requires_admin(): void
    {
        $this->getJson('/api/admin/content-freeze')->assertStatus(401);
    }

    public function test_an_empty_database_is_not_bookable(): void
    {
        // THE MOST IMPORTANT ASSERTION IN THIS FILE. Nothing ingested, nothing
        // verified — the gate must not read as "all criteria met" simply
        // because no criterion found anything to complain about. A vacuous
        // green here books a scholar against an empty corpus.
        $this->withHeaders($this->adminHeaders())
            ->getJson('/api/admin/content-freeze?surahs=12')
            ->assertOk()
            ->assertJsonPath('bookable', false)
            ->assertJsonPath('allMet', false);
    }

    public function test_a_partially_verified_surah_is_not_bookable(): void
    {
        foreach ([1, 2] as $ayah) {
            CorpusAyahHash::create([
                'surah' => 103, 'ayah' => $ayah, 'qari_hash' => "q{$ayah}",
                'admin_hash' => "a{$ayah}", 'hash_spec_version' => 1, 'ingested_at' => 1,
            ]);
        }
        // Only ayah 1 signed, and only on the qari tier.
        AyahVerification::create([
            'surah' => 103, 'ayah' => 1, 'tier' => 'qari', 'content_hash' => 'q1',
            'hash_spec_version' => 1, 'reviewer_kind' => 'human', 'created_at' => 1,
        ]);

        $this->withHeaders($this->adminHeaders())
            ->getJson('/api/admin/content-freeze?surahs=103')
            ->assertOk()
            ->assertJsonPath('bookable', false);
    }

    public function test_a_fully_green_surah_reports_the_frontier_criterion_met(): void
    {
        foreach ([1, 2] as $ayah) {
            CorpusAyahHash::create([
                'surah' => 103, 'ayah' => $ayah, 'qari_hash' => "q{$ayah}",
                'admin_hash' => "a{$ayah}", 'hash_spec_version' => 1, 'ingested_at' => 1,
            ]);
            foreach (['qari' => "q{$ayah}", 'admin' => "a{$ayah}"] as $tier => $hash) {
                AyahVerification::create([
                    'surah' => 103, 'ayah' => $ayah, 'tier' => $tier, 'content_hash' => $hash,
                    'hash_spec_version' => 1, 'reviewer_kind' => 'ai', 'created_at' => 1,
                ]);
            }
        }

        $body = $this->withHeaders($this->adminHeaders())
            ->getJson('/api/admin/content-freeze?surahs=103')
            ->assertOk()
            ->json();

        $frontier = collect($body['criteria'])->firstWhere('name', 'Verification frontier green on every launch surah');
        $this->assertTrue($frontier['met']);
    }

    public function test_a_stale_signature_is_reported_not_bookable(): void
    {
        CorpusAyahHash::create([
            'surah' => 103, 'ayah' => 1, 'qari_hash' => 'CURRENT', 'admin_hash' => 'a1',
            'hash_spec_version' => 1, 'ingested_at' => 1,
        ]);
        // Signed against content that has since changed — B3's exact scenario.
        AyahVerification::create([
            'surah' => 103, 'ayah' => 1, 'tier' => 'qari', 'content_hash' => 'OLD',
            'hash_spec_version' => 1, 'reviewer_kind' => 'human', 'created_at' => 1,
        ]);
        AyahVerification::create([
            'surah' => 103, 'ayah' => 1, 'tier' => 'admin', 'content_hash' => 'a1',
            'hash_spec_version' => 1, 'reviewer_kind' => 'ai', 'created_at' => 2,
        ]);

        $this->withHeaders($this->adminHeaders())
            ->getJson('/api/admin/content-freeze?surahs=103')
            ->assertOk()
            ->assertJsonPath('bookable', false);
    }

    public function test_an_ai_only_surah_is_reported_as_licensing_no_scholar_claim(): void
    {
        // v3-D22: launch does not REQUIRE a human row, but no UI may claim
        // scholar verification without one. The report must say so, since the
        // person reading it is the person who would write that claim.
        CorpusAyahHash::create([
            'surah' => 103, 'ayah' => 1, 'qari_hash' => 'q1', 'admin_hash' => 'a1',
            'hash_spec_version' => 1, 'ingested_at' => 1,
        ]);
        foreach (['qari' => 'q1', 'admin' => 'a1'] as $tier => $hash) {
            AyahVerification::create([
                'surah' => 103, 'ayah' => 1, 'tier' => $tier, 'content_hash' => $hash,
                'hash_spec_version' => 1, 'reviewer_kind' => 'ai', 'created_at' => 1,
            ]);
        }

        $body = $this->withHeaders($this->adminHeaders())
            ->getJson('/api/admin/content-freeze?surahs=103')
            ->assertOk()->json();

        $frontier = collect($body['criteria'])->firstWhere('name', 'Verification frontier green on every launch surah');
        $joined = implode(' ', $frontier['evidence']);
        $this->assertStringContainsString('0/1 ayat carry a HUMAN', $joined);
        $this->assertStringContainsString('no surface may claim scholar verification', $joined);
    }

    public function test_mixed_hash_spec_versions_are_reported(): void
    {
        CorpusAyahHash::create([
            'surah' => 103, 'ayah' => 1, 'qari_hash' => 'q1', 'admin_hash' => 'a1',
            'hash_spec_version' => 1, 'ingested_at' => 1,
        ]);
        CorpusAyahHash::create([
            'surah' => 103, 'ayah' => 2, 'qari_hash' => 'q2', 'admin_hash' => 'a2',
            'hash_spec_version' => 2, 'ingested_at' => 1,
        ]);

        $body = $this->withHeaders($this->adminHeaders())
            ->getJson('/api/admin/content-freeze?surahs=103')
            ->assertOk()->json();

        $spec = collect($body['criteria'])->firstWhere('name', 'hashSpecVersion consistent across ingested rows');
        $this->assertFalse($spec['met']);
        $this->assertStringContainsString('MIXED', implode(' ', $spec['evidence']));
    }
}
