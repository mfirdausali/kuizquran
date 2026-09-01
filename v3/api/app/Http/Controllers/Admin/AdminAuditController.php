<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Build-plan step 24 (M8). THE AUDIT VIEWER — the read half of `AdminAudit`.
 *
 * `admin_audit` is written by four call sites (`AdminRevealController::reveal`,
 * `AdminUsersController::exportCsv`, `SystemHealthController::rebuildAtomCache`,
 * `StripeSettingsController::test`) and, before this controller, read by none
 * — the same "built + populated + zero read surface" shape as `FlagRampAudit`
 * (still open — a separate, smaller finding, not fixed here), but on the trail
 * BUILD-PLAN M8 itself names as a deliverable: "nav homes for
 * flags/reports/templates/audit viewer." An operator reviewing "who revealed
 * identity X, and why" had a database console and nothing else — the
 * append-only guarantee `AdminAudit::booted()` enforces was unverifiable by
 * any human without one.
 *
 * READ-ONLY BY CONSTRUCTION. No route is registered for anything but GET —
 * an audit viewer that could also write would not be a viewer.
 *
 * THE ACTOR IS PSEUDONYMIZED TOO. `subject_pseudonym` is already pseudonymized
 * at write time (the learner being looked up); `actor_admin_id` is a raw FK to
 * `users`. Returning it verbatim would make this the ONE screen that
 * deanonymizes an admin's own identity to every other admin who can load it —
 * the same HMAC `Pseudonymizer` every other admin surface uses is applied on
 * the way out, so an admin is exactly as pseudonymous to their peers as a
 * learner is.
 *
 * `ip`/`request_id` ARE ON THE WIRE (v3-D164). All four writers stamp `ip` on
 * every row (three of four also stamp `request_id`), but until this fix the
 * map below silently dropped both before the response left the server — the
 * forensic detail an operator would need to corroborate "who did this, from
 * where" against a server access log never reached `AuditLogPanel.tsx`, which
 * had nothing to render even in principle. Neither is PII on the scale
 * `subject_pseudonym`'s own migration comment guards against (an admin's own
 * IP, not a learner's identity), so both pass through unpseudonymized, same
 * as `action`/`reasonCode`/`reasonText`.
 */
class AdminAuditController extends Controller
{
    public function __construct(private readonly Pseudonymizer $pseudonymizer) {}

    /** A hard cap, not a "page 1 of N" pagination UI — this is a recent-activity
     *  review surface, not a full-table browser (mirrors AdminUsersController's
     *  own "no browse-all-learners picker" scope discipline). */
    private const MAX_ENTRIES = 200;

    public function index(Request $request): JsonResponse
    {
        $query = AdminAudit::query()->orderByDesc('at')->orderByDesc('id');

        $subject = trim((string) $request->input('subject', ''));
        if ($subject !== '') {
            $query->where('subject_pseudonym', $subject);
        }

        $rows = $query->limit(self::MAX_ENTRIES)->get();

        return response()->json([
            'entries' => $rows->map(fn (AdminAudit $row) => [
                'actor' => $this->pseudonymizer->for($row->actor_admin_id),
                'action' => $row->action,
                'subjectPseudonym' => $row->subject_pseudonym,
                'reasonCode' => $row->reason_code,
                'reasonText' => $row->reason_text,
                'at' => $row->at,
                'ip' => $row->ip,
                'requestId' => $row->request_id,
            ])->values(),
            'limit' => self::MAX_ENTRIES,
        ]);
    }
}
