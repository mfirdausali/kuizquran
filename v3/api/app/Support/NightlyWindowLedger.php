<?php

namespace App\Support;

use App\Models\NightlyCheckRun;
use App\Models\NightlyWindow;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE WINDOW LEDGER — what turns "7 green nights" from a wish into a
 * countable fact.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BUILD-PLAN.md, gates section, verbatim:
 *
 *   "7-consecutive-green-nights window (M10). Both determinism checks green
 *    nightly; confirmed P1 resets the window, WARN does not; starts only
 *    after the last engine/selection merge."
 *
 * and edge case #169: "7-green-nights arithmetic → contested gate → defined:
 * confirmed P1 resets the window; WARN (version skew) does not."
 *
 * That is four separate rules, and each one is a way the gate gets passed by
 * accident if it is left implicit:
 *
 *  1. BOTH checks, every night. A night where fold ran green and selection
 *     never ran is not a green night — it is a night with a missing check.
 *     `nightGreen()` requires a green-or-warn run of EACH check.
 *
 *  2. A confirmed P1 RESETS to zero. Not "pauses", not "doesn't count" —
 *     the streak restarts the day after. `streak()` scans forward and drops
 *     everything up to and including a P1 night.
 *
 *  3. A WARN does NOT reset, and does not break the chain. Version skew
 *     after an engine deploy is expected; if it reset the window, no engine
 *     could ever be deployed inside the seven days and the gate would be
 *     unreachable rather than strict.
 *
 *  4. Nights before `window_started_at` never count, however green — that is
 *     "starts only after the last engine/selection merge".
 *
 * ── CONSECUTIVE MEANS CALENDAR-CONSECUTIVE ──
 * A missing night breaks the streak. This is not pedantry: the failure mode
 * it guards against is a scheduler that silently stopped running for three
 * days, leaving four green rows that a naive `count(green)` would happily
 * call "4 nights and counting" when the true state is "the check has not run
 * since Tuesday". A gap means the system was unobserved, and an unobserved
 * night cannot be a green one.
 *
 * ── WHAT AN 'error' NIGHT DOES ──
 * It is not green (so the streak cannot extend through it) but it is not a
 * confirmed divergence either, so it does not reset an earned streak to zero
 * — it simply ends it as a gap does. Edge case #167's rule ("the failure
 * path returns null, not zero") applied to nights: an unrun check is
 * unknown, and unknown is never counted as passed.
 */
class NightlyWindowLedger
{
    /** BUILD-PLAN's number. */
    public const REQUIRED_NIGHTS = 7;

    /**
     * The streak, with its evidence.
     *
     * @return array{
     *   streak:int, required:int, satisfied:bool,
     *   windowStartedAt:?string, windowReason:?string,
     *   nights:list<array{night:string,green:bool,severities:array<string,string>,missing:list<string>}>,
     *   lastP1:?array{night:string,check:string},
     *   blockedBy:?string
     * }
     */
    public static function status(?string $today = null): array
    {
        $window = NightlyWindow::current();
        $start = $window->window_started_at;

        $nights = self::nights($start, $today);

        // Scan from the END backwards: the streak is the run of green
        // nights ending at the most recent observed night, cut short by the
        // first non-green night encountered going back.
        $streak = 0;
        $lastP1 = null;
        foreach (array_reverse($nights) as $n) {
            if ($n['green']) {
                $streak++;

                continue;
            }
            // First non-green going backwards ends the streak.
            if ($lastP1 === null) {
                foreach ($n['severities'] as $check => $sev) {
                    if ($sev === 'p1') {
                        $lastP1 = ['night' => $n['night'], 'check' => $check];
                        break;
                    }
                }
            }
            break;
        }

        $blockedBy = null;
        if ($start === null) {
            // No declared window start. The streak is meaningless — report
            // 0 with the reason, never a number somebody might act on.
            $streak = 0;
            $blockedBy = 'no window start declared — run `nightly:window --start` after the last engine/selection merge';
        } elseif ($nights === []) {
            $blockedBy = 'no check runs recorded since the window start';
        } elseif ($streak < self::REQUIRED_NIGHTS) {
            $blockedBy = sprintf('%d of %d consecutive green nights', $streak, self::REQUIRED_NIGHTS);
        }

        return [
            'streak' => $streak,
            'required' => self::REQUIRED_NIGHTS,
            'satisfied' => $start !== null && $streak >= self::REQUIRED_NIGHTS,
            'windowStartedAt' => $start,
            'windowReason' => $window->reason,
            'nights' => $nights,
            'lastP1' => $lastP1,
            'blockedBy' => $blockedBy,
        ];
    }

    /**
     * Every calendar night from the first recorded run (or the window start,
     * whichever is later) through the last recorded run — INCLUDING nights
     * with no runs at all, which appear as non-green with every check
     * listed as missing. Materializing the gaps is what makes "consecutive"
     * mean consecutive instead of "seven rows somewhere in the table".
     *
     * @return list<array{night:string,green:bool,severities:array<string,string>,missing:list<string>}>
     */
    private static function nights(?string $start, ?string $today = null): array
    {
        $query = NightlyCheckRun::query()->orderBy('night')->orderBy('id');
        if ($start !== null) {
            $query->where('night', '>=', $start);
        }
        /** @var list<NightlyCheckRun> $runs */
        $runs = $query->get()->all();
        if ($runs === []) {
            return [];
        }

        // Worst severity per (night, check). A night that ran green and then
        // re-ran after a P1 keeps the P1: a re-run never launders a
        // confirmed divergence. Ordering: p1 worst, then error, then warn,
        // then green.
        $rank = ['green' => 0, 'warn' => 1, 'error' => 2, 'p1' => 3];
        $byNight = [];
        foreach ($runs as $run) {
            $n = $run->night;
            $c = $run->check;
            $s = $run->severity;
            $existing = $byNight[$n][$c] ?? null;
            if ($existing === null || ($rank[$s] ?? 3) > ($rank[$existing] ?? 3)) {
                $byNight[$n][$c] = $s;
            }
        }

        $first = (string) $runs[0]->night;
        $last = (string) $runs[count($runs) - 1]->night;
        if ($today !== null && $today > $last) {
            $last = $today;
        }

        $out = [];
        $cursor = $first;
        // Bounded: a window that somehow spans more than a year is a data
        // problem, not something to loop forever over.
        for ($guard = 0; $guard < 400 && $cursor <= $last; $guard++) {
            $severities = $byNight[$cursor] ?? [];
            $missing = [];
            foreach (NightlyCheckRun::CHECKS as $check) {
                if (! isset($severities[$check])) {
                    $missing[] = $check;
                }
            }
            // Green requires BOTH checks present and each green-or-warn.
            $green = $missing === [];
            foreach ($severities as $sev) {
                if ($sev !== 'green' && $sev !== 'warn') {
                    $green = false;
                }
            }
            $out[] = [
                'night' => $cursor,
                'green' => $green,
                'severities' => $severities,
                'missing' => $missing,
            ];
            $cursor = date('Y-m-d', strtotime($cursor.' +1 day'));
        }

        return $out;
    }
}
