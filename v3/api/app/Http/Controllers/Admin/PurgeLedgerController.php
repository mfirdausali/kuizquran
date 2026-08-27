<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PurgeLedgerEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * THE PDPA PURGE LEDGER VIEWER — the read half of `purge_ledger`.
 *
 * `purge_ledger` is written every night by `PurgeDueAccountsCommand` (scheduled
 * 02:00 UTC) whenever an elapsed account-deletion request is hard-purged, and
 * read by exactly one other place in `app/` — `BackupRestoreDrillCommand`,
 * which reconciles a restored dump against it internally. No admin-facing
 * route has ever read it back — the same "built + populated + zero read
 * surface" shape v3-D129/D130/D141 each closed for `admin_audit`/
 * `flag_ramp_audit`/`entitlement_transitions`. `PurgeLedgerEntry`'s own
 * docblock invites the comparison directly: "APPEND-ONLY, same two-layer
 * guarantee as `AdminAudit`." An operator asked "was learner X actually
 * purged, and when" had a database console and nothing else — for the one
 * record whose entire purpose is proving a PDPA delete really happened.
 *
 * READ-ONLY BY CONSTRUCTION. No route is registered for anything but GET.
 *
 * `user_id` IS PSEUDONYMIZED ON THE WAY OUT, same rule as every other admin
 * audit surface — `purge_ledger.user_id` is a raw, unpseudonymized integer at
 * write time (the migration deliberately omits a FK: the user row is already
 * gone by the time this is written), and this is the first surface that ever
 * renders it to a human.
 */
class PurgeLedgerController extends Controller
{
    public function __construct(private readonly Pseudonymizer $pseudonymizer) {}

    /** A hard cap, not a "page 1 of N" pagination UI — mirrors every other
     *  admin audit viewer's recent-activity-review scope discipline. */
    private const MAX_ENTRIES = 200;

    public function index(Request $request): JsonResponse
    {
        $query = PurgeLedgerEntry::query()->orderByDesc('purged_at_ms')->orderByDesc('id');

        $userId = $request->input('userId');
        if ($userId !== null && $userId !== '' && ctype_digit((string) $userId)) {
            $query->where('user_id', (int) $userId);
        }

        $rows = $query->limit(self::MAX_ENTRIES)->get();

        return response()->json([
            'entries' => $rows->map(fn (PurgeLedgerEntry $row) => [
                'subjectPseudonym' => $this->pseudonymizer->for($row->user_id),
                'purgedAtMs' => $row->purged_at_ms,
                'reason' => $row->reason,
            ])->values(),
            'limit' => self::MAX_ENTRIES,
        ]);
    }
}
