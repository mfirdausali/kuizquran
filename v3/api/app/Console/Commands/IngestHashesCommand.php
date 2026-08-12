<?php

namespace App\Console\Commands;

use App\Models\CorpusAyahHash;
use Illuminate\Console\Command;

/**
 * Build-plan step 15 (M3 ships list): "corpus hash-table ingest command
 * (Laravel never computes hashes)." Reads corpus-compiler's per-surah
 * `hashes.json` (AyahHashRow[]: {ayah, qariHash, adminHash,
 * hashSpecVersion}, build-plan step 4) and upserts into
 * `corpus_ayah_hashes`. Computes NOTHING — only stores what TS already
 * computed and serialized (v3-D08).
 */
class IngestHashesCommand extends Command
{
    protected $signature = 'corpus:ingest-hashes {surah : Surah number} {path : Path to hashes.json}';

    protected $description = 'Ingest a corpus-compiler hashes.json into corpus_ayah_hashes (Laravel never computes a hash)';

    public function handle(): int
    {
        $surah = (int) $this->argument('surah');
        $path = $this->argument('path');

        if (! is_file($path)) {
            $this->error("hashes file not found: {$path}");

            return self::FAILURE;
        }

        $rows = json_decode(file_get_contents($path), true);
        if (! is_array($rows)) {
            $this->error('hashes file did not contain a JSON array');

            return self::FAILURE;
        }

        try {
            self::ingestRows($surah, $rows);
        } catch (\RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("ingested {$this->argument('path')}: ".count($rows)." row(s) for surah {$surah}");

        return self::SUCCESS;
    }

    /**
     * The upsert itself, shared with `App\Support\CorpusHashRecomputer`
     * (build-plan step 15's B3 live-wiring gap) so the two callers — a
     * human hand-running this command, and the automatic recompute after
     * an override write — cannot silently diverge in what "ingest" means.
     *
     * @param  array<int,array<string,mixed>>  $rows
     */
    public static function ingestRows(int $surah, array $rows): void
    {
        $now = (int) round(microtime(true) * 1000);
        foreach ($rows as $row) {
            if (! isset($row['ayah'], $row['qariHash'], $row['adminHash'], $row['hashSpecVersion'])) {
                throw new \RuntimeException('malformed row: '.json_encode($row));
            }
            CorpusAyahHash::updateOrCreate(
                ['surah' => $surah, 'ayah' => $row['ayah']],
                [
                    'qari_hash' => $row['qariHash'],
                    'admin_hash' => $row['adminHash'],
                    'hash_spec_version' => $row['hashSpecVersion'],
                    'ingested_at' => $now,
                ],
            );
        }
    }
}
