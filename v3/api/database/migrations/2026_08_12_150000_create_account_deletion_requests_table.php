<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Build-plan step 23 (M7): "PDPA export/delete/restore(-with-token) + purge
 * cascades" — LAUNCH-CHECKLIST.md gate 19, previously NOT BUILT ("no purge
 * path anywhere in `api/app`").
 *
 * One row per PENDING deletion. Learner-initiated only (AccountController) —
 * there is no admin-triggered delete, per v3-D16's "charge for access, never
 * for the memory itself" and the wireframe's identical "never a hostage"
 * posture applied to the account itself.
 *
 * `unique(user_id)` is the whole idempotency story: at most one pending
 * request per user, and it doubles as "is a deletion pending" without a
 * status column. A RESTORE (token match) or a PURGE (grace period elapsed)
 * both end by deleting this row — `cascadeOnDelete` also removes it the
 * instant the user row itself is purged, so there is nothing here that
 * outlives the account it describes. The permanent record of a completed
 * purge lives in `purge_ledger`, which deliberately has NO foreign key back
 * to `users` (the user is gone by the time that row is written).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_deletion_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();

            // sha256 hex of the raw token. The raw token is shown to the
            // caller exactly once, at request time, and never stored —
            // same discipline as a password reset token.
            $table->string('token_hash', 64);

            $table->unsignedBigInteger('requested_at_ms');
            $table->unsignedBigInteger('purge_at_ms');
            $table->timestamps();

            $table->index('purge_at_ms');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_deletion_requests');
    }
};
