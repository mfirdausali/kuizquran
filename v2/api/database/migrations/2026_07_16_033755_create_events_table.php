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
        // v2-D18/ROADMAP Phase 5: reproduces v1's D1 `events` schema (append-only,
        // PK = client-generated uuid = idempotency key) plus the v2 Phase 1-4 fields
        // (reconstruct_tap/ayah_produced/gate_demote/test_*). No free text: `choice`
        // is always an Arabic surface form or gloss string from the fixed corpus.
        Schema::create('events', function (Blueprint $table) {
            $table->string('id')->primary(); // client uuid, idempotency key
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->unsignedBigInteger('ts'); // client-stamped epoch ms
            $table->unsignedSmallInteger('surah')->nullable();
            $table->unsignedSmallInteger('ayah')->nullable();
            $table->string('rung')->nullable();
            $table->unsignedSmallInteger('position')->nullable();
            $table->string('choice')->nullable();
            $table->boolean('correct')->nullable();
            $table->boolean('pretest')->nullable();
            $table->unsignedSmallInteger('to_ayah')->nullable(); // n+1, DrillEvent.to
            $table->string('step_kind')->nullable(); // 'ayah' | 'junction'
            $table->boolean('structured')->nullable(); // NULL = legacy default (true)
            $table->unsignedInteger('latency')->nullable();
            $table->string('resume')->nullable();
            $table->string('test_kind')->nullable();
            $table->float('score')->nullable();
            $table->unsignedSmallInteger('total')->nullable();
            $table->boolean('sent_to_reviews')->nullable();
            $table->unsignedBigInteger('received_at'); // server-stamped epoch ms

            $table->index(['user_id', 'ts']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
