<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Build-plan step 23 (M7). The RAW webhook journal.
 *
 * `unique(provider, provider_event_id)` IS edge case #118's duplicate fix, whole.
 * Not "the handler checks first" — a check-then-insert races with itself under
 * concurrent delivery, and Stripe retries aggressively. The database refuses the
 * second row; the handler reads the refusal as `ignored_duplicate`.
 *
 * INSERT FIRST, THEN PROCESS. `processed_at` is null between the two, so a crash
 * mid-handler leaves a replayable row rather than a silently-lost event. That is
 * the same commit-before-paint discipline INVARIANTS.md #2 requires of taps,
 * applied to money.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('billing_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider');
            $table->string('provider_event_id');
            $table->string('type');

            // The verified payload, stored verbatim. Never re-serialised into a
            // "cleaner" shape — forensics need what the provider actually sent.
            $table->json('payload');

            // The provider's own `created` timestamp (epoch ms), which is what
            // ordering precedence compares. Our `received_at` is arrival order and
            // is NOT authoritative for ordering — that conflation is #118 itself.
            $table->unsignedBigInteger('provider_created_at')->nullable();
            $table->unsignedBigInteger('received_at');
            $table->unsignedBigInteger('processed_at')->nullable();

            // applied | ignored_duplicate | ignored_stale | ignored_unhandled | error
            $table->string('outcome')->nullable();
            $table->text('error')->nullable();

            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->timestamps();

            // #118, the whole fix.
            $table->unique(['provider', 'provider_event_id']);
            $table->index('processed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_events');
    }
};
