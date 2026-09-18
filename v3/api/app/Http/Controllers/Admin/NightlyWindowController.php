<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\NightlyCheckRun;
use App\Support\NightlyWindowLedger;
use Illuminate\Http\JsonResponse;

/**
 * THE 7-CONSECUTIVE-GREEN-NIGHTS WINDOW VIEWER — the missing read surface
 * for `NightlyWindowLedger::status()`.
 *
 * BUILD-PLAN M10's launch gate ("7-consecutive-green-nights window... both
 * determinism checks green nightly") has been computable since the ledger
 * shipped (`php artisan nightly:window`), but only as a CLI command — no
 * HTTP route, no admin screen. HANDOVER.md's own C5 names the consequence
 * directly: "the 7-night window needs a human checking `nightly:window`
 * daily" over SSH, and H5 flags that nobody is paged on a P1 either — a
 * human watching this number by hand is the ENTIRE safety net for the gate
 * that blocks public launch. `NightlyCheckRun`/`NightlyWindow` had a nightly
 * writer (`DeterminismCheckCommand`, `NightlyWindowCommand --start`) and
 * zero admin-facing readers — the same "built + populated + zero read
 * surface" shape v3-D129/D130/D141/D142 each closed for
 * `admin_audit`/`flag_ramp_audit`/`entitlement_transitions`/`purge_ledger`.
 *
 * A THIN, UNTRANSFORMED PASS-THROUGH for the streak itself.
 * `NightlyWindowLedger::status()` is already the one place the streak
 * arithmetic lives (edge case #169); this controller adds no second
 * implementation of it, exactly the same discipline `ContentFreezeController`
 * follows for the freeze gate.
 *
 * READ-ONLY BY CONSTRUCTION. No route is registered for anything but GET —
 * this screen may never declare or reset the window; that stays
 * `nightly:window --start`, a deliberate human CLI action per BUILD-PLAN's
 * own "starts only after the last engine/selection merge." A route that let
 * this screen flip the window start would let staff self-serve past the one
 * check BUILD-PLAN insists a human make.
 *
 * v3-D178: `NightlyWindowLedger::status()`'s OWN `nights`/`severities`
 * carry no learner identity — but `nightly_check_runs.report` (this table's
 * OTHER column) does: its `findings: {userId, key, kind, cachedVersion}[]`
 * is the runner's per-atom evidence, and `DeterminismP1Alert`'s own
 * docblock names the intended read path verbatim — "an operator follows up
 * in the admin console... for the per-atom findings" — but nothing ever
 * built that follow-up: `status()` never touches `report` at all, so a
 * confirmed P1 paged an operator with counts only and no way to see WHICH
 * learner or atom key actually diverged short of a raw database query.
 * Fixed here, not in the ledger: `NightlyWindowLedger::status()` stays
 * learner-identity-free as documented (edge case #169's own arithmetic
 * needs none of this); this controller separately fetches the ONE run that
 * produced `lastP1` and pseudonymizes its findings on the way out, the same
 * `Pseudonymizer` HMAC every other admin surface applies to a raw learner
 * id (`AdminBillingController::toWire()`'s `subjectPseudonym`) — never the
 * raw integer, and never truncated (the runner's own contract: "a check
 * that hides findings past row 50 is a check that lies about the
 * fiftieth-first").
 *
 * v3-D179: v3-D178 read `report['findings']` UNCONDITIONALLY — the fold
 * check's own shape (`worker/fold-runner/src/foldCheck.ts#FoldCheckReport`).
 * `selection_determinism_check` writes to the exact same `report` column
 * (`DeterminismCheckCommand::runSelection()` -> `record()`) but under a
 * DIFFERENT key: `SelectionCheckReport.divergences`
 * (`worker/fold-runner/src/selectionCheck.ts`). So a selection-check P1 —
 * BUILD-PLAN's OTHER launch-gate check, reachable whenever a shuffled replay
 * fails to reproduce the canonical selection trace — silently discarded its
 * own evidence and reported an empty findings list, indistinguishable from
 * "checked, nothing found". Fixed: `findingsFor()` branches on which check
 * produced the P1 and reads the matching shape. A selection divergence
 * carries no learner id at all — the check replays a COMMITTED FIXTURE log,
 * never production data (`runSelection()`'s own `report['scope']`) — so
 * unlike a fold finding there is nothing to pseudonymize; `seed` and
 * `traceKey` (`${siteKey}:${deviceId}:${visitOrdinal}`) are the reproducible
 * evidence a human re-runs to see the divergence again.
 *
 * v3-D230: `report['deadLetters']` — edge case #130's quarantine, written by
 * `DeterminismCheckCommand::sampleFromDatabase()` for every sampled learner
 * whose own event/atom rows could not be encoded — had no admin-facing
 * reader at all. `findingsFor()` above only ever loads the run that produced
 * `lastP1`, and a dead letter NEVER produces a P1 by construction: the
 * command upgrades an otherwise-green run to exit 3 / `severity: warn` and
 * says so in its own comment ("never pages a P1 on its own"). The only other
 * consumer anywhere was `Cache::put('health:dead_letter_depth', count(...))`
 * — a bare DEPTH on `/settings/health`'s `SystemHealthPanel`, naming neither
 * the learner nor the reason.
 *
 * That gap is load-bearing on THIS screen specifically, because
 * `NightlyWindowLedger` counts a WARN night as GREEN (its own rule 3: "a
 * WARN does NOT reset, and does not break the chain"). So a learner who is
 * quarantined every night is never folded, never compared, and the
 * seven-night launch gate advances anyway — while the panel renders
 * `fold_determinism_check=warn (schedule)` and nothing else. The ledger's
 * own reason for existing is that "an unobserved night must never read as a
 * green one"; this is the same lie one level down, per learner instead of
 * per night, and the run row already held both facts.
 *
 * Fixed on `SystemHealthController::pseudonymizedDeadLetters()`'s exact
 * template (v3-D204, which gave the SIBLING rebuild path this same reader):
 * the most recent run in the window whose report carries a non-empty
 * `deadLetters` is surfaced as `lastQuarantine`, each entry's raw `userId`
 * replaced by the same HMAC `Pseudonymizer` every other admin finding list
 * uses. `null` — never an empty list — when no run in the window quarantined
 * anyone, the same "no findings" shape `lastP1Findings` already uses.
 */
