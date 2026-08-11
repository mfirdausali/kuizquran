<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The single row (id = 1) holding when the 7-consecutive-green-nights window
 * is allowed to start counting from.
 *
 * BUILD-PLAN.md: the window "starts only after the last engine/selection
 * merge". That is a fact no check can derive for itself — the runner has no
 * idea whether the engine was merged yesterday. So it is stamped, by
 * `nightly:window --start`, and every night strictly before it is excluded
 * from the streak however green it was.
 *
 * Without this, the streak would count seven nights that all predate the
 * engine change they were supposed to validate — the single most likely way
 * this gate gets accidentally "passed".
 */
class NightlyWindow extends Model
{
    public $timestamps = false;

    protected $table = 'nightly_window';

    protected $fillable = ['window_started_at', 'reason', 'updated_at_ms'];

    /** The singleton row, created empty on first read. An absent window
     *  start means "no window has been declared" — which the ledger reports
     *  as a streak of 0 with an explicit reason, never as "7 nights of
     *  nothing". */
    public static function current(): self
    {
        return self::firstOrCreate(['id' => 1], [
            'window_started_at' => null,
            'reason' => null,
            'updated_at_ms' => null,
        ]);
    }
}
