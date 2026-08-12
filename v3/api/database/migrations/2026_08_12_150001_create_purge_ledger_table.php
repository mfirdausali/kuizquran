<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Build-plan step 23 (M7) / LAUNCH-CHECKLIST.md gate 19 & 13.
 *
 * The PERMANENT, APPEND-ONLY record that a user was purged. This is the exact
 * mechanism `BackupRestoreDrillCommand` already exercises against its own
 * throwaway ledger file — "a purge ledger that survives the restore and is
 * re-applied to the restored data" — now backed by a real table so a
 * production restore has something durable to reconcile against.
 *
 * `user_id` is deliberately NOT a foreign key: by the time this row is
 * written, the user row it describes has already been (or is about to be)
 * deleted. A constrained column pointing at a row guaranteed not to exist
 * would either block the insert or force an ordering hack; a plain integer
 * says exactly what is true — "this id used to be a user".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purge_ledger', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('purged_at_ms');
            $table->string('reason');
            $table->timestamps();

            $table->index('user_id');
            $table->index('purged_at_ms');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purge_ledger');
    }
};
