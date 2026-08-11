<?php

namespace Tests\Feature\Billing;

use App\Billing\EntitlementMachine;
use App\Billing\EntitlementState;
use App\Billing\EntitlementTier;
use App\Billing\TrialAttribution;
use App\Models\Entitlement;
use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Edge cases #121 and #122 — WHICH surah consumes the trial.
 *
 *   #121: onboarding's 112 demo must NOT burn the trial.
 *   #122: a learner who CHOOSES 112 as their real first surah DOES burn it.
 *
 * The surah number is identical in both cases, so a test that only checks one
 * direction proves nothing — the discriminator is the flagged source, and BOTH
 * directions are asserted here for exactly that reason.
 */
class TrialAttributionTest extends TestCase
{
    use RefreshDatabase;

    private function attribution(): TrialAttribution
    {
        return app(TrialAttribution::class);
    }

    private function surahStarted(User $user, string $uuid, int $surah, int $ts, ?string $source, string $device = 'dev-a', int $seq = 1): void
    {
        Event::create([
            'user_id' => $user->id,
            'uuid' => $uuid,
            'type' => 'surah_started',
            'ts' => $ts,
            'received_at' => $ts,
            'surah' => $surah,
            'device_id' => $device,
            'device_seq' => $seq,
            'spec_snapshot' => $source === null ? null : json_encode(['trialSurahSource' => $source]),
        ]);
    }

    /**
     * EDGE CASE #121. The onboarding demo of 112 must NOT consume the trial.
     *
     * MUTATION: make `sourceOf` return CHOSEN for onboarding_demo (i.e. delete the
     * flag check). Then `trial_surah` becomes 112 and this goes RED.
     */
    public function test_onboarding_demo_of_112_does_not_consume_the_trial(): void
    {
        $user = User::factory()->create();
        $this->surahStarted($user, 'a1', 112, 1_700_000_000_000, TrialAttribution::SOURCE_ONBOARDING_DEMO);

        $this->assertNull(
            $this->attribution()->recompute($user->id),
            '#121: the onboarding demo must not burn the trial',
        );
    }

    /**
     * EDGE CASE #122, the OTHER DIRECTION with the SAME surah number.
     *
     * "explicit rule: choosing 112 as the real first surah DOES consume the trial."
     */
    public function test_choosing_112_as_the_real_first_surah_does_consume_the_trial(): void
    {
        $user = User::factory()->create();
        $this->surahStarted($user, 'b1', 112, 1_700_000_000_000, TrialAttribution::SOURCE_CHOSEN);

        $this->assertSame(
            112,
            $this->attribution()->recompute($user->id),
            '#122: a deliberate choice of 112 IS the trial surah',
        );
    }

    /** Demo first, then a real choice — the choice wins, the demo is skipped. */
    public function test_demo_then_chosen_attributes_to_the_chosen_surah(): void
    {
        $user = User::factory()->create();
        $this->surahStarted($user, 'c1', 112, 1_700_000_000_000, TrialAttribution::SOURCE_ONBOARDING_DEMO, seq: 1);
        $this->surahStarted($user, 'c2', 12, 1_700_000_100_000, TrialAttribution::SOURCE_CHOSEN, seq: 2);

        $this->assertSame(12, $this->attribution()->recompute($user->id));
    }

    /**
     * #121's second half: "recomputed on late arrival by canonical ts."
     *
     * An offline device delivers an EARLIER chosen surah_started AFTER a later one
     * was already attributed. The trial belongs to the earlier surah, retroactively.
     *
     * MUTATION: latch the first-seen attribution instead of recomputing, or order
     * by `id` (arrival) instead of the canonical order.
     */
    public function test_late_arriving_earlier_event_reattributes_the_trial(): void
    {
        $user = User::factory()->create();

        // Ingested first, but its ts is LATER.
        $this->surahStarted($user, 'd2', 103, 1_700_000_500_000, TrialAttribution::SOURCE_CHOSEN, device: 'dev-b', seq: 1);
        $this->assertSame(103, $this->attribution()->recompute($user->id));

        // A week later, an offline device delivers an EARLIER chosen start.
        $this->surahStarted($user, 'd1', 12, 1_700_000_100_000, TrialAttribution::SOURCE_CHOSEN, device: 'dev-a', seq: 1);

        $this->assertSame(
            12,
            $this->attribution()->recompute($user->id),
            '#121: late arrival re-attributes by canonical ts, never by arrival order',
        );
    }

