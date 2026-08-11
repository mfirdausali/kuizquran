<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
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

    public function exportCsv(Request $request): StreamedResponse
    {
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
