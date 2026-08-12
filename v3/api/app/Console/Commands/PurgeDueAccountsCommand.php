<?php

namespace App\Console\Commands;

use App\Models\AccountDeletionRequest;
use App\Models\PurgeLedgerEntry;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Build-plan step 23 (M7): the PURGE half of "PDPA export/delete/restore
 * (-with-token) + purge cascades" — LAUNCH-CHECKLIST.md gate 19.
 *
 * `AccountController::requestDeletion()` only ever SCHEDULES a purge. This
 * command is the only code path in the whole app that actually removes a
 * user row for PDPA reasons. It runs nightly (routes/console.php) and is
 * safe to run by hand or twice in a row — a request already purged or
 * restored simply is not found by the `purge_at_ms <= now` query, since
 * `restoreDeletion()` deletes the row and a purge deletes the user (which
 * cascades the request row with it).
 *
 * ORDER MATTERS: the `purge_ledger` row is written INSIDE the same
 * transaction as the user delete, and the ledger write happens FIRST —
 * mirroring `AdminRevealController`'s "audit before the action can be
 * observed" discipline. A crash between the two would either lose no record
 * (ledger written, delete about to commit — the whole transaction rolls
 * back) or never reach here at all; there is no window where a user is gone
 * and the ledger does not know it.
 */
class PurgeDueAccountsCommand extends Command
{
    protected $signature = 'pdpa:purge-due';

    protected $description = 'Hard-delete every account whose PDPA deletion grace period has elapsed (M7, LAUNCH-CHECKLIST gate 19)';

    public function handle(): int
    {
        $nowMs = (int) round(microtime(true) * 1000);
        $due = AccountDeletionRequest::where('purge_at_ms', '<=', $nowMs)->get();

        if ($due->isEmpty()) {
            $this->line('pdpa:purge-due — nothing due');

            return self::SUCCESS;
        }

        $purged = 0;
        $skipped = 0;

        foreach ($due as $request) {
            $userId = $request->user_id;
            $user = User::find($userId);

            if (! $user) {
                // The user is already gone by some other path (or the
                // request row survived a purge that raced it) — the
                // request itself is stale. Drop it so it does not retry
                // forever, but do not fabricate a ledger row for a purge
                // this command did not perform.
                $request->delete();
                $skipped++;

                continue;
            }

            try {
                DB::transaction(function () use ($user, $userId, $nowMs) {
                    PurgeLedgerEntry::create([
                        'user_id' => $userId,
                        'purged_at_ms' => $nowMs,
                        'reason' => 'pdpa_delete',
                    ]);

                    // Sanctum tokens are polymorphic (tokenable_type/id),
                    // not a real foreign key — cascadeOnDelete on `users`
                    // cannot reach them, so they are removed explicitly.
                    $user->tokens()->delete();

                    // Cascades: events, entitlements, entitlement_transitions,
                    // admin_reveal_tokens (both admin_id and subject_user_id),
                    // account_deletion_requests. Nulls: billing_events.user_id,
                    // overrides.editor_id. Blocks (by design — see
                    // AccountController::requestDeletion): admin_audit.
                    // actor_admin_id, which is why an admin can never reach
                    // this command with a pending request in the first place.
                    $user->delete();
                });
                $purged++;
            } catch (\Throwable $e) {
                // A restrictOnDelete violation (an admin role granted AFTER
                // the request was created) or any other failure must not
                // silently drop the request — it stays pending and this
                // command reports it loudly for a human to resolve, rather
                // than retrying forever with no visibility.
                $this->error("pdpa:purge-due — user {$userId} FAILED to purge: ".$e->getMessage());
                $skipped++;
            }
        }

        $this->line("pdpa:purge-due — purged {$purged}, skipped {$skipped}");

        return $skipped > 0 && $purged === 0 ? self::FAILURE : self::SUCCESS;
    }
}
