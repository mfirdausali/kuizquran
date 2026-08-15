<?php

namespace Tests\Feature\Overrides;

use App\Models\AdminRole;
use App\Models\CorpusAyahHash;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * Build-plan step 15's own named live gap (DEFECTS.md#B3): "the LIVE wiring
 * that automatically re-runs corpus:ingest-hashes with an override-aware
 * recompute the moment an override is written... today, closing the loop
 * end-to-end requires manually re-running the ingest command after an
 * override; the COMPUTATION and the FRONTIER LOGIC are both proven correct,
 * only the automatic trigger is missing."
 *
 * VerificationsTest.php's own b3 test already proves the frontier reacts
 * correctly to ANY hash change; corpus-compiler's hash.test.ts already
 * proves an override CHANGES the hash. Neither proves an override write
 * actually TRIGGERS a recompute without a human running a command by hand.
 * This does, against the REAL compiled surah-112 corpus (`make
 * compile-corpus`) rather than a hand-seeded hash row — an override
 * genuinely changes what the compiler would emit, not merely what a test
 * fixture claims it emits.
 */
class OverrideHashRecomputeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('admin.emails', ['admin@example.com']);
    }

    /** v3-D92: this file's own b3 test signs a qari-tier verification, so
     *  the fixture admin needs the qari role, not just the allowlist. */
    private function adminHeaders(): array
    {
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        AdminRole::create([
            'user_id' => $admin->id, 'role' => AdminRole::QARI,
            'granted_at' => (int) round(microtime(true) * 1000), 'granted_by' => 'test-fixture',
        ]);
        $token = $admin->createToken('device')->plainTextToken;

        return ['Authorization' => 'Bearer '.$token];
    }

    /** The real, compiled hashes.json for surah 112 — never hand-seeded, so
     *  this test fails loudly (not silently skips) if `make compile-corpus`
     *  has not run, the same shape every other test depending on the
     *  compiled corpus already uses (v3-D77). */
    private function ingestRealSurah112Hashes(): void
    {
        $path = config('corpus.compiler_path').'/output/112/hashes.json';
        $this->assertFileExists($path, 'run `make compile-corpus` before this test — no hand-seeded fixture substitutes for the real compiled artifact');
        Artisan::call('corpus:ingest-hashes', ['surah' => 112, 'path' => $path]);
    }

    public function test_writing_a_gloss_override_automatically_recomputes_and_re_ingests_the_qari_hash(): void
    {
        $this->ingestRealSurah112Hashes();
        $before = CorpusAyahHash::where('surah', 112)->where('ayah', 1)->first();
        $this->assertNotNull($before);

        $this->postJson('/api/overrides', [
            'surah' => 112, 'ayah' => 1, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'test-only-placeholder-gloss'],
        ], $this->adminHeaders())->assertCreated();

        $after = CorpusAyahHash::where('surah', 112)->where('ayah', 1)->first();
        $this->assertNotSame($before->qari_hash, $after->qari_hash, 'the qari hash must move the moment the override lands — no manual re-ingest');
        $this->assertSame($before->admin_hash, $after->admin_hash, 'a gloss override must never move the admin-tier hash');

        // A sibling ayah with no override is untouched byte-for-byte.
        $siblingBefore = CorpusAyahHash::where('surah', 112)->where('ayah', 2)->first()->qari_hash;
        $this->assertSame($siblingBefore, CorpusAyahHash::where('surah', 112)->where('ayah', 2)->first()->qari_hash);
    }

    /** The actual defect B3 describes, closed end to end: a qari signs
     *  ayah 1, an admin then overrides its gloss, and the row must stop
     *  reading verified WITHOUT a human re-running anything. */
    public function test_b3_closed_end_to_end_a_verified_ayah_goes_stale_the_moment_the_override_is_written(): void
    {
        $this->ingestRealSurah112Hashes();
        $headers = $this->adminHeaders();

        $this->postJson('/api/verifications', [
            'surah' => 112, 'ayah' => 1, 'tier' => 'qari', 'reviewerKind' => 'human',
        ], $headers)->assertCreated();
        $this->assertSame('verified', $this->getJson('/api/verifications?surah=112')->json('frontier.1.qari'));

        $this->postJson('/api/overrides', [
            'surah' => 112, 'ayah' => 1, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'test-only-placeholder-gloss'],
        ], $headers)->assertCreated();

        // No manual `corpus:ingest-hashes` re-run happens between the
        // override write and this read — that absence IS the test.
        $this->assertSame('stale', $this->getJson('/api/verifications?surah=112')->json('frontier.1.qari'));
    }

    public function test_a_distractor_override_recomputes_the_admin_hash_not_the_qari_hash(): void
    {
        $this->ingestRealSurah112Hashes();
        $before = CorpusAyahHash::where('surah', 112)->where('ayah', 1)->first();

        $this->postJson('/api/overrides', [
            'surah' => 112, 'ayah' => 1, 'position' => 1, 'questionType' => 'S1',
            'field' => 'distractor',
            'payload' => ['distractors' => [['text' => 'test-only-placeholder-foil', 'rank' => 1, 'prd_rank' => 'synonym', 'src_type' => 'semantic', 'why' => 'override']]],
        ], $this->adminHeaders())->assertCreated();

        $after = CorpusAyahHash::where('surah', 112)->where('ayah', 1)->first();
        $this->assertNotSame($before->admin_hash, $after->admin_hash);
        $this->assertSame($before->qari_hash, $after->qari_hash);
    }

    public function test_the_override_write_itself_still_succeeds_even_if_the_surah_was_never_compiled(): void
    {
        // No ingestRealSurah112Hashes() call, and surah 999 has no compiled
        // output anywhere — the recompute cannot run, but B1/append-only
        // guarantees must not regress because of it: the admin's override
        // is real content and must be saved regardless.
        $response = $this->postJson('/api/overrides', [
            'surah' => 999, 'ayah' => 1, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'placeholder'],
        ], $this->adminHeaders())->assertCreated();

        $this->assertDatabaseHas('overrides', ['surah' => 999, 'ayah' => 1, 'field' => 'gloss']);
        $this->assertFalse($response->json('hashRecompute.ok'));
    }
}
