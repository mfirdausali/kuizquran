<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\NightlyWindowLedger;
use Illuminate\Http\JsonResponse;

/**
 * THE 7-CONSECUTIVE-GREEN-NIGHTS WINDOW VIEWER — the missing read surface
 * for `NightlyWindowLedger::status()`.
 *
 * BUILD-PLAN M10's launch gate ("7-consecutive-green-nights window... both
 * determinism checks green nightly") has been computable since the ledger
 * shipped (`php artisan nightly:window`), but only as a CLI command — no
 * HTTP route, no admin screen. HANDOVER.md's own C5 names the consequence
 * directly: "the 7-night window needs a human checking `nightly:window`
 * daily" over SSH, and H5 flags that nobody is paged on a P1 either — a
 * human watching this number by hand is the ENTIRE safety net for the gate
 * that blocks public launch. `NightlyCheckRun`/`NightlyWindow` had a nightly
 * writer (`DeterminismCheckCommand`, `NightlyWindowCommand --start`) and
 * zero admin-facing readers — the same "built + populated + zero read
 * surface" shape v3-D129/D130/D141/D142 each closed for
 * `admin_audit`/`flag_ramp_audit`/`entitlement_transitions`/`purge_ledger`.
 *
 * A THIN, UNTRANSFORMED PASS-THROUGH. `NightlyWindowLedger::status()` is
 * already the one place the streak arithmetic lives (edge case #169); this
 * controller adds no second implementation of it, exactly the same
 * discipline `ContentFreezeController` follows for the freeze gate.
 *
 * READ-ONLY BY CONSTRUCTION. No route is registered for anything but GET —
 * this screen may never declare or reset the window; that stays
 * `nightly:window --start`, a deliberate human CLI action per BUILD-PLAN's
 * own "starts only after the last engine/selection merge." A route that let
 * this screen flip the window start would let staff self-serve past the one
 * check BUILD-PLAN insists a human make.
 *
 * No pseudonymization anywhere: this table carries no learner identity at
 * all, only check names, severities and calendar dates.
 */
class NightlyWindowController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(NightlyWindowLedger::status());
    }
}
