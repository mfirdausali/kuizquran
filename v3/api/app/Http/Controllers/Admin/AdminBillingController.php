<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EntitlementTransition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * BUILD-PLAN M7's own named deliverable: "admin billing surface." THE READ HALF
 * of `entitlement_transitions` — `tests/Feature/Boundaries/EntitlementBoundaryTest.php`
 * has reserved this exact file on its entitlement-read allowlist since that test
 * was written, with no caller ever created for it.
 *
 * `entitlement_transitions` is written by every `App\Billing\EntitlementMachine
 * ::apply()` call (webhook, trial start, reconcile, admin override) and read by
 * nothing else anywhere in `app/` — the same "built + populated + zero read
 * surface" shape as `AdminAudit`/`FlagRampAudit` (v3-D129/D130's own fixes,
 * this controller's direct template). An operator asking "why did this
 * learner's tier flip to lapsed_review_only, and when" had a database console
 * and nothing else.
 *
 * READ-ONLY BY CONSTRUCTION. No route is registered for anything but GET.
 *
 * BOTH IDENTITIES ARE PSEUDONYMIZED ON THE WAY OUT.
 *  - `user_id` (the learner whose entitlement changed) is a raw FK, never
 *    pseudonymized at write time (unlike `admin_audit.subject_pseudonym`) —
 *    this is the first surface that ever reads it back to a human, so it must
 *    pseudonymize here or be the one billing screen that deanonymizes a
 *    learner to every admin who can load it.
 *  - `actor` is documented ("'system' or an admin user id. Never a learner.")
 *    but every current call site passes the literal string 'system' —
 *    `CAUSE_ADMIN_OVERRIDE` exists with no caller yet. A non-numeric actor
 *    renders verbatim; a numeric one (an admin id, the day a caller exists)
 *    is pseudonymized rather than leaked, the same rule `AdminAuditController`
 *    applies to its own actor column.
 */
class AdminBillingController extends Controller
{
    public function __construct(private readonly Pseudonymizer $pseudonymizer) {}

    /** A hard cap, not a "page 1 of N" pagination UI — mirrors AdminAuditController's
     *  and FlagAuditController's own recent-activity-review scope discipline. */
    private const MAX_ENTRIES = 200;

    public function index(Request $request): JsonResponse
    {
        $query = EntitlementTransition::query()->orderByDesc('at')->orderByDesc('id');

        $userId = $request->input('userId');
        if ($userId !== null && $userId !== '' && ctype_digit((string) $userId)) {
            $query->where('user_id', (int) $userId);
        }

        $rows = $query->limit(self::MAX_ENTRIES)->get();

        return response()->json([
            'entries' => $rows->map(fn (EntitlementTransition $row) => [
                'subjectPseudonym' => $this->pseudonymizer->for($row->user_id),
                'fromState' => $row->from_state,
                'toState' => $row->to_state,
                'cause' => $row->cause,
                'providerEventId' => $row->provider_event_id,
                'actor' => $this->renderActor($row->actor),
                'reason' => $row->reason,
                'at' => $row->at,
            ])->values(),
            'limit' => self::MAX_ENTRIES,
        ]);
    }

    /**
     * 'system' (every current call site) renders verbatim. A numeric string —
     * an admin user id, per the migration's own documented intent, once
     * `CAUSE_ADMIN_OVERRIDE` gets a real caller — is pseudonymized like any
     * other admin identity, never leaked as a raw integer.
     */
    private function renderActor(string $actor): string
    {
        if (! ctype_digit($actor)) {
            return $actor;
        }

        return $this->pseudonymizer->for((int) $actor);
    }
}
