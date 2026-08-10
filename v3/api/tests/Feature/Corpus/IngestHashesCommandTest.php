<?php

namespace Tests\Feature\Corpus;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Build-plan step 15 (M3 ships list): "corpus hash-table ingest command
 * (Laravel never computes hashes)." Reads corpus-compiler's per-surah
 * `hashes.json` (AyahHashRow[]: {ayah, qariHash, adminHash,
 * hashSpecVersion}) and upserts into `corpus_ayah_hashes`. This command
 * computes NOTHING — it only stores what TS already computed.
 */
class IngestHashesCommandTest extends TestCase
{
    use RefreshDatabase;

    private function writeHashesFile(array $rows): string
    {
        Storage::fake('local');
        $path = Storage::path('hashes-test.json');
        file_put_contents($path, json_encode($rows));

        return $path;
    }

    public function test_ingests_every_row_for_the_given_surah(): void
    {
        $path = $this->writeHashesFile([
            ['ayah' => 1, 'qariHash' => 'q1', 'adminHash' => 'a1', 'hashSpecVersion' => 1],
            ['ayah' => 2, 'qariHash' => 'q2', 'adminHash' => 'a2', 'hashSpecVersion' => 1],
        ]);

        $this->artisan('corpus:ingest-hashes', ['surah' => 12, 'path' => $path])->assertSuccessful();

        $this->assertDatabaseHas('corpus_ayah_hashes', ['surah' => 12, 'ayah' => 1, 'qari_hash' => 'q1', 'admin_hash' => 'a1']);
        $this->assertDatabaseHas('corpus_ayah_hashes', ['surah' => 12, 'ayah' => 2, 'qari_hash' => 'q2', 'admin_hash' => 'a2']);
        $this->assertDatabaseCount('corpus_ayah_hashes', 2);
    }

    public function test_re_ingesting_the_same_surah_overwrites_not_duplicates(): void
    {
        $path1 = $this->writeHashesFile([
            ['ayah' => 1, 'qariHash' => 'q1-old', 'adminHash' => 'a1', 'hashSpecVersion' => 1],
        ]);
        $this->artisan('corpus:ingest-hashes', ['surah' => 12, 'path' => $path1])->assertSuccessful();

        $path2 = $this->writeHashesFile([
            ['ayah' => 1, 'qariHash' => 'q1-new', 'adminHash' => 'a1', 'hashSpecVersion' => 1],
        ]);
        $this->artisan('corpus:ingest-hashes', ['surah' => 12, 'path' => $path2])->assertSuccessful();

        $this->assertDatabaseCount('corpus_ayah_hashes', 1);
        $this->assertDatabaseHas('corpus_ayah_hashes', ['surah' => 12, 'ayah' => 1, 'qari_hash' => 'q1-new']);
    }

    public function test_fails_loudly_on_a_missing_file(): void
    {
        $this->artisan('corpus:ingest-hashes', ['surah' => 12, 'path' => '/nonexistent/hashes.json'])
            ->assertFailed();
        $this->assertDatabaseCount('corpus_ayah_hashes', 0);
    }

    public function test_different_surahs_never_collide(): void
    {
        $path12 = $this->writeHashesFile([['ayah' => 1, 'qariHash' => 'q-12-1', 'adminHash' => 'a', 'hashSpecVersion' => 1]]);
        $this->artisan('corpus:ingest-hashes', ['surah' => 12, 'path' => $path12])->assertSuccessful();

        $path67 = $this->writeHashesFile([['ayah' => 1, 'qariHash' => 'q-67-1', 'adminHash' => 'a', 'hashSpecVersion' => 1]]);
        $this->artisan('corpus:ingest-hashes', ['surah' => 67, 'path' => $path67])->assertSuccessful();

        $this->assertDatabaseHas('corpus_ayah_hashes', ['surah' => 12, 'ayah' => 1, 'qari_hash' => 'q-12-1']);
        $this->assertDatabaseHas('corpus_ayah_hashes', ['surah' => 67, 'ayah' => 1, 'qari_hash' => 'q-67-1']);
    }
}
