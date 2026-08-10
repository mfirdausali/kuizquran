<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Build-plan step 15 (M3 ships list: "corpus hash-table ingest
     * command (Laravel never computes hashes)"). CURRENT-STATE table
     * (unique per surah+ayah, re-ingest overwrites) — mirrors
     * corpus-compiler's per-surah `hashes.json` output
     * (`AyahHashRow[]`), ingested by `corpus:ingest-hashes`. Laravel
     * never computes a hash (v3-D08); this table only stores what TS
     * already computed and serialized.
     */
    public function up(): void
    {
        Schema::create('corpus_ayah_hashes', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('surah');
            $table->unsignedSmallInteger('ayah');
            $table->string('qari_hash');
            $table->string('admin_hash');
            $table->unsignedInteger('hash_spec_version');
            $table->unsignedBigInteger('ingested_at'); // server-stamped epoch ms

            $table->unique(['surah', 'ayah']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('corpus_ayah_hashes');
    }
};
