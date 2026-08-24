<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FlagRampAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Build-plan step 26 (M8). THE FLAG AUDIT VIEWER — the read half of
 * `FlagRampAudit`.
 *
 * `flag_ramp_audit` is written by three `FlagService` call sites (`kill`,
 * `ramp`, `acknowledgeKill` — including the unattended nightly
 * `autoWaiveDueKills` scheduler) and, before this controller, read by none —
 * the same "built + populated + zero read surface" shape v3-D125 named for
 * this exact table (deferred as "a separate, smaller finding") and v3-D129
 * closed for `AdminAudit`. An operator asking "who killed this flag, and
 * when was it ramped back" had a database console and nothing else — the
 * enable-hard ceremony's four inputs (`FlagRampAudit`'s own docblock: "STORED,
 * not merely validated — 'we checked at the time' is unverifiable after the
 * fact") were unverifiable by anyone without one.
 *
 * READ-ONLY BY CONSTRUCTION. No route is registered for anything but GET.
 *
 * THE ACTOR IS PSEUDONYMIZED TOO, same rule as `AdminAuditController` — an
 * admin's own identity must not deanonymize to their peers. UNLIKE
 * `admin_audit.actor_admin_id` (NOT NULL), `flag_ramp_audit.actor_admin_id`
 * IS NULLABLE: `FlagService::autoWaiveDueKills()` calls `acknowledgeKill`
 * with a null admin id from the unattended scheduler. A null actor renders
 * as `null` — never a crash, and never a fabricated pseudonym for an action
 * no person took.
 */
class FlagAuditController extends Controller
{
    public function __construct(private readonly Pseudonymizer $pseudonymizer) {}

    /** A hard cap, not a "page 1 of N" pagination UI — mirrors
     *  AdminAuditController's own recent-activity-review scope discipline. */
    private const MAX_ENTRIES = 200;

    public function index(Request $request): JsonResponse
    {
        $query = FlagRampAudit::query()->orderByDesc('at')->orderByDesc('id');

        $flagKey = trim((string) $request->input('flag', ''));
        if ($flagKey !== '') {
            $query->where('flag_key', $flagKey);
        }

        $rows = $query->limit(self::MAX_ENTRIES)->get();

        return response()->json([
            'entries' => $rows->map(fn (FlagRampAudit $row) => [
                'flagKey' => $row->flag_key,
                'action' => $row->action,
                'actor' => $row->actor_admin_id === null ? null : $this->pseudonymizer->for($row->actor_admin_id),
                'reason' => $row->reason,
                'acknowledgesRetentionRisk' => (bool) $row->acknowledges_retention_risk,
                'acknowledgesNoDarkPattern' => (bool) $row->acknowledges_no_dark_pattern,
                'typedFlagName' => $row->typed_flag_name,
                'at' => $row->at,
            ])->values(),
            'limit' => self::MAX_ENTRIES,
        ]);
    }
}
