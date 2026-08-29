<?php

namespace Tests\Feature\Billing;

use App\Billing\EntitlementState;
use App\Billing\EntitlementTier;
use App\Models\Entitlement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * GET /api/entitlement — build-plan step 23 (M7).
 *
 * `PaywallGate::permitsIssuance()` (app/Billing/PaywallGate.php) has been
 * built and mutation-verified since 2026-08-10, but nothing server-side or
 * client-side has ever CALLED it in the shipped product — `check-boundaries.mjs`
 * clause 9's own comment says session assembly enforcement is deliberately
 * deferred "because the session page is still a stub". That stopped being true
 * when step 18 landed the real session loop (v3-D67); the comment was never
 * revisited. This endpoint is the missing wire: the client has nowhere to
 * fetch its own entitlement snapshot from, so `lib/entitlement/gate.ts`'s
 * `permitsIssuance` can never be called with real data.
 *
 * Deliberately thin: this is a READ endpoint only, mirrors
 * `PaywallGate::permitsIssuance`'s own "no entitlement row" branch exactly (a
 * brand-new/anonymous learner is `trial`, `trialSurah: null`, so any surah is
 * still theirs), and is scoped to the caller's own row — the same
 * self-service-only discipline `AccountController` already established.
 */
class EntitlementControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/entitlement');

        $response->assertStatus(401);
    }

    public function test_a_learner_with_no_entitlement_row_reads_as_trial_not_yet_consumed(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/entitlement');

        $response->assertOk()->assertExactJson([
            'state' => 'trial',
            'tier' => 'none',
            'region' => 'INTL',
            'trialSurah' => null,
            'trialStartedAt' => null,
        ]);
    }

    public function test_a_real_entitlement_row_is_read_back_verbatim(): void
    {
        $user = User::factory()->create();
        Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::Active->value,
            'tier' => EntitlementTier::Lifetime->value,
            'region' => 'MY',
            'trial_surah' => 67,
            'trial_started_at' => 1_700_000_000_000,
        ]);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/entitlement');

        $response->assertOk()->assertExactJson([
            'state' => 'active',
            'tier' => 'lifetime',
            'region' => 'MY',
            'trialSurah' => 67,
            'trialStartedAt' => 1_700_000_000_000,
        ]);
    }

    /**
     * v3-D07's OTHER HALF (see PaywallBoundaryTest): the client cannot enforce
     * the 14-day trial window without a clock to compare against.
     * `trialStartedAt` is the field that carries it — before this fix the
     * controller never put it on the wire at all, so `lib/entitlement/gate.ts`
     * had no way to ever implement its own side of the same rule.
     */
    public function test_trial_started_at_is_null_until_a_surah_is_actually_chosen(): void
    {
        $user = User::factory()->create();
        Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::Trial->value,
            'tier' => EntitlementTier::None->value,
            'region' => 'MY',
        ]);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/entitlement');

        $response->assertOk()->assertJsonPath('trialStartedAt', null);
    }

    public function test_lapsed_review_only_is_reported_honestly_not_papered_over(): void
    {
        $user = User::factory()->create();
        Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::LapsedReviewOnly->value,
            'tier' => EntitlementTier::None->value,
            'region' => 'INTL',
            'trial_surah' => 12,
        ]);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/entitlement');

        $response->assertOk()->assertJsonPath('state', 'lapsed_review_only');
    }

    /**
     * SELF-SERVICE ONLY. Two learners, two rows — a caller must only ever see
     * their own. Same shape as `AccountController`'s scoping, and the same
     * failure mode this whole class of bug takes (a stray `->first()` with no
     * `where('user_id', ...)` silently serves the wrong learner's paywall
     * state, which would let one learner's purchase unlock another's device).
     */
    public function test_a_learner_never_reads_another_learners_entitlement(): void
    {
        $other = User::factory()->create();
        Entitlement::create([
            'user_id' => $other->id,
            'state' => EntitlementState::Active->value,
            'tier' => EntitlementTier::Lifetime->value,
            'region' => 'MY',
        ]);

        $me = User::factory()->create();
        Sanctum::actingAs($me);

        $response = $this->getJson('/api/entitlement');

        $response->assertOk()->assertJsonPath('state', 'trial');
    }
}
