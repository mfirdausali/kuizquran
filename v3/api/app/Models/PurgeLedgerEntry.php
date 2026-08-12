<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * APPEND-ONLY, same two-layer guarantee as `AdminAudit` (see that model and
 * `docs/ADMIN-CONSOLE.md` §1b): a Postgres-role grant in production
 * (INSERT/SELECT only) plus this ORM guard for development and SQLite tests.
 *
 * This is the row `BackupRestoreDrillCommand` already reconciles against — a
 * dump taken before a purge still contains the purged subject, and reapplying
 * this ledger after a restore is what keeps them from coming back. A ledger
 * entry that could be edited or deleted would make that reconciliation
 * meaningless: the whole point is that "this id was purged, permanently" is
 * itself a fact nobody — including the app that wrote it — can take back.
 */
class PurgeLedgerEntry extends Model
{
    protected $table = 'purge_ledger';

    protected $fillable = ['user_id', 'purged_at_ms', 'reason'];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'purged_at_ms' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (self $row) {
            throw new \RuntimeException(
                'purge_ledger is APPEND-ONLY. A purge record may never be updated — '.
                'a restore reconciles against it, and an editable ledger could resurrect a purged learner.',
            );
        });

        static::deleting(function (self $row) {
            throw new \RuntimeException(
                'purge_ledger is APPEND-ONLY. A purge record may never be deleted.',
            );
        });
    }
}
