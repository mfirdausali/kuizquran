<?php

namespace Tests\Feature\Verifications;

use App\Models\CorpusAyahHash;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * Build-plan step 15. v3-D13's tiered hash + "verified = ANY row whose
 * hash matches current" predicate. DEFECTS.md#B3's closing test lives
 * here: "an override on a verified ayah flips the frontier amber."
 * (The override -> hash CHANGE half of that is proven in TS —
 * corpus-compiler/test/hash.test.ts's ayahQariHashWithOverrides suite;
 * this proves the LARAVEL-side frontier correctly reacts once the ingested
 * current hash changes for any reason, including that one.)
 */
class VerificationsTest extends TestCase
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

    /** An allowlisted admin who ALSO holds the qari role (v3-D92) — the only
     *  kind of admin who may sign a `tier: qari` verification row. */
    private function qariAdminHeaders(): array
    {
        $admin = User::factory()->create(['email' => 'qari-admin@example.com']);
        Config::set('admin.emails', ['admin@example.com', 'qari-admin@example.com']);
        \App\Models\AdminRole::create([
            'user_id' => $admin->id,
            'role' => \App\Models\AdminRole::QARI,
            'granted_at' => (int) round(microtime(true) * 1000),
            'granted_by' => 'test-fixture',
        ]);
        $token = $admin->createToken('device')->plainTextToken;

        return ['Authorization' => 'Bearer '.$token];
    }

    private function seedHash(int $surah, int $ayah, string $qariHash, string $adminHash = 'admin-hash'): void
    {
        CorpusAyahHash::create([
            'surah' => $surah, 'ayah' => $ayah, 'qari_hash' => $qariHash, 'admin_hash' => $adminHash,
            'hash_spec_version' => 1, 'ingested_at' => 1,
        ]);
    }

    public function test_an_ayah_with_no_verification_rows_is_grey_unverified(): void
    {
        $this->seedHash(12, 4, 'hash-a');
        $response = $this->getJson('/api/verifications?surah=12')->assertOk();
        $this->assertSame('unverified', $response->json('frontier.4.qari'));
    }

    public function test_write_requires_admin(): void
    {
        $this->seedHash(12, 4, 'hash-a');
        $this->postJson('/api/verifications', ['surah' => 12, 'ayah' => 4, 'tier' => 'qari', 'reviewerKind' => 'human'])
            ->assertStatus(401);
    }

    public function test_verifying_against_the_current_hash_reads_green(): void
    {
        $this->seedHash(12, 4, 'hash-a');
        $this->postJson('/api/verifications', [
            'surah' => 12, 'ayah' => 4, 'tier' => 'qari', 'reviewerKind' => 'human', 'note' => 'checked',
        ], $this->qariAdminHeaders())->assertCreated();

        $response = $this->getJson('/api/verifications?surah=12')->assertOk();
        $this->assertSame('verified', $response->json('frontier.4.qari'));
    }

    /** DEFECTS.md#B3's own closing language, made concrete: re-ingesting a
     *  NEW current hash for an already-verified ayah — the exact effect an
     *  override-aware recompute (proven in TS) would have — flips the
     *  frontier amber, without touching the verification row itself. */
    public function test_b3_a_hash_change_on_a_verified_ayah_flips_the_frontier_amber(): void
    {
        $this->seedHash(12, 4, 'hash-a');
        $this->postJson('/api/verifications', [
            'surah' => 12, 'ayah' => 4, 'tier' => 'qari', 'reviewerKind' => 'human',
        ], $this->qariAdminHeaders())->assertCreated();
        $this->assertSame('verified', $this->getJson('/api/verifications?surah=12')->json('frontier.4.qari'));

        // Simulate a re-ingest after the ayah's content changed (an
        // override, or a corpus recompile) — the verification row is
        // UNTOUCHED, only the "current" hash moved.
        CorpusAyahHash::where('surah', 12)->where('ayah', 4)->update(['qari_hash' => 'hash-b']);

        $response = $this->getJson('/api/verifications?surah=12')->assertOk();
        $this->assertSame('stale', $response->json('frontier.4.qari'));
        // The verification row itself is untouched — an audit trail, not overwritten.
        $this->assertDatabaseHas('ayah_verifications', ['surah' => 12, 'ayah' => 4, 'content_hash' => 'hash-a']);
    }

    public function test_re_verifying_after_a_hash_change_goes_green_again_without_deleting_the_stale_row(): void
    {
        $this->seedHash(12, 4, 'hash-a');
        $headers = $this->qariAdminHeaders();
        $this->postJson('/api/verifications', ['surah' => 12, 'ayah' => 4, 'tier' => 'qari', 'reviewerKind' => 'human'], $headers)->assertCreated();
        CorpusAyahHash::where('surah', 12)->where('ayah', 4)->update(['qari_hash' => 'hash-b']);
        $this->assertSame('stale', $this->getJson('/api/verifications?surah=12')->json('frontier.4.qari'));

        $this->postJson('/api/verifications', ['surah' => 12, 'ayah' => 4, 'tier' => 'qari', 'reviewerKind' => 'human'], $headers)->assertCreated();

        $this->assertSame('verified', $this->getJson('/api/verifications?surah=12')->json('frontier.4.qari'));
        $this->assertDatabaseCount('ayah_verifications', 2); // append-only — both rows survive
    }

    public function test_tiers_are_independent(): void
    {
        $this->seedHash(12, 4, 'qari-hash', 'admin-hash');
        $this->postJson('/api/verifications', ['surah' => 12, 'ayah' => 4, 'tier' => 'qari', 'reviewerKind' => 'human'], $this->qariAdminHeaders())->assertCreated();

        $response = $this->getJson('/api/verifications?surah=12')->assertOk();
        $this->assertSame('verified', $response->json('frontier.4.qari'));
        $this->assertSame('unverified', $response->json('frontier.4.admin'));
    }

    /** v3-D08: the server TOCTOU-reads its OWN stored current hash — a
     *  client cannot forge which hash a row is signed against. */
    public function test_server_stamps_the_current_hash_never_trusts_a_client_submitted_one(): void
    {
        $this->seedHash(12, 4, 'real-current-hash');
        $this->postJson('/api/verifications', [
            'surah' => 12, 'ayah' => 4, 'tier' => 'qari', 'reviewerKind' => 'human',
            'contentHash' => 'forged-hash', // ignored if even accepted
        ], $this->qariAdminHeaders())->assertCreated();

        $this->assertDatabaseHas('ayah_verifications', ['content_hash' => 'real-current-hash']);
        $this->assertDatabaseMissing('ayah_verifications', ['content_hash' => 'forged-hash']);
    }

    public function test_cannot_verify_an_ayah_with_no_ingested_hash(): void
    {
        $this->postJson('/api/verifications', [
            'surah' => 12, 'ayah' => 999, 'tier' => 'qari', 'reviewerKind' => 'human',
        ], $this->qariAdminHeaders())->assertStatus(422);
    }

    public function test_reviewer_kind_must_be_ai_or_human(): void
    {
        $this->seedHash(12, 4, 'hash-a');
        $this->postJson('/api/verifications', [
            'surah' => 12, 'ayah' => 4, 'tier' => 'qari', 'reviewerKind' => 'robot',
        ], $this->qariAdminHeaders())->assertStatus(422);
    }

    public function test_tier_must_be_qari_or_admin(): void
    {
        $this->seedHash(12, 4, 'hash-a');
        $this->postJson('/api/verifications', [
            'surah' => 12, 'ayah' => 4, 'tier' => 'bogus', 'reviewerKind' => 'human',
        ], $this->adminHeaders())->assertStatus(422);
    }

    // ───────────────────── the qari-role gap (v3-D92) ────────────────────────

    /**
     * `AdminRole::QARI` and `User::hasAdminRole()` existed since build-plan
     * step 24, and the roles migration's own docblock says a role "refines
     * what an already-allowlisted admin may do" — but nothing anywhere ever
     * checked one. Any allowlisted admin, holding no role at all, could sign
     * a `tier: qari` row — the exact row LAUNCH-CHECKLIST gate 7 says "no
     * agent may sign", extended in practice to "no non-qari admin either".
     * RED before this run's fix: an admin with zero admin_roles rows must be
     * refused, not merely discouraged.
     */
    public function test_signing_the_qari_tier_requires_the_qari_admin_role(): void
    {
        $this->seedHash(12, 4, 'hash-a');
        $this->postJson('/api/verifications', [
            'surah' => 12, 'ayah' => 4, 'tier' => 'qari', 'reviewerKind' => 'human',
        ], $this->adminHeaders())->assertStatus(403);

        $this->assertDatabaseCount('ayah_verifications', 0);
        $this->assertSame('unverified', $this->getJson('/api/verifications?surah=12')->json('frontier.4.qari'));
    }

    /** The admin tier (distractors + specs, v3-D13) is general admin work,
     *  never scholar-gated — any allowlisted admin may sign it. */
    public function test_the_admin_tier_needs_no_special_role(): void
    {
        $this->seedHash(12, 4, 'qari-hash', 'admin-hash');
        $this->postJson('/api/verifications', [
            'surah' => 12, 'ayah' => 4, 'tier' => 'admin', 'reviewerKind' => 'human',
        ], $this->adminHeaders())->assertCreated();

        $this->assertSame('verified', $this->getJson('/api/verifications?surah=12')->json('frontier.4.admin'));
    }

    /** A user granted the qari role (via `admin:grant-role`) may sign the
     *  qari tier — the positive case the negative test above implies. */
    public function test_an_admin_granted_the_qari_role_may_sign_the_qari_tier(): void
    {
        $this->seedHash(12, 4, 'hash-a');
        $this->postJson('/api/verifications', [
            'surah' => 12, 'ayah' => 4, 'tier' => 'qari', 'reviewerKind' => 'human',
        ], $this->qariAdminHeaders())->assertCreated();

        $this->assertSame('verified', $this->getJson('/api/verifications?surah=12')->json('frontier.4.qari'));
    }
}
