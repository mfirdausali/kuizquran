<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * v3-D218: `resumeMassed` (`packages/engine/src/resume.ts#ResumeDecision.
     * massed`) has been computed by `resumePolicy()` on every interruption
     * classification since FR5 landed, but its sibling `resume` field —
     * which already has a real column — was the only one `acknowledgeReentry`
     * ever stamped onto a real `interruption` event. Additive, same
     * discipline as every other post-freeze field addition (corpusHash,
     * gradeClass, awayDayIndex/away).
     */
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->boolean('resume_massed')->nullable()->after('resume');
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('resume_massed');
        });
    }
};
