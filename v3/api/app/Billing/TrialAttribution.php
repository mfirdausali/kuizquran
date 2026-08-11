<?php

namespace App\Billing;

use App\Models\Entitlement;
use App\Models\Event;

/**
 * Edge cases #121 and #122 — which surah consumes the trial.
 *
 *   #121: "Onboarding 112 consumes trial → trial burned on demo.
 *          trial_surah = first learner-CHOSEN surah_started (flagged field);
 *          recomputed on late arrival by canonical ts."
 *   #122: "Learner CHOOSES Al-Ikhlas as first surah → explicit rule: choosing 112
 *          as the real first surah DOES consume the trial."
 *
 * So the discriminator is NOT the surah number. 112 arriving from onboarding is a
 * demo; 112 arriving because the learner picked it from the library is the trial.
 * The event carries the flag; this class never guesses.
 *
 * RECOMPUTATION ON LATE ARRIVAL is the subtle half. An offline device can deliver
 * a `surah_started` with an OLDER canonical timestamp days after a later one was
 * already attributed. The trial then belongs to the earlier surah, retroactively.
 * We therefore always recompute from the whole log rather than latching the first
 * one we happen to see — v3-D09's canonical order `(ts, deviceId, deviceSeq, uuid)`
 * is what makes that recomputation deterministic.
 */
class TrialAttribution
{
    public const SOURCE_CHOSEN = 'chosen';

    public const SOURCE_ONBOARDING_DEMO = 'onboarding_demo';

    /**
     * Recompute trial attribution for a user from their event log.
     *
     * Returns the attributed surah, or null when the learner has not yet CHOSEN
     * one (an onboarding demo alone never consumes the trial).
     */
    public function recompute(int $userId): ?int
    {
        $first = $this->firstChosenSurahStart($userId);

        return $first['surah'] ?? null;
    }

    /**
     * The first learner-CHOSEN `surah_started`, in canonical order (v3-D09).
     *
     * @return array{surah:int, ts:int}|array{}
     */
    public function firstChosenSurahStart(int $userId): array
    {
        $rows = Event::where('user_id', $userId)
            ->where('type', 'surah_started')
            ->whereNotNull('surah')
            // v3-D09's canonical order. NEVER `ts` alone — clocks skew and
            // milliseconds tie, and a tie broken differently on two machines
            // attributes the trial to two different surahs.
            ->orderBy('ts')
            ->orderBy('device_id')
            ->orderBy('device_seq')
            ->orderBy('uuid')
            ->get(['surah', 'ts', 'spec_snapshot']);

        foreach ($rows as $row) {
            if ($this->sourceOf($row) === self::SOURCE_CHOSEN) {
                return ['surah' => (int) $row->surah, 'ts' => (int) $row->ts];
            }
        }

        return [];
    }

    /**
     * Read the flagged field off an event.
     *
     * A `surah_started` with NO explicit source is treated as CHOSEN. That default
     * direction is deliberate: mis-flagging a demo as chosen costs the learner a
     * trial surah and they will complain, which we can fix; mis-flagging a real
     * choice as a demo silently gives away the product, which nobody reports.
     * Fail toward the recoverable error.
     */
    public function sourceOf(Event $event): string
    {
        $snapshot = $event->spec_snapshot;
        if (is_string($snapshot)) {
            $snapshot = json_decode($snapshot, true);
        }
        if (is_array($snapshot) && ($snapshot['trialSurahSource'] ?? null) === self::SOURCE_ONBOARDING_DEMO) {
            return self::SOURCE_ONBOARDING_DEMO;
        }

        return self::SOURCE_CHOSEN;
    }

    /**
     * Apply the recomputed attribution to the entitlement row.
     *
     * Idempotent: recomputing with the same log produces the same row, so a
     * nightly re-run is free.
     */
    public function apply(Entitlement $entitlement, EntitlementMachine $machine, int $now): void
    {
        $first = $this->firstChosenSurahStart($entitlement->user_id);
        if ($first === []) {
            return;
        }

        if (
            $entitlement->trial_surah === $first['surah']
            && $entitlement->trial_surah_source === self::SOURCE_CHOSEN
        ) {
            return; // already attributed identically — no spurious transition row
        }

        $machine->apply($entitlement, [
            'trial_surah' => $first['surah'],
            'trial_surah_source' => self::SOURCE_CHOSEN,
            'trial_started_at' => $first['ts'],
        ], EntitlementMachine::CAUSE_TRIAL_START, $now);
    }
}
