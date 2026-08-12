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

        return new Content(
            view: 'emails.determinism-p1-alert',
            with: [
                'check' => $this->check,
                'night' => $this->night,
                'divergentCount' => (int) ($report['divergentCount'] ?? 0),
                'skewCount' => (int) ($report['skewCount'] ?? 0),
                'atomsCompared' => (int) ($report['atomsCompared'] ?? 0),
                'usersChecked' => (int) ($report['usersChecked'] ?? 0),
            ],
        );
    }
}
