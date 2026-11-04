<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Build-plan step 14. Append-only — nothing in `app/` ever UPDATEs or
 * DELETEs a row here (WIREFRAME.md §16: "the Events tab is read-only").
 * `id` is the server ingest-sequence (the pull cursor); `uuid` is the
 * client-stamped idempotency key, unique per user.
 *
 * `events.user_id` is `cascadeOnDelete()` — `PurgeDueAccountsCommand`'s
 * `$user->delete()` (PDPA purge) cascades to remove a purged user's rows
 * here. v3-D373 flagged this table (alongside `EntitlementTransition`) as
 * a case where an ORM `booted()` guard, copied verbatim from
 * `AdminAudit`/`AyahVerification`, would supposedly THROW during every PDPA
 * purge. **That was checked empirically and is wrong**: a database-level
 * `ON DELETE CASCADE` is executed entirely inside the database engine in
 * response to the single `DELETE FROM users WHERE id = ?` statement — it
 * never re-enters Eloquent, so `Event`'s own `deleting` model event is never
 * dispatched for the cascaded rows. Proven directly: with a temporary
 * `deleting` guard that unconditionally threw, added ONLY to verify this,
 * `AccountDeletionTest::test_purge_due_hard_deletes_an_elapsed_request_and_leaves_a_ledger_row`
 * (whose own assertion requires the cascade to actually happen —
 * `assertSame(0, Event::where('user_id', $doomed->id)->count())`) still
 * PASSED unchanged; the guard never fired. See DECISIONS.md v3-D374.
 *
 * TWO LAYERS, same reasoning as `AdminAudit`/`PurgeLedgerEntry`/
 * `AyahVerification`/its review-history sibling table/`Override`/`NightlyCheckRun`
 * (`docs/ADMIN-CONSOLE.md` §1g):
 *
 *  1. DATABASE PERMISSION (production): the app's Postgres role is granted
 *     INSERT and SELECT on this table and NOT update/delete — a `REVOKE`
 *     does not block a same-transaction `ON DELETE CASCADE` fired by the
 *     database itself, only an explicit UPDATE/DELETE statement against
 *     this table issued by the app's own role.
 *  2. THE ORM GUARD BELOW: `updating`/`deleting` hooks throw, giving a clear
 *     error in development and in SQLite tests where per-table grants do
 *     not exist, for any DIRECT call this app's own code might make.
 */
class Event extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'uuid', 'type', 'ts',
        'surah', 'ayah', 'rung', 'position', 'choice', 'correct', 'pretest',
        'to_ayah', 'step_kind', 'structured', 'latency', 'resume', 'resume_massed', 'test_kind',
        'score', 'total', 'sent_to_reviews',
        'site_key', 'visit_ordinal', 'device_id', 'device_seq', 'tz',
        'corpus_hash', 'locale', 'spec_snapshot', 'grade_class',
        'away_day_index', 'away',
        'received_at',
    ];

    protected function casts(): array
    {
        return [
            'correct' => 'boolean',
            'pretest' => 'boolean',
            'structured' => 'boolean',
            'sent_to_reviews' => 'boolean',
            'spec_snapshot' => 'array',
            'away' => 'boolean',
            'resume_massed' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (self $row) {
            throw new \RuntimeException(
                'events is APPEND-ONLY. An event row may never be updated — '.
                'invariant #2 (the append-only event log is truth) depends on it.',
            );
        });

        static::deleting(function (self $row) {
            throw new \RuntimeException(
                'events is APPEND-ONLY. An event row may never be deleted directly. '.
                '(A PDPA purge removes a user\'s events via the database\'s own '.
                'ON DELETE CASCADE on events.user_id, which never reaches this guard '.
                '— see this class\'s docblock and DECISIONS.md v3-D374.)',
            );
        });
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