    /**
     * v3-D09's canonical order is `(ts, deviceId, deviceSeq, uuid)`, never `ts`
     * alone. Two devices starting different surahs in the SAME millisecond must
     * resolve identically on every machine.
     *
     * MUTATION: drop the deviceId/deviceSeq/uuid tiebreakers from the ordering.
     */
    public function test_ties_are_broken_by_the_full_canonical_order(): void
    {
        $user = User::factory()->create();
        $ts = 1_700_000_000_000;
        $this->surahStarted($user, 'z-uuid', 103, $ts, TrialAttribution::SOURCE_CHOSEN, device: 'dev-b', seq: 1);
        $this->surahStarted($user, 'a-uuid', 12, $ts, TrialAttribution::SOURCE_CHOSEN, device: 'dev-a', seq: 1);

        // dev-a sorts before dev-b, so surah 12 wins — deterministically.
        $this->assertSame(12, $this->attribution()->recompute($user->id));
    }

    /**
     * THE deviceId TIEBREAKER, ISOLATED.
     *
     * WHY THIS TEST EXISTS: the test above was VACUOUS for deviceId. Removing
     * `orderBy('device_id')->orderBy('device_seq')` left it green, because its
     * uuids ('a-uuid' < 'z-uuid') happened to agree with its devices ('dev-a' <
     * 'dev-b') — so the trailing uuid tiebreaker alone produced the same answer
     * and the mutation SURVIVED. That is v3-D49's failure exactly: a guard whose
     * test cannot distinguish the states it guards.
     *
     * Here the uuid order is deliberately set OPPOSITE to the deviceId order, so
     * only a real deviceId comparison can produce the expected result.
     */
    public function test_deviceId_outranks_uuid_in_the_canonical_order(): void
    {
        $user = User::factory()->create();
        $ts = 1_700_000_000_000;
        // dev-a (earlier device) carries the LATER uuid.
        $this->surahStarted($user, 'z-uuid', 12, $ts, TrialAttribution::SOURCE_CHOSEN, device: 'dev-a', seq: 1);
        // dev-b (later device) carries the EARLIER uuid.
        $this->surahStarted($user, 'a-uuid', 103, $ts, TrialAttribution::SOURCE_CHOSEN, device: 'dev-b', seq: 1);

        // v3-D09: deviceId is compared BEFORE uuid, so dev-a's surah 12 wins.
        // If uuid were consulted first, 103 would win.
        $this->assertSame(
            12,
            $this->attribution()->recompute($user->id),
            'v3-D09 orders by (ts, deviceId, deviceSeq, uuid) — deviceId outranks uuid',
        );
    }

    /**
     * THE deviceSeq TIEBREAKER, ISOLATED — same reasoning as above.
     *
     * Same ts, same device, so only deviceSeq can decide; the uuid order is again
     * set opposite so it cannot silently do the work.
     */
    public function test_deviceSeq_outranks_uuid_in_the_canonical_order(): void
    {
        $user = User::factory()->create();
        $ts = 1_700_000_000_000;
        $this->surahStarted($user, 'z-uuid', 12, $ts, TrialAttribution::SOURCE_CHOSEN, device: 'dev-a', seq: 1);
        $this->surahStarted($user, 'a-uuid', 103, $ts, TrialAttribution::SOURCE_CHOSEN, device: 'dev-a', seq: 2);

        $this->assertSame(
            12,
            $this->attribution()->recompute($user->id),
            'v3-D09: deviceSeq outranks uuid',
        );
    }

    /**
     * An unflagged `surah_started` defaults to CHOSEN.
     *
     * The direction is deliberate (see `TrialAttribution::sourceOf`): mis-flagging
     * a demo as chosen costs a trial surah and gets reported; mis-flagging a real
     * choice as a demo silently gives away the product and nobody reports it.
     */
    public function test_an_unflagged_start_defaults_to_chosen(): void
    {
        $user = User::factory()->create();
        $this->surahStarted($user, 'e1', 12, 1_700_000_000_000, null);

        $this->assertSame(12, $this->attribution()->recompute($user->id));
    }

    /** Applying attribution is idempotent — a nightly re-run writes nothing new. */
    public function test_applying_attribution_twice_writes_one_transition(): void
    {
        $user = User::factory()->create();
        $ent = Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::Trial->value,
            'tier' => EntitlementTier::None->value,
            'region' => 'MY',
        ]);
        $this->surahStarted($user, 'f1', 12, 1_700_000_000_000, TrialAttribution::SOURCE_CHOSEN);

        $machine = app(EntitlementMachine::class);
        $this->attribution()->apply($ent, $machine, 1_700_000_000_000);
        $ent->refresh();
        $this->attribution()->apply($ent, $machine, 1_700_000_100_000);
        $ent->refresh();

        $this->assertSame(12, $ent->trial_surah);
        $this->assertSame(TrialAttribution::SOURCE_CHOSEN, $ent->trial_surah_source);
        $this->assertSame(
            1,
            \App\Models\EntitlementTransition::where('user_id', $user->id)->count(),
            'a re-run must not write a spurious transition row',
        );
    }
}
