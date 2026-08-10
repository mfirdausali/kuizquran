<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Build-plan step 15 (v3-D33): "specs (immutable, versioned,
     * tombstone-as-flip)". IMMUTABLE — no row is ever UPDATEd or DELETEd.
     * VERSIONED — `spec_id` groups a lineage; each edit is a NEW row with
     * `version` incremented. TOMBSTONE-AS-FLIP — deactivating a spec is a
     * new version row with `active=false`, never a delete; the latest row
     * per `spec_id` is always the current truth.
     *
     * `payload`'s inner shape is a PLACEHOLDER (v3-D33) — the question
     * compiler (build-plan step 16, one step later BY DESIGN) owns the
     * real shape. The one guarantee enforced from row one:
     * SpecsController::store() rejects any payload containing
     * `rung`/`pretest`/`atom`/`structured` at any depth — WIREFRAME's hard
     * problem 1, "the fold never dereferences a spec id," must hold from
     * the first row ever written.
     */
    public function up(): void
    {
        Schema::create('specs', function (Blueprint $table) {
            $table->id();
            $table->uuid('spec_id'); // groups a lineage across versions
            $table->unsignedInteger('version');
            $table->boolean('active');
            $table->unsignedSmallInteger('surah');
            $table->string('site_key'); // site.ts#siteKey() shape: surah:kind:ayah
            $table->string('lane'); // s1 | cloze | rc | junction | locate | reorder
            $table->json('payload');
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('created_at');

            $table->index(['spec_id', 'version']);
            $table->index(['surah', 'site_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('specs');
    }
};
