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
        // v2-D21/D55/ROADMAP Phase 6 Appendix A §D: the question-bank override
        // layer. Append-only audit (never updated/deleted) — correcting a prior
        // edit means inserting a NEW row for the same key; applyOverrides() in
        // the engine resolves the latest created_at per field-scoped key.
        Schema::create('question_overrides', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('surah');
            $table->unsignedSmallInteger('ayah');
            $table->unsignedSmallInteger('position')->nullable(); // null = ayah-wide (e.g. a custom question)
            $table->string('question_type'); // e.g. S1/S2/S3/S4/RC/vocab/cloze/junction/locate/reorder/produce
            $table->string('field'); // gloss | distractor | group | disable | custom
            $table->json('payload');
            $table->foreignId('editor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_at'); // client/server-stamped epoch ms (matches events.ts's ts style)

            $table->index(['surah', 'ayah', 'position']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('question_overrides');
    }
};
