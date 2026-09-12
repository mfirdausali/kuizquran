<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * WIREFRAME.md §14 "Planned absences" (v3-D207): a genuinely new
     * `DrillEvent` wire field pair added after the v3-D10 freeze — additive,
     * same discipline every other post-freeze field addition already
     * established (corpusHash, gradeClass, ...), here with a real column
     * since it is the first to need one. `away_day_index` is the ABSOLUTE
     * calendar-day index (`@engine/awayDays.ts#dayIndexOf`) being toggled,
     * never an offset; `away` is the toggle itself — a later row for the
     * same day always wins (append-only, never edited in place).
     */
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->unsignedInteger('away_day_index')->nullable()->after('grade_class');
            $table->boolean('away')->nullable()->after('away_day_index');
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['away_day_index', 'away']);
        });
    }
};
