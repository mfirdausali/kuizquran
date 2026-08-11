<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * APPEND-ONLY. Build-plan step 24 (M8).
 *
 * TWO LAYERS, because either alone is insufficient:
 *
 *  1. DATABASE PERMISSION (production): the app's Postgres role is granted
 *     INSERT and SELECT on this table and NOT update/delete. This is the real
 *     guarantee — it holds against raw queries, against a future developer, and
 *     against this model being bypassed entirely.
 *     See `docs/ADMIN-CONSOLE.md` for the grant.
 *
 *  2. THE ORM GUARD BELOW: `saving`/`deleting` hooks throw on any attempt to
 *     modify an existing row. This is the layer that gives a clear error in
 *     development and in SQLite tests, where per-table grants do not exist.
 *
 * `AdminAuditTest` asserts layer 2 directly and asserts that layer 1 is
 * DOCUMENTED, because a grant cannot be tested from inside the app that lacks it.
 */
class AdminAudit extends Model
{
    protected $table = 'admin_audit';

    protected $fillable = [
        'actor_admin_id', 'action', 'subject_pseudonym',
        'reason_code', 'reason_text', 'at', 'ip', 'request_id', 'meta',
    ];

    protected function casts(): array
    {
        return ['at' => 'integer', 'meta' => 'array'];
    }

    /** The closed set of reasons (edge case #149: "structured pseudonym reasons"). */
    public const REASON_CODES = [
        'support_ticket',
        'billing_dispute',
        'abuse_report',
        'legal_request',
        'data_subject_request',
    ];

    protected static function booted(): void
    {
        static::updating(function (self $row) {
            throw new \RuntimeException(
                'admin_audit is APPEND-ONLY. An audit row may never be updated — '.
                'an editable audit log is not an audit log.',
            );
        });

        static::deleting(function (self $row) {
            throw new \RuntimeException(
                'admin_audit is APPEND-ONLY. An audit row may never be deleted.',
            );
        });
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_admin_id');
    }

    /**
     * Edge case #149: "free-text scanned/warned".
     *
     * An append-only table containing a real name or email is UNPURGEABLE PII —
     * a PDPA delete request could not be honoured without breaking the
     * append-only guarantee. So free text is scanned at WRITE time and the
     * operator is warned BEFORE the row is committed.
     *
     * @return string[] the patterns detected, empty when clean
     */
    public static function scanFreeText(?string $text): array
    {
        if ($text === null || trim($text) === '') {
            return [];
        }

        $found = [];
        if (preg_match('/[\w.+-]+@[\w-]+\.[\w.]+/', $text)) {
            $found[] = 'email-shaped string';
        }
        // A capitalised two-word sequence is the common shape of a person's name.
        if (preg_match('/\b[A-Z][a-z]{1,}\s+[A-Z][a-z]{1,}\b/', $text)) {
            $found[] = 'name-shaped string';
        }
        if (preg_match('/\b\d{6}-\d{2}-\d{4}\b/', $text)) {
            $found[] = 'MyKad-shaped identifier';
        }

        return $found;
    }
}