class NightlyWindowController extends Controller
{
    public function __construct(private readonly Pseudonymizer $pseudonymizer) {}

    public function index(): JsonResponse
    {
        $status = NightlyWindowLedger::status();
        $status['lastP1Findings'] = $this->findingsFor($status['lastP1']);
        $status['lastQuarantine'] = $this->lastQuarantine($status['windowStartedAt']);

        return response()->json($status);
    }

    /**
     * The most recent run IN THE WINDOW that quarantined at least one
     * learner (edge case #130). Window-scoped exactly as
     * `NightlyWindowLedger::nights()` is — including the undeclared-window
     * case, where that method also reads every recorded run — so this screen
     * never reports a quarantine from before the window it is counting.
     *
     * @return array{night:string,check:string,entries:list<array{subjectPseudonym:string,error:string}>}|null
     */
    private function lastQuarantine(?string $windowStartedAt): ?array
    {
        $query = NightlyCheckRun::query()->orderByDesc('night')->orderByDesc('id');
        if ($windowStartedAt !== null) {
            $query->where('night', '>=', $windowStartedAt);
        }

        foreach ($query->cursor() as $run) {
            // `report` is a nullable JSON column and this scans EVERY run in
            // the window, not the one run `findingsFor()` already knows has a
            // report — so a null/non-array report is a real shape here, and a
            // bare `$run->report['deadLetters']` would warn on it.
            $report = $run->report;
            $entries = is_array($report) ? ($report['deadLetters'] ?? null) : null;
            if (! is_array($entries) || $entries === []) {
                continue;
            }

            return [
                'night' => (string) $run->night,
                'check' => (string) $run->check,
                'entries' => array_values(array_map(
                    fn (array $d) => [
                        'subjectPseudonym' => $this->pseudonymizer->for((int) ($d['userId'] ?? 0)),
                        'error' => (string) ($d['error'] ?? ''),
                    ],
                    array_filter($entries, 'is_array'),
                )),
            ];
        }

        return null;
    }

    /**
     * @param  array{night:string,check:string}|null  $lastP1
     * @return list<array<string,mixed>>|null
     */
    private function findingsFor(?array $lastP1): ?array
    {
        if ($lastP1 === null) {
            return null;
        }

        $run = NightlyCheckRun::query()
            ->where('night', $lastP1['night'])
            ->where('check', $lastP1['check'])
            ->where('severity', 'p1')
            ->orderByDesc('id')
            ->first();

        if ($run === null) {
            return [];
        }

        return $lastP1['check'] === 'selection_determinism_check'
            ? $this->selectionFindings($run)
            : $this->foldFindings($run);
    }

    /**
     * @return list<array{type:'fold',subjectPseudonym:string,key:string,kind:string,cachedVersion:?string}>
     */
    private function foldFindings(NightlyCheckRun $run): array
    {
        $findings = $run->report['findings'] ?? [];

        return array_values(array_map(fn (array $f) => [
            'type' => 'fold',
            'subjectPseudonym' => $this->pseudonymizer->for((int) $f['userId']),
            'key' => (string) $f['key'],
            'kind' => (string) $f['kind'],
            'cachedVersion' => $f['cachedVersion'] ?? null,
        ], $findings));
    }

    /**
     * `SelectionCheckReport.divergences` — never a raw learner id, since
     * this check replays a committed fixture log, not production events.
     *
     * @return list<array{type:'selection',seed:int,traceKey:string,baseline:?array,replayed:?array}>
     */
    private function selectionFindings(NightlyCheckRun $run): array
    {
        $divergences = $run->report['divergences'] ?? [];

        return array_values(array_map(fn (array $d) => [
            'type' => 'selection',
            'seed' => (int) $d['seed'],
            'traceKey' => (string) $d['traceKey'],
            'baseline' => $d['baseline'] ?? null,
            'replayed' => $d['replayed'] ?? null,
        ], $divergences));
    }
}
