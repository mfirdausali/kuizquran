<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * BUILD-PLAN step 30 / M10: "**7-consecutive-green-nights** window
     * starting after the last engine/selection merge (P1 resets it, WARN
     * does not)".
     *
     * ═══════════════════════════════════════════════════════════════════════
     * WHY A LEDGER TABLE AND NOT A COUNTER
     * ═══════════════════════════════════════════════════════════════════════
     * The obvious implementation is an integer that increments each green
     * night and resets to zero on a P1. It is also unauditable. When the
     * counter reads 6 on launch eve, nobody can answer "which six nights,
     * and what did each of them actually compare?" — and edge case #169
     * ("7-green-nights arithmetic → contested gate") is exactly the argument
     * that follows.
     *
     * So the ledger stores one immutable row PER RUN, and the streak is
     * DERIVED by replaying those rows. The streak becomes a countable fact
     * with evidence attached, rather than a number somebody has to trust.
     * `nightly_check_runs` is append-only in the same spirit as `events`
     * (invariant #2: the log is the truth, the aggregate is rebuildable).
     *
     * ── COLUMNS THAT CARRY THE TAXONOMY ──
     * `severity` is the runner's own verdict — 'green'|'warn'|'p1'|'error',
     * decoded from its EXIT CODE (worker/fold-runner/src/severity.ts), never
     * parsed out of a log line. `exit_code` is stored ALONGSIDE it so the
     * decode is auditable after the fact: if a future refactor ever changes
     * the mapping, the raw evidence is still on the row.
     *
     * `report` is the runner's full JSON verdict — the evidence. It answers
     * "what did that night actually compare?" (users, atoms, traces, seeds)
     * without which a green row means nothing.
     *
     * `night` is the check's own calendar date (UTC). One green row per
     * (check, night) counts once — two runs in one night do not buy two
     * nights, and a re-run after a fix does not launder a P1 that already
     * landed. The unique index is not on (check, night) though: a night may
     * legitimately hold a P1 AND a later re-run, and BOTH must stay on the
     * record. The streak logic reads them in order.
     *
     * `window_started_at` on `nightly_window` is BUILD-PLAN's "starts only
     * after the last engine/selection merge" — a human (or a merge hook)
     * stamps it, and nights before it are excluded from the streak however
     * green they were. Without this column the streak would happily count
     * seven nights that all predate the engine change they were supposed to
     * be validating.
     */
    public function up(): void
    {
        Schema::create('nightly_check_runs', function (Blueprint $table) {
            $table->id();
            // 'fold_determinism_check' | 'selection_determinism_check' —
            // the same names SystemHealthController::METRICS uses.
            $table->string('check');
            // UTC calendar date of the run, 'YYYY-MM-DD'.
            $table->string('night', 10);
            // 'green' | 'warn' | 'p1' | 'error'
            $table->string('severity', 8);
            // The runner's process exit code — the raw evidence behind
            // `severity`, kept so the decode stays auditable.
            $table->integer('exit_code');
            // Full runner JSON report: what was compared, and any findings.
            $table->json('report')->nullable();
            // How the run was triggered: 'schedule' | 'manual' | 'ci'.
            $table->string('trigger', 16)->default('schedule');
            $table->unsignedBigInteger('ran_at'); // server epoch ms

            $table->index(['check', 'night']);
            $table->index(['night']);
        });

        // Exactly one row (id = 1). A table rather than a config value
        // because the window start is operational state that changes on
        // merges and resets, and must be visible in the same place the
        // evidence is.
        Schema::create('nightly_window', function (Blueprint $table) {
            $table->id();
            // UTC date ('YYYY-MM-DD') the window may begin counting from.
            // Nights strictly before this never count.
            $table->string('window_started_at', 10)->nullable();
            // Why it was (re)started — 'engine merge <sha>', 'P1 reset', etc.
            $table->string('reason')->nullable();
            $table->unsignedBigInteger('updated_at_ms')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nightly_check_runs');
        Schema::dropIfExists('nightly_window');
    }
};
