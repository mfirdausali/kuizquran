<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAudit;
use App\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Build-plan step 24 (M8). Users list + CSV export.
 *
 * WIREFRAME §16: "Bulk CSV exports strip identity entirely."
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THERE IS NO "INCLUDE EMAILS" OPTION, AND THAT IS THE DESIGN.
 *
 * The export takes no parameter that could add identity, reads no config that
 * could enable it, and has no branch that could be flipped. A checkbox — even a
 * role-gated one — is a thing an operator can be socially engineered into
 * ticking, and a bulk file with 10,000 emails is the single worst artifact this
 * system could produce. Identity leaves the system ONLY through the per-subject,
 * reason-required, audited `reveal` path.
 * ══════════════════════════════════════════════════════════════════════════════
 */
class AdminUsersController extends Controller
{
    public function __construct(private readonly Pseudonymizer $pseudonymizer) {}

    /** The columns. Note what is absent: email, name, ip. */
    private const COLUMNS = ['pseudonym', 'created_at', 'is_anonymous', 'anchor_hour', 'event_count'];

    /**
     * THE EXPORT IS AUDITED BEFORE ONE BYTE IS STREAMED (M10 security review).
     *
     * The columns carry no identity, which is why this route was previously
     * unaudited — the reasoning being that a file with no PII needs no record.
     * That is the wrong test. A full-corpus dump of every pseudonym, signup
     * date and event count is a COMPLETE BEHAVIOURAL PROFILE of the entire user
     * base, and pseudonyms are stable by design (`Pseudonymizer`: "STABLE
     * across sessions, so an operator can correlate a support thread"). Anyone
     * holding one previously-revealed identity can join it against this file.
     *
     * So the bulk read is recorded exactly as the per-subject read is. The row
     * is written BEFORE the stream opens, for the same reason the reveal writes
     * its row inside the transaction: a dump that fails halfway has still been
     * partially delivered, and an audit log that only records completed exports
     * is one a crash can silently empty.
     *
     * `subject_pseudonym` is null — the subject IS the whole table, and inventing
     * a pseudonym here would falsely name one learner as the subject.
     */
    public function exportCsv(Request $request): StreamedResponse
    {
        AdminAudit::create([
            'actor_admin_id' => $request->user()->id,
            'action' => 'export_users_csv',
            'subject_pseudonym' => null,
            'reason_code' => 'support_ticket',
            'reason_text' => 'bulk pseudonymous export of the users table (no identity columns)',
            'at' => (int) round(microtime(true) * 1000),
            'ip' => $request->ip(),
            'request_id' => $request->header('X-Request-Id'),
        ]);

        $pseudonymizer = $this->pseudonymizer;

        return response()->streamDownload(function () use ($pseudonymizer) {
            $out = fopen('php://output', 'w');
            fputcsv($out, self::COLUMNS);

            User::query()
                ->withCount('events')
                ->orderBy('id')
                ->chunk(500, function ($users) use ($out, $pseudonymizer) {
                    foreach ($users as $user) {
                        fputcsv($out, [
                            $pseudonymizer->for($user->id),
                            $user->created_at?->toIso8601String(),
                            $user->is_anonymous ? '1' : '0',
                            $user->anchor_hour,
                            $user->events_count,
                        ]);
                    }
                });

            fclose($out);
        }, 'users.csv', ['Content-Type' => 'text/csv']);
    }
}
