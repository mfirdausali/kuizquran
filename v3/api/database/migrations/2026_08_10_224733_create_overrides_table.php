<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Build-plan step 15. v2-D21/D55's question-bank override layer,
     * carried forward — append-only audit (rows are inserted, never updated
     * or deleted; a correction is a NEW row with a later `created_at`).
     * `engine/src/overrides.ts#applyOverrides` resolves the latest
     * per-field-scoped key via `(created_at, id)` ordering (DEFECTS.md#B4,
     * already closed at build-plan step 8) — `id` here is that tiebreak.
     *
     * DEFECTS.md#B1 closes HERE, not just in the engine: `field` has no
     * `custom` value in the app-level closed set this migration's own
     * column comment names, and OverridesController::store() (the write
     * path) validates against that same closed set — `custom` was never a
     * real question-authoring mechanism (no renderer ever read it, per
     * B1's own description), and v3 has no such column to un-widen.
     */
    public function up(): void
    {
        Schema::create('overrides', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('surah');
            $table->unsignedSmallInteger('ayah');
            $table->unsignedSmallInteger('position')->nullable(); // null = ayah-wide
            $table->string('question_type'); // S1/S2/S3/S4/RC/vocab/cloze/junction/locate/reorder/produce
            $table->string('field'); // gloss | distractor | group | disable — NEVER custom (B1)
            $table->json('payload');
            $table->foreignId('editor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_at'); // matches engine's QuestionOverride.createdAt

            $table->index(['surah', 'ayah', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('overrides');
    }
};
