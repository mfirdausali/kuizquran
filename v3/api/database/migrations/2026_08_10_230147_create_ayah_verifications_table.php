<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Build-plan step 15 / DEFECTS.md#B3 / v3-D13 / v3-D22. APPEND-ONLY —
     * unlike v2's `ayah_verifications` (a single upserted row per ayah,
     * which is exactly how B3 became possible: no history means an
     * override can silently invalidate a "verified" row with nothing
     * ever re-checking it). Every sign-off is a NEW row; "verified" is
     * computed at read time as "does ANY row's content_hash match the
     * CURRENT tier hash from corpus_ayah_hashes" — B4's ordering lesson
     * generalized: rows are read in `id` order, never `created_at` alone.
     *
     * `tier` (v3-D13): qari = text_uthmani+glosses+beats, admin =
     * distractors(+specs). `reviewer_kind` (v3-D22): ai | human — launch
     * requires AI-green + hash-current per surah; a human row is not
     * required to ship, but no UI may claim scholar verification for a
     * surah lacking one.
     */
    public function up(): void
    {
        Schema::create('ayah_verifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('surah');
            $table->unsignedSmallInteger('ayah');
            $table->string('tier'); // qari | admin
            $table->string('content_hash'); // the hash this row was signed against
            $table->unsignedInteger('hash_spec_version');
            $table->string('reviewer_kind'); // ai | human
            $table->string('verified_by')->nullable();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_at');

            $table->index(['surah', 'ayah', 'tier']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ayah_verifications');
    }
};
