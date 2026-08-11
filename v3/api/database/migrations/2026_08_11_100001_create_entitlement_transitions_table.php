<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Build-plan step 23 (M7). APPEND-ONLY. Every state change writes a row here.
 *
 * This is what makes edge case #114's "data never deleted" AUDITABLE rather than
 * merely asserted — and it is the table the nightly reconcile diffs against the
 * provider. `entitlements` is the derived cache; this is the log.
 *
 * Same shape as the event log (INVARIANTS.md #2): the log is truth, the row is a
 * fold. If `entitlements.state` is ever doubted, it is re-derivable from here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entitlement_transitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Nullable `from_state`: the very first transition has no predecessor.
            $table->string('from_state')->nullable();
            $table->string('to_state');

            // webhook | trial_start | reconcile | admin_override
            $table->string('cause');

            // Set for webhook-caused transitions; lets a transition be traced back
            // to the exact provider event that caused it.
            $table->string('provider_event_id')->nullable();

            // 'system' or an admin user id. Never a learner.
            $table->string('actor')->default('system');

            // Free-text only for admin_override, which requires a reason.
            $table->text('reason')->nullable();

            $table->unsignedBigInteger('at'); // epoch ms
            $table->timestamps();

            $table->index(['user_id', 'at']);
            $table->index('provider_event_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entitlement_transitions');
    }
};
