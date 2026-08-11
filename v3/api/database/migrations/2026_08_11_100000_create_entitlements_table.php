<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Build-plan step 23 (M7). The DERIVED current entitlement, one row per user.
 *
 * This table is NEVER the source of truth for history — `entitlement_transitions`
 * is. This row is a cache of "where is this user now", exactly as `atom_cache` is
 * a cache of the event fold (INVARIANTS.md #2's shape, applied to billing).
 *
 * ALL FOUR STATES SHIP IN THE ENUM FROM THIS FIRST MIGRATION, even though
 * `grace` and `lapsed_review_only` are unreachable until the webhook handlers
 * land. Two reasons, both learned the hard way elsewhere:
 *   1. Adding an enum value to Postgres later is a migration that LOCKS the table.
 *   2. A state machine missing a state gets CODED AROUND — which is precisely how
 *      edge case #114 (lifetime refund after months) turns into data-hostage: with
 *      no `lapsed_review_only` to move to, a refund handler "temporarily" deletes
 *      or hard-stops, and that becomes permanent.
 *
 * v3-D16 / v3-D54: `lapsed_review_only` is terminal-but-REVERSIBLE and INDEFINITE.
 * There is deliberately NO `lapsed_until`, NO `purge_after`, NO expiry column of
 * any kind on this table. A future "cleanup" job has nothing here to key off,
 * which is the point.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entitlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();

            // The four states. Enum values are asserted by a test that reads the
            // schema, so deleting one here goes RED at migrate time.
            $table->string('state')->default('trial');

            // Tier is ORTHOGONAL to state — edge case #113's `max(tier)` merge
            // needs tier separable from state, or an anonymous lifetime buyer
            // adopting an account in `trial` loses the lifetime purchase.
            $table->string('tier')->default('none');

            // v3-D07 + edge case #119: account-stored, editable, never per-session.
            // IP only sets the DEFAULT. Travelling must never reprice anyone.
            $table->string('region')->default('INTL');

            // Edge case #121/#122: the "flagged field". `trial_surah_source`
            // distinguishing chosen-vs-demo must be a COLUMN, not an inference —
            // an inference gets re-derived differently by the next reader.
            $table->unsignedSmallInteger('trial_surah')->nullable();
            $table->string('trial_surah_source')->nullable(); // chosen | onboarding_demo

            // Epoch ms throughout, matching the event log's `ts` convention.
            $table->unsignedBigInteger('trial_started_at')->nullable();
            $table->unsignedBigInteger('current_period_end')->nullable();
            $table->unsignedBigInteger('grace_until')->nullable();

            // Rail-agnostic (edge case #120: FPX cannot recur, so the rail varies
            // per purchase while entitlements must not care).
            $table->string('provider')->nullable();
            $table->string('provider_customer_id')->nullable();
            $table->string('provider_subscription_id')->nullable();

            // Edge case #118: the optimistic-lock target for guarded transitions.
            // Every ramp-style write predicates on this; KILL-style writes (there
            // are none on this table, but the flag plane has them) do not.
            $table->unsignedBigInteger('state_version')->default(0);

            // Edge case #118's ordering half: a webhook older than the last one
            // applied is IGNORED, never applied. Version alone cannot decide this
            // — two out-of-order events both see the same version.
            $table->unsignedBigInteger('last_provider_event_at')->nullable();

            $table->timestamps();

            $table->index('state');
            $table->index('provider_customer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entitlements');
    }
};
