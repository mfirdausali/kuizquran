<?php

namespace App\Http\Controllers\Admin;

use App\Billing\EntitlementMachine;
use App\Billing\EntitlementState;
use App\Billing\EntitlementTier;
use App\Http\Controllers\Controller;
use App\Models\Entitlement;
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
 * `override()` IS THE ONE WRITE ROUTE HERE (v3-D147). Every other action stays
 * read-only by construction — no route is registered for anything but GET and
 * this one POST. `EntitlementMachine::CAUSE_ADMIN_OVERRIDE` existed since the
 * state machine shipped with no caller anywhere in `app/`; this is that caller,
 * routed through the SAME guarded `apply()` every webhook uses — never a raw
 * `Entitlement::update()`, which would both bypass the optimistic lock and
 * leave no transition row behind.
 *
 * BOTH IDENTITIES ARE PSEUDONYMIZED ON THE WAY OUT.
 *  - `user_id` (the learner whose entitlement changed) is a raw FK, never
 *    pseudonymized at write time (unlike `admin_audit.subject_pseudonym`) —
 *    this is the first surface that ever reads it back to a human, so it must
 *    pseudonymize here or be the one billing screen that deanonymizes a
 *    learner to every admin who can load it.
 *  - `actor` is documented ("'system' or an admin user id. Never a learner.").
 *    `override()` below is the first call site to ever pass the calling
 *    admin's own id rather than the literal string 'system'. A non-numeric
 *    actor renders verbatim; a numeric one is pseudonymized rather than
 *    leaked, the same rule `AdminAuditController` applies to its own actor
 *    column.
 */
class AdminBillingController extends Controller
{
    public function __construct(
        private readonly Pseudonymizer $pseudonymizer,
        private readonly EntitlementMachine $machine,
    ) {}

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
     * ADMIN OVERRIDE — a support admin manually correcting a learner's billing
     * state (a missed webhook, a goodwill refund, a manual grant). Scoped
     * narrowly to the two fields a support action actually needs: `state` and
     * `tier`. Nothing here lets an admin fabricate `provider`/
     * `provider_subscription_id` (that would forge a real payment
     * relationship) or backdate `current_period_end`/`grace_until`.
     *
     * REQUIRES AN EXISTING ENTITLEMENT ROW. A learner with none has never
     * started a trial or been billed — provisioning that row is the
     * (separate, unbuilt) checkout flow's job, not this action's.
     */
    public function override(Request $request, int $userId): JsonResponse
    {
        $reason = trim((string) $request->input('reason', ''));
        if (mb_strlen($reason) < 10) {
            return response()->json(['error' => 'reason must be at least 10 characters'], 422);
        }

        $changes = [];

        if ($request->has('state')) {
            $state = EntitlementState::tryFrom((string) $request->input('state'));
            if (! $state) {
                return response()->json([
                    'error' => 'state must be one of: '.implode(', ', array_column(EntitlementState::cases(), 'value')),
                ], 422);
            }
            $changes['state'] = $state;
        }

        if ($request->has('tier')) {
            $tier = EntitlementTier::tryFrom((string) $request->input('tier'));
            if (! $tier) {
                return response()->json([
                    'error' => 'tier must be one of: '.implode(', ', array_column(EntitlementTier::cases(), 'value')),
                ], 422);
            }
            $changes['tier'] = $tier;
        }

        if ($changes === []) {
            return response()->json(['error' => 'at least one of state or tier is required'], 422);
        }

        $entitlement = Entitlement::where('user_id', $userId)->first();
        if (! $entitlement) {
            return response()->json(['error' => 'no entitlement row for this learner — nothing to override'], 404);
        }

        $nowMs = (int) round(microtime(true) * 1000);
        $result = $this->machine->apply(
            $entitlement,
            $changes,
            EntitlementMachine::CAUSE_ADMIN_OVERRIDE,
            $nowMs,
            null,
            (string) $request->user()->id,
            $reason,
        );

        if (! $result->wasApplied()) {
            return response()->json([
                'error' => 'version conflict — the entitlement changed underneath you. Re-read and retry.',
            ], 409);
        }

        $fresh = $entitlement->fresh();

        return response()->json([
            'applied' => true,
            'state' => $fresh->state->value,
            'tier' => $fresh->tier->value,
        ]);
    }

    /**
     * 'system' (every non-override call site) renders verbatim. A numeric
     * string — an admin user id, written by `override()` above — is
     * pseudonymized like any other admin identity, never leaked as a raw
     * integer.
     */
    private function renderActor(string $actor): string
    {
        if (! ctype_digit($actor)) {
            return $actor;
        }

        return $this->pseudonymizer->for((int) $actor);
    }
}
