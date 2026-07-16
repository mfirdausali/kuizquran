<?php

namespace App\Services;

use App\Models\AyahVerification;
use App\Models\Event;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * §3 success-metric computations (ROADMAP Phase 6, ports v1's
 * v1/apps/worker/src/metrics.ts admin.ts read-only). Pure aggregation over the
 * `events` table; no mutation. D30 retention stays time-gated — it returns an
 * honest "accrues" note rather than a fabricated number, matching v1.
 */
class AdminMetrics
{
    private const DAY_MS = 86_400_000;

    private const ROLLOVER_HOUR = 4.5; // secular day boundary, matches engine DEFAULT_DAY_CONFIG

    private static function pct(float $x): string
    {
        return round($x * 100).'%';
    }

    private static function learningDay(int $ts): int
    {
        return (int) floor((($ts) - self::ROLLOVER_HOUR * 3_600_000) / self::DAY_MS);
    }

    /** 1. Day-1 gate pass rate. */
    public function gatePassRate(): array
    {
        $rows = Event::where('type', 'gate_result')->get(['correct']);
        $total = $rows->count();
        $passed = $rows->where('correct', true)->count();

        return [
            'key' => 'gate_pass',
            'label' => 'Day-1 gate pass rate',
            'value' => $total > 0 ? self::pct($passed / $total) : null,
            'target' => '85–90%',
            'n' => $total,
            'note' => $total === 0 ? 'no cold gates attempted yet' : null,
        ];
    }

    /** 2. Cycles-to-clean-pass: avg rung_start count per (user,ayah) before its S3 rung_complete. */
    public function cyclesToCleanPass(): array
    {
        $completes = Event::where('type', 'rung_complete')->where('rung', 'S3')
            ->get(['user_id', 'ayah', 'ts'])
            ->groupBy(fn ($e) => $e->user_id.':'.$e->ayah)
            ->map(fn (Collection $g) => $g->min('ts'));

        $starts = Event::where('type', 'rung_start')->get(['user_id', 'ayah', 'ts']);

        $cycles = [];
        foreach ($completes as $key => $doneTs) {
            [$uid, $ayah] = explode(':', $key);
            $count = $starts->filter(
                fn ($e) => (string) $e->user_id === $uid && (string) $e->ayah === $ayah && $e->ts <= $doneTs
            )->count();
            if ($count > 0) {
                $cycles[] = $count;
            }
        }

        $n = count($cycles);

        return [
            'key' => 'cycles',
            'label' => 'Cycles-to-clean-pass',
            'value' => $n > 0 ? number_format(array_sum($cycles) / $n, 1) : null,
            'target' => 'converging distribution',
            'n' => $n,
            'note' => $n === 0 ? 'no ayah encoded yet' : null,
        ];
    }

    /** 3. Time-per-word: median tap latency, interrupted taps (>5min) excluded. */
    public function timePerWord(): array
    {
        $latencies = Event::where('type', 'tap')
            ->whereNotNull('latency')
            ->where('latency', '<=', 300_000)
            ->orderBy('latency')
            ->pluck('latency')
            ->values();

        $n = $latencies->count();
        if ($n === 0) {
            return [
                'key' => 'time_per_word',
                'label' => 'Time-per-word',
                'value' => null,
                'target' => '~20 s (correct with real constant)',
                'n' => 0,
                'note' => 'no timed taps yet',
            ];
        }

        $mid = intdiv($n, 2);
        $median = $n % 2 ? $latencies[$mid] : ($latencies[$mid - 1] + $latencies[$mid]) / 2;

        return [
            'key' => 'time_per_word',
            'label' => 'Time-per-word',
            'value' => number_format($median / 1000, 1).' s',
            'target' => '~20 s (correct with real constant)',
            'n' => $n,
            'note' => null,
        ];
    }

