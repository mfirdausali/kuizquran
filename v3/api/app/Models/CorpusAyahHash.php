<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Build-plan step 15. CURRENT-STATE mirror of corpus-compiler's per-surah
 * `hashes.json` — ingested by `corpus:ingest-hashes`, never computed here
 * (v3-D08). Unique per (surah, ayah); re-ingest overwrites in place.
 */
class CorpusAyahHash extends Model
{
    public $timestamps = false;

    protected $table = 'corpus_ayah_hashes';

    protected $fillable = ['surah', 'ayah', 'qari_hash', 'admin_hash', 'hash_spec_version', 'ingested_at'];
}
