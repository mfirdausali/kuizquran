<?php

namespace App\Mail;

use App\Models\NightlyCheckRun;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * v3-D18: "A `fold_determinism` P1 pages by email, not phone." This is the
 * mail dispatch `DeterminismCheckCommand::record()` documented as missing —
 * LAUNCH-CHECKLIST gate 20's "the pager is not wired".
 *
 * No PII, no free text from the report: A.4's "no PII in logs" discipline
 * (M10 security review) applies equally to an email an SMTP provider will
 * relay and log. The body carries counts and the check/night identity only
 * — an operator follows up in the admin console or `nightly:window` for the
 * per-atom findings, which is where `userId` (an internal integer, not an
 * identity) already lives behind the reveal-audited admin surface.
 *
 * TWO REPORT SHAPES, ONE MAILABLE (v3-D215): `$run->check` is either
 * `fold_determinism_check` (FoldCheckReport — divergentCount/skewCount/
 * atomsCompared/usersChecked) or `selection_determinism_check`
 * (SelectionCheckReport — seeds/eventsReplayed/tracesCompared/divergences).
 * They share no field names. `content()` branches on `$this->check` and
 * builds only the counts the triggering check actually produces — reading
 * the other shape's keys would silently coalesce every one to 0 via `??`,
 * which is exactly the page a confirmed selection P1 sent before this fix.
 *
 * `$run->trigger` (v3-D229): already rendered on the admin console's
 * `NightlyWindowPanel` (v3-D225 — "fold_determinism_check=green (schedule)"
 * vs "(manual)") but never read here, on either shape, until this fix —
 * the on-call engineer this page is FOR had no way to tell, from the page
 * itself, whether tonight's P1 is the real unattended cron happening to
 * production right now or a manual/CI run they may already know about.
 *
 * `report['deadLetters']` (v3-D232 — the direct mailer-side sibling v3-D230
 * named and left): edge case #130's dead-letter quarantine — a real
 * `{userId, error}` pair per learner `DeterminismCheckCommand::runFold()`
 * had to skip because their event/atom data would not `json_encode` — is
 * merged into the FOLD report only (`sampleFromDatabase()` is a fold-only
 * concept; the selection check replays a committed fixture, never a
 * per-learner DB sample, so it has no dead letters of its own to carry).
 * v3-D230 gave the admin console's `NightlyWindowPanel` a real reader for
 * this same array (`lastQuarantine`, each `userId` pseudonymized); this
 * page carries only the COUNT, per this mailer's own no-PII discipline
 * above, and points the reader at that console for the per-learner detail.
 */
class DeterminismP1Alert extends Mailable
{
    use Queueable, SerializesModels;

    public readonly string $check;

    public readonly string $night;

    public function __construct(public readonly NightlyCheckRun $run)
    {
        $this->check = $run->check;
        $this->night = $run->night;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[iman.app] P1 — {$this->check} — {$this->night} (7-night window reset)",
        );
    }

    public function content(): Content
    {
        $report = $this->run->report;

        if ($this->check === 'selection_determinism_check') {
            // SelectionCheckReport (worker/fold-runner/src/selectionCheck.ts)
            // is a DIFFERENT shape than fold's FoldCheckReport — no
            // divergentCount/skewCount/atomsCompared/usersChecked exists on
            // it at all. Reading those keys here would silently coalesce to
            // 0 via `??`, the exact gap this branch closes.
            return new Content(
                view: 'emails.determinism-p1-alert',
                with: [
                    'check' => $this->check,
                    'night' => $this->night,
                    'trigger' => $this->run->trigger,
                    'kind' => 'selection',
                    'seedsCompared' => count($report['seeds'] ?? []),
                    'eventsReplayed' => (int) ($report['eventsReplayed'] ?? 0),
                    'tracesCompared' => (int) ($report['tracesCompared'] ?? 0),
                    'divergentTraces' => count($report['divergences'] ?? []),
                ],
            );
        }

        return new Content(
            view: 'emails.determinism-p1-alert',
            with: [
                'check' => $this->check,
                'night' => $this->night,
                'trigger' => $this->run->trigger,
                'kind' => 'fold',
                'divergentCount' => (int) ($report['divergentCount'] ?? 0),
                'skewCount' => (int) ($report['skewCount'] ?? 0),
                'atomsCompared' => (int) ($report['atomsCompared'] ?? 0),
                'usersChecked' => (int) ($report['usersChecked'] ?? 0),
                'deadLetterCount' => count($report['deadLetters'] ?? []),
            ],
        );
    }
}