    /** 4. Anchor adherence: fraction of active learning-days whose FIRST event fell within 90 min of anchor_hour. */
    public function anchorAdherence(): array
    {
        $rows = Event::query()
            ->join('users', 'users.id', '=', 'events.user_id')
            ->orderBy('events.user_id')->orderBy('events.ts')
            ->get(['events.user_id', 'events.ts', 'users.anchor_hour']);

        $firstByDay = [];
        foreach ($rows as $r) {
            $key = $r->user_id.':'.self::learningDay((int) $r->ts);
            if (! isset($firstByDay[$key])) {
                $firstByDay[$key] = ['ts' => (int) $r->ts, 'anchor' => (float) $r->anchor_hour];
            }
        }

        $n = count($firstByDay);
        if ($n === 0) {
            return [
                'key' => 'anchor',
                'label' => 'Anchor adherence',
                'value' => null,
                'target' => '≥60% of active days',
                'n' => 0,
                'note' => 'no active days yet',
            ];
        }

        $within = 0;
        foreach ($firstByDay as $d) {
            $local = (int) floor($d['ts'] / 1000);
            $hourOfDay = ((int) gmdate('G', $local)) + ((int) gmdate('i', $local)) / 60;
            $diff = abs($hourOfDay - $d['anchor']);
            if (min($diff, 24 - $diff) <= 1.5) {
                $within++;
            }
        }

        return [
            'key' => 'anchor',
            'label' => 'Anchor adherence',
            'value' => self::pct($within / $n),
            'target' => '≥60% of active days',
            'n' => $n,
            'note' => null,
        ];
    }

    /** 5. Interruption -> completion: of days with >=1 interruption, fraction that still reached ayah_complete same day. */
    public function interruptionCompletion(): array
    {
        $interruptedDays = Event::where('type', 'interruption')->get(['user_id', 'ts'])
            ->map(fn ($e) => $e->user_id.':'.self::learningDay((int) $e->ts))->unique();
        $completedDays = Event::where('type', 'ayah_complete')->get(['user_id', 'ts'])
            ->map(fn ($e) => $e->user_id.':'.self::learningDay((int) $e->ts))->unique();

        $n = $interruptedDays->count();
        if ($n === 0) {
            return [
                'key' => 'interruption',
                'label' => 'Interruption → completion',
                'value' => null,
                'target' => '≥80% finish same day',
                'n' => 0,
                'note' => 'no interrupted sessions yet',
            ];
        }

        $finished = $interruptedDays->filter(fn ($d) => $completedDays->contains($d))->count();

        return [
            'key' => 'interruption',
            'label' => 'Interruption → completion',
            'value' => self::pct($finished / $n),
            'target' => '≥80% finish same day',
            'n' => $n,
            'note' => null,
        ];
    }

    /** 6. Look-alike slip rate: overall wrong-tap fraction of graded (non-pretest) taps. */
    public function lookAlikeSlipRate(): array
    {
        $rows = Event::where('type', 'tap')
            ->whereNotNull('correct')
            ->where(fn ($q) => $q->whereNull('pretest')->orWhere('pretest', false))
            ->get(['correct']);

        $total = $rows->count();
        $slips = $rows->where('correct', false)->count();

        return [
            'key' => 'slip_rate',
            'label' => 'Look-alike slip rate',
            'value' => $total > 0 ? self::pct($slips / $total) : null,
            'target' => 'declining per confused pair',
            'n' => $total,
            'note' => $total === 0 ? 'no graded taps yet' : null,
        ];
    }

    /** Top confusion pairs (target <- chosen) for the drill-down, optionally scoped to one user. */
    public function confusionPairs(int $limit = 10, ?int $userId = null): array
    {
        $q = Event::where('type', 'tap')->where('correct', false)->whereNotNull('choice')
            ->where(fn ($x) => $x->whereNull('pretest')->orWhere('pretest', false));
        if ($userId !== null) {
            $q->where('user_id', $userId);
        }

        return $q->get(['ayah', 'position', 'choice'])
            ->groupBy(fn ($e) => $e->ayah.':'.$e->position.':'.$e->choice)
            ->map(function (Collection $g) {
                $first = $g->first();

                return ['ayah' => $first->ayah, 'position' => $first->position, 'chosen' => $first->choice, 'count' => $g->count()];
            })
            ->values()
            ->sortByDesc('count')
            ->take($limit)
            ->values()
            ->all();
    }

