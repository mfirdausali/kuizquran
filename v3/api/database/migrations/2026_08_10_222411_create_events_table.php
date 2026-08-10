<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Build-plan step 14. `id` is the server-assigned, monotonically
     * increasing INGEST SEQUENCE — the pull protocol's cursor
     * ("cursored on server ingest-sequence, late-arrival safe"): a client
     * asks for `id > since` and is guaranteed to see every row ingested
     * after its last pull, REGARDLESS of that row's own `ts` (a late-
     * arriving offline event with an old `ts` still gets a fresh, larger
     * `id` the moment the server actually receives it — cursoring on `ts`
     * could silently skip it; cursoring on `id` cannot).
     *
     * `uuid` is the client-stamped idempotency key (v2-D18's contract,
     * carried forward) — unique PER USER, not globally, so two different
     * learners' devices independently generating the same uuid (astronomically
     * unlikely but not impossible) can never collide across accounts.
     *
     * Every DrillEvent wire field frozen at build-plan step 10 (v3-D10) gets
     * its own column — Laravel stores them, never computes or reinterprets
     * them (v3-D08: no PHP re-implementation of engine logic).
     */
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id(); // server ingest-sequence — the pull cursor
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('uuid'); // client-stamped idempotency key
            $table->string('type');
            $table->unsignedBigInteger('ts'); // client-stamped epoch ms

            // ---- pre-existing (v2-D18) fields ----
            $table->unsignedSmallInteger('surah')->nullable();
            $table->unsignedSmallInteger('ayah')->nullable();
            $table->string('rung')->nullable();
            $table->unsignedSmallInteger('position')->nullable();
            $table->string('choice')->nullable();
            $table->boolean('correct')->nullable();
            $table->boolean('pretest')->nullable();
            $table->unsignedSmallInteger('to_ayah')->nullable();
            $table->string('step_kind')->nullable();
            $table->boolean('structured')->nullable();
            $table->unsignedInteger('latency')->nullable();
            $table->string('resume')->nullable();
            $table->string('test_kind')->nullable();
            $table->float('score')->nullable();
            $table->unsignedSmallInteger('total')->nullable();
            $table->boolean('sent_to_reviews')->nullable();

            // ---- v3-D10 wire freeze (build-plan step 10) ----
            $table->string('site_key')->nullable();
            $table->unsignedInteger('visit_ordinal')->nullable();
            $table->string('device_id')->nullable();
            $table->unsignedInteger('device_seq')->nullable();
            $table->string('tz')->nullable();
            $table->string('corpus_hash')->nullable();
            $table->string('locale')->nullable();
            // Provenance only (v3-D10) — the fold NEVER reads this column;
            // engine/src/rebuild.ts's structural test proves the engine side,
            // and the Node fold-runner (deferred, see DECISIONS.md) must
            // honor the same rule server-side when it lands.
            $table->json('spec_snapshot')->nullable();
            $table->string('grade_class')->nullable();

            $table->unsignedBigInteger('received_at'); // server-stamped epoch ms

            $table->unique(['user_id', 'uuid']); // idempotency, per-user scoped
            $table->index(['user_id', 'id']); // the pull cursor's own query shape
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
