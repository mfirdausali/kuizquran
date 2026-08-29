<?php

namespace Tests\Feature\Billing;

use App\Billing\EntitlementState;
use App\Billing\EntitlementTier;
use App\Billing\PaywallGate;
use App\Models\Entitlement;
use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * THE PAYWALL BOUNDARY — edge cases #124, #96, #123, #106.
 *
 * #124 is the one that matters most: "Events for an out-of-entitlement surah →
 * ALWAYS ACCEPT — log is truth; enforcement at issuance/corpus only."
 *
 * A paywall that drops evidence is the worst failure mode in this product,
 * because the loss is SILENT and PERMANENT: no error, no retry, no trace, and the
 * learner's memory graph is simply wrong forever.
 */
class PaywallBoundaryTest extends TestCase
{
    use RefreshDatabase;

    private function gate(): PaywallGate
    {
        return app(PaywallGate::class);
    }

    private function lapsedUser(): User
    {
        $user = User::factory()->create();
        Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::LapsedReviewOnly->value,
            'tier' => EntitlementTier::None->value,
            'region' => 'MY',
        ]);

        return $user;
    }

    // ════════════════ #124 — EVENTS ARE ALWAYS INGESTED ════════════════════════

    /**
     * EDGE CASE #124, the headline case.
     *
     * A LAPSED learner posts events for a surah they are not entitled to. Every
     * one must be accepted.
     *
     * MUTATION: add `if (!$entitled) return response()->json([], 402);` to
     * `EventsController::store`. This test asserts `accepted` equals the batch
     * size AND that the rows are readable back — a test asserting only a 200
     * survives a handler that returns 200 while silently dropping rows.
     */
    public function test_lapsed_user_events_for_unentitled_surah_are_all_ingested(): void
    {
        $user = $this->lapsedUser();
        Sanctum::actingAs($user);

        $events = [];
        for ($i = 1; $i <= 5; $i++) {
            $events[] = [
                'id' => "evt-{$i}",
                'type' => 'tap',
                'ts' => 1_700_000_000_000 + $i,
                // Surah 99 — nobody is entitled to it; it is not even compiled.
                'surah' => 99,
                'ayah' => $i,
                'deviceId' => 'dev-a',
                'deviceSeq' => $i,
            ];
        }

        $response = $this->postJson('/api/events', ['events' => $events]);

        $response->assertOk();
        $this->assertSame(5, $response->json('accepted'), '#124: the log is truth — every event is accepted');
        $this->assertSame(
            5,
            Event::where('user_id', $user->id)->where('surah', 99)->count(),
            '#124: the rows must actually be durable, not merely acknowledged',
        );
    }

    /**
     * The same rule for a learner with NO entitlement row at all, and for one
     * whose trial covers a DIFFERENT surah. Both are "out of entitlement" and both
     * must ingest.
     */
    public function test_events_ingest_regardless_of_entitlement_state(): void
    {
        foreach ([null, EntitlementState::Trial, EntitlementState::Grace, EntitlementState::LapsedReviewOnly] as $i => $state) {
            $user = User::factory()->create();
            if ($state !== null) {
                Entitlement::create([
                    'user_id' => $user->id,
                    'state' => $state->value,
                    'tier' => EntitlementTier::None->value,
                    'region' => 'MY',
                    'trial_surah' => 12, // trial is for 12; events below are for 103
                ]);
            }
            Sanctum::actingAs($user);

            $response = $this->postJson('/api/events', ['events' => [[
                'id' => "e-{$i}",
                'type' => 'tap',
                'ts' => 1_700_000_000_000,
                'surah' => 103,
                'ayah' => 1,
            ]]]);

            $response->assertOk();
            $this->assertSame(1, $response->json('accepted'), "state=".($state?->value ?? 'none')." must still ingest");
        }
    }

    // ════════════ #96 / #123 — ISSUANCE ONLY, NEVER MID-SESSION ════════════════

    /**
     * EDGE CASES #96 and #123. "gate at assembly only; in-flight events always
     * ingested" / "issuance-only check; in-flight events always ingested."
     *
     * Simulates the real sequence: a session is ISSUED while entitled, the
     * entitlement then lapses mid-drill, and the remaining taps arrive. Every tap
     * must ingest, and the already-issued session is never re-checked.
     *
     * MUTATION: move the entitlement check out of issuance into a per-question
     * loop (i.e. call `permitsIssuance` again after the lapse and expect denial to
     * matter). This test proves the drill's EVENTS are unaffected either way.
     */
    public function test_session_in_flight_is_never_interrupted_by_a_lapse(): void
    {
        $user = User::factory()->create();
        $ent = Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::Active->value,
            'tier' => EntitlementTier::Monthly->value,
            'region' => 'MY',
        ]);
        Sanctum::actingAs($user);

        // 1. Issuance while entitled — permitted.
        $issued = $this->gate()->permitsIssuance($ent, 12, [12, 103], 1_700_000_000_000);
        $this->assertTrue($issued->permitted);

        // 2. The entitlement lapses MID-SESSION.
        $ent->update(['state' => EntitlementState::LapsedReviewOnly->value]);
        $ent->refresh();

        // 3. The rest of the drill's taps arrive. ALL must ingest.
        $events = [];
        for ($i = 1; $i <= 4; $i++) {
            $events[] = ['id' => "inflight-{$i}", 'type' => 'tap', 'ts' => 1_700_000_000_000 + $i, 'surah' => 12, 'ayah' => $i];
        }
        $response = $this->postJson('/api/events', ['events' => $events]);

        $response->assertOk();
        $this->assertSame(4, $response->json('accepted'), '#96/#123: an in-flight session is never interrupted');
        $this->assertSame(4, Event::where('user_id', $user->id)->count());

        // 4. And review remains open forever afterwards (v3-D16).
        $this->assertTrue($this->gate()->permitsReview($ent)->permitted);
    }

    // ══════════════════════ #106 — the degenerate trial ════════════════════════

    /**
     * EDGE CASE #106. "Trial='one surah' when one surah is the product →
     * degenerate paywall → explicitly tested."
     *
     * With exactly ONE compiled surah which IS the trial surah, the paywall must
     * still GATE something — i.e. a second, uncompiled surah is still denied. If
     * this ever starts permitting, the product has become free-forever by
     * accident, which is invisible in every other test.
     */
    public function test_degenerate_one_compiled_surah_trial_still_gates(): void
    {
        $user = User::factory()->create();
        $ent = Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::Trial->value,
            'tier' => EntitlementTier::None->value,
            'region' => 'MY',
            'trial_surah' => 12,
        ]);

        $compiled = [12]; // the degenerate case: one surah is the whole product

        $this->assertTrue(
            $this->gate()->permitsIssuance($ent, 12, $compiled, 1_700_000_000_000)->permitted,
            'the trial surah itself is open',
        );

        $denied = $this->gate()->permitsIssuance($ent, 103, $compiled, 1_700_000_000_000);
        $this->assertFalse($denied->permitted, '#106: the gate must still gate, or the product is free by accident');
        $this->assertSame('trial_surah_exhausted', $denied->code);
        $this->assertStringContainsString('#106', $denied->reason, 'the degenerate case is named, so it surfaces honestly');
    }

    // ═══════ v3-D07's OTHER HALF — trial ends at 14 days, not just one surah ═══

    /**
     * v3-D07, verbatim: "A limited free trial (one surah, OR 14 days)". Only the
     * surah half was ever checked by `permitsIssuance()` — this covers the day
     * half, which had zero test coverage anywhere before this.
     */
    public function test_trial_denies_even_the_trial_surah_once_the_day_limit_elapses(): void
    {
        $user = User::factory()->create();
        $start = 1_700_000_000_000;
        $ent = Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::Trial->value,
            'tier' => EntitlementTier::None->value,
            'region' => 'MY',
            'trial_surah' => 12,
            'trial_started_at' => $start,
        ]);

        $limitMs = (int) config('pricing.trial.days') * 24 * 60 * 60 * 1000;

        $stillOpen = $this->gate()->permitsIssuance($ent, 12, [12], $start + $limitMs - 1);
        $this->assertTrue($stillOpen->permitted, 'one millisecond inside the window, the trial surah is still open');

        $expired = $this->gate()->permitsIssuance($ent, 12, [12], $start + $limitMs);
        $this->assertFalse($expired->permitted, 'v3-D07: the trial ends at the day limit even for its own surah');
        $this->assertSame('trial_expired', $expired->code);
    }

    /**
     * A trial that has not actually STARTED (no surah chosen yet —
     * `trial_started_at` is only stamped by `TrialAttribution::apply()`) has no
     * clock to compare against. `trial_surah === null` already keeps every
     * surah open regardless of `$now`; the day check must not invent an expiry
     * for a trial that never began.
     */
    public function test_an_unstarted_trial_has_no_day_limit_to_violate(): void
    {
        $user = User::factory()->create();
        $ent = Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::Trial->value,
            'tier' => EntitlementTier::None->value,
            'region' => 'MY',
        ]);

        $farFuture = 1_700_000_000_000 + (365 * 24 * 60 * 60 * 1000);
        $this->assertTrue($this->gate()->permitsIssuance($ent, 12, [12], $farFuture)->permitted);
    }

    // ═══════════════ v3-D16 / v3-D54 — review is never gated ═══════════════════

    /**
     * The never-hostage rule, across EVERY state.
     *
     * MUTATION: make `permitsReview` return false for `lapsed_review_only`.
     */
    public function test_review_is_permitted_in_every_state_without_exception(): void
    {
        foreach (EntitlementState::cases() as $state) {
            $user = User::factory()->create();
            $ent = Entitlement::create([
                'user_id' => $user->id,
                'state' => $state->value,
                'tier' => EntitlementTier::None->value,
                'region' => 'MY',
            ]);
            $this->assertTrue(
                $this->gate()->permitsReview($ent)->permitted,
                "v3-D16: review must stay open in state {$state->value}",
            );
            $this->assertTrue($state->permitsReview());
        }

        // Including with no entitlement row at all.
        $this->assertTrue($this->gate()->permitsReview(null)->permitted);
    }

    /** Lapsed denies NEW content while permitting review — both halves. */
    public function test_lapsed_denies_new_content_but_permits_review(): void
    {
        $user = $this->lapsedUser();
        $ent = Entitlement::where('user_id', $user->id)->first();

        $issuance = $this->gate()->permitsIssuance($ent, 12, [12, 103], 1_700_000_000_000);
        $this->assertFalse($issuance->permitted);
        $this->assertSame('lapsed_review_only', $issuance->code);

        $this->assertTrue($this->gate()->permitsReview($ent)->permitted);
    }
}