    /** 7. D30 retention vs predicted (time-gated). */
    public function d30Retention(): array
    {
        $firstTs = Event::min('ts');
        $note = 'accrues once cards reach 30 days + retention probes run';
        if ($firstTs !== null) {
            $availableAt = gmdate('Y-m-d', (int) (($firstTs + 30 * self::DAY_MS) / 1000));
            $note = "accrues from {$availableAt} (30 days after first activity)";
        }

        return [
            'key' => 'd30',
            'label' => 'D30 retention vs predicted',
            'value' => null,
            'target' => 'FSRS calibration within ±10%',
            'n' => 0,
            'note' => $note,
        ];
    }

    /** All §3 metrics, in PRD table order. */
    public function all(): array
    {
        return [
            $this->gatePassRate(),
            $this->anchorAdherence(),
            $this->cyclesToCleanPass(),
            $this->lookAlikeSlipRate(),
            $this->d30Retention(),
            $this->interruptionCompletion(),
            $this->timePerWord(),
        ];
    }

    /** Per-user drill-down (stage distribution, weak connections, streak, time-per-word). */
    public function userDrillDown(User $user): array
    {
        $encodedTotal = Event::where('user_id', $user->id)
            ->where(fn ($q) => $q->where('type', 'rung_complete')->where('rung', 'S3')
                ->orWhere(fn ($q2) => $q2->where('type', 'ayah_produced')->where('rung', 'S3')))
            ->distinct('ayah')->count('ayah');

        $gates = Event::where('user_id', $user->id)->where('type', 'gate_result')->get(['correct']);
        $latencyAvg = Event::where('user_id', $user->id)->where('type', 'tap')
            ->whereNotNull('latency')->where('latency', '<=', 300_000)->avg('latency');
        $activeDays = Event::where('user_id', $user->id)->get(['ts'])
            ->map(fn ($e) => self::learningDay((int) $e->ts))->unique()->count();

        return [
            'id' => $user->id,
            'email' => $user->email,
            'isAnonymous' => (bool) $user->is_anonymous,
            'ayatEncoded' => $encodedTotal,
            'gatesPassed' => $gates->where('correct', true)->count(),
            'gatesTotal' => $gates->count(),
            'avgLatencyMs' => $latencyAvg !== null ? (float) $latencyAvg : null,
            'activeDays' => $activeDays,
            'confusionPairs' => $this->confusionPairs(10, $user->id),
        ];
    }

    /** v2-D30/D57: verified-frontier vs. learner-frontier. `verifiedThrough` is the
     *  longest unbroken 1..N prefix that has a verification row (a gap anywhere
     *  caps it) — the number the "stays ahead of the learner" guarantee is about. */
    public function frontier(int $surah, int $ayahCount): array
    {
        $verified = AyahVerification::where('surah', $surah)->pluck('ayah')->flip();
        $verifiedThrough = 0;
        for ($a = 1; $a <= $ayahCount; $a++) {
            if (! $verified->has($a)) {
                break;
            }
            $verifiedThrough = $a;
        }

        $learnerFrontier = (int) (Event::where('surah', $surah)
            ->where(fn ($q) => $q->where(fn ($q2) => $q2->where('type', 'rung_complete')->where('rung', 'S3'))
                ->orWhere(fn ($q2) => $q2->where('type', 'ayah_produced')->where('rung', 'S3')))
            ->max('ayah') ?? 0);

        return [
            'surah' => $surah,
            'ayahCount' => $ayahCount,
            'verifiedThrough' => $verifiedThrough,
            'learnerFrontier' => $learnerFrontier,
            'bufferAyat' => $verifiedThrough - $learnerFrontier,
        ];
    }
}
