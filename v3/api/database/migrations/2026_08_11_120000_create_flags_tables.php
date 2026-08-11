<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Build-plan step 26 (M8). THE FLAG PLANE — all flags OFF.
 *
 * "must exist before any social code ever ships; social itself is post-launch."
 * That ordering is the whole point of this step preceding M11.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flags', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();

            // DEFAULT FALSE, always. `FlagRegistryTest` iterates the WHOLE registry
            // and asserts every value is false in a clean environment — not a
            // spot-check of remembered flags, which survives a fourth flag being
            // added enabled.
            $table->boolean('enabled')->default(false);

            // Edge case #126: the ramp path predicates on this; the KILL path does
            // NOT. They are different code paths, not one writer with a parameter.
            $table->unsignedBigInteger('version')->default(0);

            $table->unsignedBigInteger('killed_at')->nullable();
            $table->string('killed_by')->nullable();

            // v3-D17 / edge case #159: after a kill the banner PERSISTS until an
            // explicit new ramp with full ceremony. An ack NEVER re-enables.
            $table->unsignedBigInteger('ack_at')->nullable();
            $table->string('ack_by')->nullable();
            $table->boolean('ack_auto_waived')->default(false);

            $table->text('description')->nullable();
            $table->timestamps();
        });

        /*
         * The ramp audit. The enable-hard ceremony's four inputs are STORED, not
         * merely validated — "we checked at the time" is unverifiable later.
         */
        Schema::create('flag_ramp_audit', function (Blueprint $table) {
            $table->id();
            $table->string('flag_key');
            $table->string('action'); // enable | kill | ack | auto_waive
            $table->foreignId('actor_admin_id')->nullable()->constrained('users')->nullOnDelete();

            $table->text('reason')->nullable();               // >= 20 chars for enable
            $table->boolean('acknowledges_retention_risk')->default(false);
            $table->boolean('acknowledges_no_dark_pattern')->default(false);
            $table->string('typed_flag_name')->nullable();    // must match VERBATIM

            $table->unsignedBigInteger('at');
            $table->timestamps();

            $table->index(['flag_key', 'at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flag_ramp_audit');
        Schema::dropIfExists('flags');
    }
};
