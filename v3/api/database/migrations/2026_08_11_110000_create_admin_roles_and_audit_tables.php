<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Build-plan step 24 (M8). Roles + the APPEND-ONLY audit log.
 *
 * ROLES are the INNER gate. The env allowlist (`ADMIN_EMAILS`) stays the OUTER
 * gate — edge case #146's break-glass is "fix the env var and restart", which
 * works even when the database is the thing that is broken. Roles in a table
 * cannot be the outer gate for that reason.
 */
return new class extends Migration
{
    public function up(): void
    {
        // operator | qari | moderator. A pivot rather than a column, because
        // multi-role is real (the qari who also moderates).
        Schema::create('admin_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role');
            $table->unsignedBigInteger('granted_at');
            $table->string('granted_by')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'role']);
        });

        /*
         * APPEND-ONLY. Enforced by DATABASE PERMISSION in production (the app's
         * role is granted INSERT and SELECT only), never by application
         * discipline — "we just don't call update()" is a convention, and
         * conventions are what this build has watched fail five times.
         *
         * `AppendOnly` (the model trait) blocks UPDATE/DELETE at the ORM level as
         * a second layer, and `AdminAuditTest` asserts BOTH.
         */
        Schema::create('admin_audit', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_admin_id')->constrained('users')->restrictOnDelete();
            $table->string('action');

            // NEVER an email, NEVER a name. Edge case #149: an append-only table
            // containing real PII is UNPURGEABLE — a PDPA delete request could not
            // be honoured without violating the append-only guarantee.
            $table->string('subject_pseudonym')->nullable();

            // Structured, closed set — so audit review can aggregate rather than
            // read prose.
            $table->string('reason_code')->nullable();
            $table->text('reason_text')->nullable();

            $table->unsignedBigInteger('at');
            $table->string('ip')->nullable();
            $table->string('request_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['actor_admin_id', 'at']);
            $table->index('action');
        });

        /*
         * Reveal tokens. Edge case #147: the TTL is SERVER-SIDE. A client-side
         * countdown is a suggestion — the server must refuse a stale token even
         * if the client never re-masks.
         */
        Schema::create('admin_reveal_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('subject_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('token', 64)->unique();
            $table->unsignedBigInteger('expires_at'); // epoch ms, SERVER-set
            $table->unsignedBigInteger('created_at_ms');
            $table->timestamps();

            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_reveal_tokens');
        Schema::dropIfExists('admin_audit');
        Schema::dropIfExists('admin_roles');
    }
};
