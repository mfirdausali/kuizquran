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
 */
class NightlyWindowController extends Controller
{
    public function __construct(private readonly Pseudonymizer $pseudonymizer) {}

    public function index(): JsonResponse
    {
        $status = NightlyWindowLedger::status();
        $status['lastP1Findings'] = $this->findingsFor($status['lastP1']);

        return response()->json($status);
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
