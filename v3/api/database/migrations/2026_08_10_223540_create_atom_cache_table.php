<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Build-plan step 14 (M3 ships list): "atom_cache (engine_version)".
     * Schema only — Laravel OWNS this table but never WRITES the folded
     * values into it (v3-D08: the Node fold-runner is the sole server-side
     * fold; PHP never re-implements engine logic). One row per
     * (user_id, surah, kind, ref) atom — see
     * `v3/packages/engine/src/atom.ts`'s `AtomState`, which this table
     * mirrors field-for-field.
     *
     * `engine_version` lets `fold_determinism_check` (deferred — see
     * DECISIONS.md v3-D32) distinguish a genuine divergence from a stale
     * cache computed under a since-superseded engine build (WARN, not P1,
     * per BUILD-PLAN.md's gates: "version skew = WARN").
     */
    public function up(): void
    {
        Schema::create('atom_cache', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('surah');
            $table->string('kind'); // "ayah" | "connection" — AtomKind
            $table->unsignedSmallInteger('ref');

            $table->float('strength');
            $table->float('stability');
            $table->float('difficulty');
            $table->unsignedBigInteger('last_retrieval')->nullable();
            $table->unsignedInteger('reps');
            $table->unsignedInteger('lapses');
            $table->boolean('encoded');
            $table->unsignedBigInteger('gate_due_at')->nullable();
            $table->boolean('gate_passed');
            $table->unsignedInteger('gate_fails');

            $table->string('engine_version');
            $table->unsignedBigInteger('computed_at'); // server-stamped epoch ms

            $table->unique(['user_id', 'surah', 'kind', 'ref']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('atom_cache');
    }
};
