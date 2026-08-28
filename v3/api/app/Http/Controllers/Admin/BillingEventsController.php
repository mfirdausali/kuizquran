<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BillingEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * THE RAW WEBHOOK JOURNAL VIEWER — the read half of `billing_events`.
 *
 * `billing_events` is the forensic journal `App\Billing\WebhookHandler::ingest()`
 * writes on EVERY inbound Stripe delivery (`insertOrIgnore` first, then an
 * `outcome`/`error` update — see the migration's own header: "INSERT FIRST,
 * THEN PROCESS... a crash mid-handler leaves a replayable row rather than a
 * silently-lost event"). `App\Models\BillingEvent` has existed, fully cast,
 * with a `user()` relation, since build-plan step 23 — and until now nothing
 * anywhere read it back. `grep -rln "BillingEvent::" app/Http` returned
 * nothing: `AdminBillingController::index()` reads `entitlement_transitions`
 * (the DERIVED state-change log), never this table (the RAW delivery log) —
 * a different table sitting right next to it that the same v3-D141/D147 work
 * never touched. The same "written, populated, zero read surface" shape this
 * build has closed four times before (`admin_audit` v3-D129, `flag_ramp_audit`
 * v3-D130, `entitlement_transitions` v3-D141, `purge_ledger` v3-D142) —
 * missed here because those four fixes each looked at the table their own
 * ticket named, never at what else lived beside it.
 *
 * WHY THIS MATTERS DIFFERENTLY FROM THE DERIVED LOG: `entitlement_transitions`
 * only gains a row when a webhook actually CHANGES state. A webhook that
 * arrives, fails to parse, hits an unhandled type, or throws mid-`process()`
 * leaves NOTHING in that table — but a row here, with `outcome: "error"` and
 * the real exception message, or `outcome: "ignored_unhandled"`. An operator
 * debugging "Stripe says it sent event evt_xxx, why didn't anything happen"
 * had a database console and nothing else; the billing audit screen (reading
 * only the derived log) could not answer that question even in principle.
 *
 * READ-ONLY BY CONSTRUCTION. No route is registered for anything but GET —
 * this journal is written exclusively by `WebhookHandler::ingest()`, never by
 * an admin action.
 *
 * THE RAW `payload` COLUMN IS DELIBERATELY NEVER RETURNED. It is the verified
 * Stripe event verbatim (the migration's own words: "forensics need what the
 * provider actually sent") and can carry a customer's email or billing
 * address — this screen answers "did it arrive, what type, did it apply, what
 * broke", not "show me the whole payload". A future, narrower single-event
 * detail view is a legitimate follow-up; this index stays a summary list, the
 * same scope discipline `AdminAuditController`/`FlagAuditController`/
 * `PurgeLedgerController` already apply to their own recent-activity views.
 *
 * `user_id` IS PSEUDONYMIZED ON THE WAY OUT, same rule as every other admin
 * audit surface — it is a raw, nullable FK at write time (null until
 * `resolveEntitlement()` identifies the learner, and permanently null for a
 * delivery that never resolves to one, e.g. `ignored_unhandled`), and this is
 * the first surface that ever renders it to a human.
 */
class BillingEventsController extends Controller
{
    public function __construct(private readonly Pseudonymizer $pseudonymizer) {}

    /** A hard cap, not a "page 1 of N" pagination UI — mirrors every other
     *  admin audit viewer's recent-activity-review scope discipline. */
    private const MAX_ENTRIES = 200;

    public function index(Request $request): JsonResponse
    {
        $query = BillingEvent::query()->orderByDesc('received_at')->orderByDesc('id');

        $userId = $request->input('userId');
        if ($userId !== null && $userId !== '' && ctype_digit((string) $userId)) {
            $query->where('user_id', (int) $userId);
        }

        $outcome = $request->input('outcome');
        if (is_string($outcome) && $outcome !== '') {
            $query->where('outcome', $outcome);
        }

        $rows = $query->limit(self::MAX_ENTRIES)->get();

        return response()->json([
            'entries' => $rows->map(fn (BillingEvent $row) => [
                'provider' => $row->provider,
                'providerEventId' => $row->provider_event_id,
                'type' => $row->type,
                'outcome' => $row->outcome,
                'error' => $row->error,
                'subjectPseudonym' => $row->user_id !== null ? $this->pseudonymizer->for($row->user_id) : null,
                'providerCreatedAt' => $row->provider_created_at,
                'receivedAt' => $row->received_at,
                'processedAt' => $row->processed_at,
            ])->values(),
            'limit' => self::MAX_ENTRIES,
        ]);
    }
}
