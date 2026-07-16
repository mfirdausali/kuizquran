<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // v2-D30/D57: scholar/qari sign-off that one ayah's generated questions
        // are Arabic-correct. Feeds the admin console's "verified frontier vs.
        // learner frontier" metric (GATE-A, ROADMAP Phase 7). One row per
        // (surah, ayah); re-verifying just upserts the same row (verification is
        // a current-state fact, not an append-only history like events/overrides).
        Schema::create('ayah_verifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('surah');
            $table->unsignedSmallInteger('ayah');
            $table->string('verified_by')->nullable();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_at');

            $table->unique(['surah', 'ayah']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ayah_verifications');
    }
};
