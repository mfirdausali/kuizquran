<?php

namespace Tests\Feature\GlossDrafts;

use App\Models\AyahVerification;
use App\Models\CorpusAyahHash;
use App\Models\GlossDraft;
use App\Models\GlossDraftReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * Build-plan step 27 (M9). The MS gloss authoring workflow (v3-D15).
 *
 * The interesting assertions here are the NEGATIVE ones — what this surface
 * REFUSES to do — because the risk it manages is doctrinal, not functional.
 */
class GlossDraftsTest extends TestCase
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
        $token = $admin->createToken('device')->plainTextToken;

        return ['Authorization' => 'Bearer '.$token];
    }

    // ---- THE TABLE SHIPS EMPTY ----

    public function test_the_gloss_draft_table_ships_empty(): void
    {
        // BUILD-PLAN permits agents to draft into a flagged non-shipping table
        // ONLY with Firdaus's ratification, and DECISIONS.md records none. A
        // seeder or migration-inserted row would violate that silently, so the
        // emptiness is asserted rather than assumed.
        $this->assertSame(0, GlossDraft::count());
        $this->assertSame(0, GlossDraftReview::count());
    }

    // ---- READS ARE ADMIN-ONLY (unlike /verifications) ----

    public function test_reading_drafts_requires_admin(): void
    {
        $this->getJson('/api/admin/gloss-drafts?surah=12')->assertStatus(401);
    }

    public function test_writing_a_draft_requires_admin(): void
    {
        $this->postJson('/api/admin/gloss-drafts', [
            'surah' => 12, 'ayah' => 1, 'position' => 1,
            'lang' => 'ms', 'text' => 'placeholder', 'authorKind' => 'human',
        ])->assertStatus(401);
    }

    // ---- THE HASH-LANGUAGE REFUSAL ----

    public function test_a_draft_cannot_be_written_for_a_language_the_qari_hash_reads(): void
    {
        // `en` IS an input to ayahQariHash. A draft in it could amber a signed
        // ayah, which is edge case #155's whole failure mode. The surface must
        // refuse rather than accept-and-flag.
        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/admin/gloss-drafts', [
                'surah' => 12, 'ayah' => 1, 'position' => 1,
                'lang' => 'en', 'text' => 'placeholder', 'authorKind' => 'human',
            ])
            ->assertStatus(422);

        $this->assertSame(0, GlossDraft::count());
    }

    // ---- A DRAFT DOES NOT MOVE THE FRONTIER (v3-D15) ----

    public function test_a_ms_draft_does_not_amber_a_signed_ayah(): void
    {
        CorpusAyahHash::create([
            'surah' => 12, 'ayah' => 4, 'qari_hash' => 'qari-hash-a',
            'admin_hash' => 'admin-hash-a', 'hash_spec_version' => 1, 'ingested_at' => 1,
        ]);
        AyahVerification::create([
            'surah' => 12, 'ayah' => 4, 'tier' => 'qari', 'content_hash' => 'qari-hash-a',
            'hash_spec_version' => 1, 'reviewer_kind' => 'human',
            'verified_by' => 'qari@example.com', 'created_at' => 1,
        ]);

        $before = $this->getJson('/api/verifications?surah=12')->assertOk();
        $this->assertSame('verified', $before->json('frontier.4.qari'));

        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/admin/gloss-drafts', [
                'surah' => 12, 'ayah' => 4, 'position' => 2,
                'lang' => 'ms', 'text' => 'a drafted malay gloss', 'authorKind' => 'human',
            ])
            ->assertStatus(201);

        // THE POINT: the qari's signature is untouched. gloss.ms is excluded
        // from hash v1, so no draft can invalidate scholar hours.
        $after = $this->getJson('/api/verifications?surah=12')->assertOk();
        $this->assertSame('verified', $after->json('frontier.4.qari'));
    }

    // ---- THE WORKFLOW: draft -> reviewed -> (merge REFUSED) ----

    public function test_the_review_workflow_records_the_text_it_approved(): void
    {
        $headers = $this->adminHeaders();
        $created = $this->withHeaders($headers)->postJson('/api/admin/gloss-drafts', [
            'surah' => 12, 'ayah' => 5, 'position' => 1,
            'lang' => 'ms', 'text' => 'first draft text', 'authorKind' => 'ai',
        ])->assertStatus(201);
        $id = $created->json('draft.id');

        $this->withHeaders($headers)->postJson("/api/admin/gloss-drafts/{$id}/review", [
            'toStatus' => 'reviewed', 'actorKind' => 'human', 'note' => 'checked against Basmeih',
        ])->assertOk()->assertJsonPath('draft.status', 'reviewed');

        // The approval names the BYTES it approved — B3's lesson.
        $review = GlossDraftReview::where('gloss_draft_id', $id)->latest('id')->first();
        $this->assertSame('first draft text', $review->text_at_review);
        $this->assertSame('human', $review->actor_kind);
    }

    public function test_editing_a_reviewed_draft_returns_it_to_draft(): void
    {
        $headers = $this->adminHeaders();
        $created = $this->withHeaders($headers)->postJson('/api/admin/gloss-drafts', [
            'surah' => 12, 'ayah' => 6, 'position' => 1,
            'lang' => 'ms', 'text' => 'approved text', 'authorKind' => 'human',
        ])->assertStatus(201);
        $id = $created->json('draft.id');

        $this->withHeaders($headers)->postJson("/api/admin/gloss-drafts/{$id}/review", [
            'toStatus' => 'reviewed', 'actorKind' => 'human',
        ])->assertOk();

        // A reviewer approved BYTES. Different bytes have not been approved.
        $this->withHeaders($headers)->postJson('/api/admin/gloss-drafts', [
            'surah' => 12, 'ayah' => 6, 'position' => 1,
            'lang' => 'ms', 'text' => 'DIFFERENT text', 'authorKind' => 'human',
        ])->assertOk()->assertJsonPath('draft.status', 'draft');

        $row = GlossDraft::find($id);
        $this->assertNull($row->reviewed_by);
        $this->assertNull($row->reviewed_at);
    }

    public function test_merging_is_refused_at_hash_v1(): void
    {
        $headers = $this->adminHeaders();
        $created = $this->withHeaders($headers)->postJson('/api/admin/gloss-drafts', [
            'surah' => 12, 'ayah' => 7, 'position' => 1,
            'lang' => 'ms', 'text' => 'some text', 'authorKind' => 'human',
        ])->assertStatus(201);
        $id = $created->json('draft.id');

        $this->withHeaders($headers)->postJson("/api/admin/gloss-drafts/{$id}/review", [
            'toStatus' => 'reviewed', 'actorKind' => 'human',
        ])->assertOk();

        // v3-D15: merging puts Malay in front of a learner. Closed until a
        // named Malay reviewer with doctrinal authority exists.
        $this->withHeaders($headers)->postJson("/api/admin/gloss-drafts/{$id}/review", [
            'toStatus' => 'merged', 'actorKind' => 'human',
        ])->assertStatus(422);

        $this->assertSame('reviewed', GlossDraft::find($id)->status);
        $this->assertSame(0, GlossDraft::where('status', 'merged')->count());
    }

    public function test_an_empty_draft_cannot_be_reviewed(): void
    {
        $headers = $this->adminHeaders();
        $created = $this->withHeaders($headers)->postJson('/api/admin/gloss-drafts', [
            'surah' => 12, 'ayah' => 8, 'position' => 1,
            'lang' => 'ms', 'text' => null, 'authorKind' => 'human',
        ])->assertStatus(201);
        $id = $created->json('draft.id');

        // "Reviewed" over nothing inflates the review surface's progress.
        $this->withHeaders($headers)->postJson("/api/admin/gloss-drafts/{$id}/review", [
            'toStatus' => 'reviewed', 'actorKind' => 'human',
        ])->assertStatus(422);
    }

    public function test_the_index_reports_that_these_rows_do_not_ship(): void
    {
        $this->withHeaders($this->adminHeaders())
            ->getJson('/api/admin/gloss-drafts?surah=12&lang=ms')
            ->assertOk()
            ->assertJsonPath('shipping', false)
            ->assertJsonPath('excludedFromHashV1', true);
    }
}
