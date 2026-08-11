<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One immutable record of one determinism-check run. Append-only: nothing in
 * `app/` ever UPDATEs or DELETEs a row here, for the same reason the event
 * log is append-only — a streak whose evidence can be edited afterwards is
 * not evidence (edge case #169, "7-green-nights arithmetic → contested
 * gate").
 *
 * A re-run after a fix appends a NEW row; it never overwrites the P1 that
 * preceded it. The streak logic reads both.
 */
class NightlyCheckRun extends Model
{
    public $timestamps = false;

    protected $table = 'nightly_check_runs';

    /** The two checks the 7-night window counts (BUILD-PLAN's "both
     *  determinism checks green nightly"). Both must be green on a night
     *  for that night to count. */
    public const CHECKS = [
        'fold_determinism_check',
        'selection_determinism_check',
    ];

    protected $fillable = [
        'check', 'night', 'severity', 'exit_code', 'report', 'trigger', 'ran_at',
    ];

    protected function casts(): array
    {
        return [
            'report' => 'array',
            'exit_code' => 'integer',
            'ran_at' => 'integer',
        ];
    }
}
