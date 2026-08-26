<?php

namespace Tests\Feature\Admin;

use App\Billing\EntitlementMachine;
use App\Http\Controllers\Admin\Pseudonymizer;
use App\Models\Entitlement;
use App\Models\EntitlementTransition;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * BUILD-PLAN M7's own named deliverable, never built: "admin billing surface."
 * `tests/Feature/Boundaries/EntitlementBoundaryTest.php` has reserved
 * `app/Http/Controllers/Admin/AdminBillingController.php` on its entitlement-read
 * ALLOWLIST since the boundary test was written — an unbuilt slot with no
 * caller, the exact "mechanism named, never wired" shape this build has closed
 * ~50 times over (v3-D82 through v3-D140) for other tables. `entitlement_transitions`
 * is written by every `EntitlementMachine::apply()` call (webhooks, trial start,
 * reconcile, admin override) and read by nothing anywhere in `app/` outside its
 * own model — the same "built + populated + zero read surface" shape v3-D129/
 * D130 fixed for `admin_audit`/`flag_ramp_audit`. An operator asking "why did
 * this learner's tier flip to lapsed" has a database console and nothing else.
 */
class AdminBillingTest extends TestCase
{
    use RefreshDatabase;

    private function admin(string $email = 'ops@example.com'): User
    {
        config([
            'admin.emails' => [$email],
            'admin.pseudonym_pepper' => 'test-pepper',
        ]);
        $admin = User::factory()->create(['email' => $email, 'email_verified_at' => now()]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function learner(): User
    {
        return User::factory()->create();
    }

    public function test_the_route_requires_admin(): void
    {
        $this->getJson('/api/admin/billing')->assertStatus(401);

        $learner = $this->learner();
        Sanctum::actingAs($learner);
        $this->getJson('/api/admin/billing')->assertStatus(403);
    }

    /**
     * Seeds through the REAL state machine (`EntitlementMachine::apply()`), the
     * one and only writer of this table — never a hand-built row shaped like
     * one, so the test proves the actual wiring, not a fixture shortcut.
     */
    public function test_it_returns_entries_newest_first_through_the_real_state_machine(): void
    {
        $this->admin();
        $learner = $this->learner();
        $entitlement = Entitlement::create([
            'user_id' => $learner->id,
            'state' => 'trial',
            'tier' => 'none',
            'region' => 'INTL',
            'state_version' => 0,
        ]);

        $machine = app(EntitlementMachine::class);
        $machine->apply($entitlement, ['state' => \App\Billing\EntitlementState::Active, 'tier' => \App\Billing\EntitlementTier::Monthly], EntitlementMachine::CAUSE_WEBHOOK, 1_700_000_000_000, 'evt_first', 'system', null, 1_700_000_000_000);
        $machine->apply($entitlement->fresh(), ['state' => \App\Billing\EntitlementState::Grace], EntitlementMachine::CAUSE_WEBHOOK, 1_700_000_005_000, 'evt_second', 'system', null, 1_700_000_005_000);

        $entries = $this->getJson('/api/admin/billing')->assertOk()->json('entries');

        $this->assertCount(2, $entries);
        $this->assertSame('active', $entries[0]['fromState']);
        $this->assertSame('grace', $entries[0]['toState']);
        $this->assertSame('evt_second', $entries[0]['providerEventId']);
        $this->assertSame('trial', $entries[1]['fromState']);
        $this->assertSame('active', $entries[1]['toState']);
        $this->assertSame('webhook', $entries[1]['cause']);
        $this->assertSame('system', $entries[1]['actor']);
        $this->assertNull($entries[1]['reason']);
    }

    /** The very first transition a learner ever has has no predecessor. */
    public function test_a_null_from_state_renders_as_null_not_a_fabricated_string(): void
    {
        $this->admin();
        EntitlementTransition::create([
            'user_id' => $this->learner()->id,
            'from_state' => null,
            'to_state' => 'trial',
            'cause' => EntitlementMachine::CAUSE_TRIAL_START,
            'at' => 1_700_000_000_000,
        ]);

        $entries = $this->getJson('/api/admin/billing')->assertOk()->json('entries');
        $this->assertNull($entries[0]['fromState']);
        $this->assertSame('trial', $entries[0]['toState']);
    }

    /**
     * SUBJECT PSEUDONYMIZATION. `entitlement_transitions.user_id` is a raw FK —
     * unlike `admin_audit.subject_pseudonym`, which is pseudonymized at WRITE
     * time, this table has never been rendered to an admin before, so nothing
     * pseudonymizes it until this controller does. Returning it verbatim would
     * be the one billing screen that deanonymizes a learner to every admin who
     * can load it.
     */
    public function test_the_subject_is_pseudonymized_not_the_raw_user_id(): void
    {
        $this->admin();
        $learner = $this->learner();
        EntitlementTransition::create([
            'user_id' => $learner->id,
            'from_state' => null,
            'to_state' => 'trial',
            'cause' => EntitlementMachine::CAUSE_TRIAL_START,
            'at' => 1_700_000_000_000,
        ]);

        $entries = $this->getJson('/api/admin/billing')->assertOk()->json('entries');

        $expected = app(Pseudonymizer::class)->for($learner->id);
        $this->assertSame($expected, $entries[0]['subjectPseudonym']);
        $this->assertStringStartsWith('u_', $entries[0]['subjectPseudonym']);
        $this->assertNotEquals((string) $learner->id, $entries[0]['subjectPseudonym']);
    }

    /**
     * The ACTOR column is documented ("'system' or an admin user id. Never a
     * learner.") but every current call site passes the literal string
     * 'system' — `CAUSE_ADMIN_OVERRIDE` exists with no caller yet. This proves
     * the controller is ready for that day: a non-numeric actor (the only kind
     * that exists in production today) renders verbatim, and a numeric one
     * (an admin id, once a caller exists) is pseudonymized rather than leaked.
     */
    public function test_a_system_actor_renders_verbatim_a_numeric_actor_is_pseudonymized(): void
    {
        $admin = $this->admin();
        EntitlementTransition::create([
            'user_id' => $this->learner()->id,
            'from_state' => 'trial', 'to_state' => 'active',
            'cause' => EntitlementMachine::CAUSE_WEBHOOK,
            'actor' => 'system', 'at' => 1_700_000_000_000,
        ]);
        EntitlementTransition::create([
            'user_id' => $this->learner()->id,
            'from_state' => 'active', 'to_state' => 'lapsed_review_only',
            'cause' => EntitlementMachine::CAUSE_ADMIN_OVERRIDE,
            'actor' => (string) $admin->id, 'reason' => 'refund per support ticket 9911',
            'at' => 1_700_000_005_000,
        ]);

        $entries = $this->getJson('/api/admin/billing')->assertOk()->json('entries');

        // Newest first: the admin_override row (at +5s) is entries[0].
        $expected = app(Pseudonymizer::class)->for($admin->id);
        $this->assertSame($expected, $entries[0]['actor']);
        $this->assertNotEquals((string) $admin->id, $entries[0]['actor']);
        $this->assertSame('refund per support ticket 9911', $entries[0]['reason']);
        $this->assertSame('system', $entries[1]['actor']);
    }

    /**
     * `userId` filter — an operator investigating one learner's billing
     * history (from a support ticket, the same convention
     * `AdminRevealController` already established) narrows to just their rows.
     * A raw id, never a pseudonym: a pseudonym is one-way by design (edge case
     * #147) and cannot be reversed into a `user_id` to query by.
     */
    public function test_the_userid_filter_narrows_to_one_learner(): void
    {
        $this->admin();
        $a = $this->learner();
        $b = $this->learner();
        EntitlementTransition::create([
            'user_id' => $a->id, 'from_state' => null, 'to_state' => 'trial',
            'cause' => EntitlementMachine::CAUSE_TRIAL_START, 'at' => 1_700_000_000_000,
        ]);
        EntitlementTransition::create([
            'user_id' => $b->id, 'from_state' => null, 'to_state' => 'trial',
            'cause' => EntitlementMachine::CAUSE_TRIAL_START, 'at' => 1_700_000_001_000,
        ]);

        $entries = $this->getJson("/api/admin/billing?userId={$a->id}")->assertOk()->json('entries');

        $this->assertCount(1, $entries);
        $expected = app(Pseudonymizer::class)->for($a->id);
        $this->assertSame($expected, $entries[0]['subjectPseudonym']);
    }

    /** READ-ONLY BY CONSTRUCTION — mirrors AdminAuditTest/FlagAuditTest. */
    public function test_the_route_accepts_no_writes(): void
    {
        $this->admin();
        $this->postJson('/api/admin/billing', ['action' => 'forged'])->assertStatus(405);
    }

    /** Never a full-table dump — same hard cap as the other two audit viewers. */
    public function test_entries_are_capped(): void
    {
        $this->admin();
        $learner = $this->learner();
        for ($i = 0; $i < 210; $i++) {
            EntitlementTransition::create([
                'user_id' => $learner->id, 'from_state' => 'trial', 'to_state' => 'active',
                'cause' => EntitlementMachine::CAUSE_WEBHOOK, 'at' => 1_700_000_000_000 + $i,
            ]);
        }

        $response = $this->getJson('/api/admin/billing')->assertOk();
        $this->assertCount(200, $response->json('entries'));
        $this->assertSame(200, $response->json('limit'));
    }
}
