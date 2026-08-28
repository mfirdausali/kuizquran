<?php

namespace Tests\Feature\Admin;

use App\Billing\EntitlementState;
use App\Billing\EntitlementTier;
use App\Billing\WebhookHandler;
use App\Http\Controllers\Admin\Pseudonymizer;
use App\Models\BillingEvent;
use App\Models\Entitlement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * `billing_events` — the RAW webhook journal `WebhookHandler::ingest()` writes
 * on every inbound Stripe delivery — had a real writer since build-plan step 23
 * and zero readers anywhere: `grep -rln "BillingEvent::" app/Http` returned
 * nothing. `AdminBillingController` (v3-D141/D147) reads `entitlement_transitions`
 * — the DERIVED state-change log — never this table, so an operator asking
 * "Stripe says it sent evt_xxx, why didn't anything happen" had a database
 * console and nothing else even after that fix. Same shape as v3-D129/D130/
 * D141/D142, missed by all four because each looked only at the table its own
 * ticket named. See DECISIONS.md v3-D148.
 */
class BillingEventsTest extends TestCase
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

    private function entitlement(): Entitlement
    {
        $user = $this->learner();

        return Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::Active->value,
            'tier' => EntitlementTier::Monthly->value,
            'region' => 'MY',
            'provider' => 'stripe',
            'provider_customer_id' => 'cus_'.$user->id,
        ]);
    }

    /** A recorded-shape Stripe event. No fake SDK — a plain parsed array. */
    private function event(string $id, string $type, array $object, int $created = 1_700_000_000): array
    {
        return ['id' => $id, 'type' => $type, 'created' => $created, 'data' => ['object' => $object]];
    }

    public function test_the_route_requires_admin(): void
    {
        $this->getJson('/api/admin/billing/events')->assertStatus(401);

        Sanctum::actingAs($this->learner());
        $this->getJson('/api/admin/billing/events')->assertStatus(403);
    }

    /**
     * Seeds through the REAL writer — `WebhookHandler::ingest()`, the one and
     * only place `billing_events` is written — never a hand-built row shaped
     * like one, so this proves the actual wiring, not a fixture shortcut.
     */
    public function test_it_returns_entries_newest_first_through_the_real_webhook_handler(): void
    {
        $this->admin();
        $e = $this->entitlement();
        $handler = app(WebhookHandler::class);

        $handler->ingest($this->event('evt_first', 'invoice.paid', [
            'customer' => $e->provider_customer_id,
        ], 1_700_000_000));
        $handler->ingest($this->event('evt_second', 'invoice.payment_failed', [
            'customer' => $e->provider_customer_id,
        ], 1_700_000_010));

        $entries = $this->getJson('/api/admin/billing/events')->assertOk()->json('entries');

        $this->assertCount(2, $entries);
        $this->assertSame('evt_second', $entries[0]['providerEventId']);
        $this->assertSame('invoice.payment_failed', $entries[0]['type']);
        $this->assertSame('applied', $entries[0]['outcome']);
        $this->assertSame('evt_first', $entries[1]['providerEventId']);
    }

    /**
     * A delivery Stripe sends that this app deliberately does not act on
     * (`WebhookHandler::HANDLED` is a closed set) still leaves a row — that is
     * the entire point of a journal INSERTed before processing. This is
     * exactly the case the derived `entitlement_transitions` log CANNOT show,
     * because no transition is ever written for it.
     */
    public function test_an_unhandled_event_type_still_journals_with_no_subject(): void
    {
        $this->admin();
        app(WebhookHandler::class)->ingest(
            $this->event('evt_unhandled', 'payment_intent.created', ['customer' => 'cus_whoever']),
        );

        $entries = $this->getJson('/api/admin/billing/events')->assertOk()->json('entries');

        $this->assertCount(1, $entries);
        $this->assertSame('ignored_unhandled', $entries[0]['outcome']);
        $this->assertNull($entries[0]['subjectPseudonym']);
        $this->assertNull($entries[0]['error']);
    }

    /**
     * A handler that throws mid-`process()` journals `outcome: "error"` with
     * the real exception message, never silently disappears — `ingest()`'s own
     * header: "INSERT FIRST, THEN PROCESS... a crash mid-handler leaves a
     * replayable row rather than a silently-lost event." Provoked here with
     * REAL corrupted data, never a mock: a row written with an invalid raw
     * `tier` value (bypassing the model's fillable/enum validation via a
     * direct `DB::table()` insert, simulating a hand-edited or migrated-bad
     * row) throws `\ValueError` the moment `onCheckoutCompleted` reads
     * `$e->tier` through the backed-enum cast.
     */
    public function test_a_handler_exception_journals_as_error_with_the_real_message(): void
    {
        $this->admin();
        $user = $this->learner();
        \Illuminate\Support\Facades\DB::table('entitlements')->insert([
            'user_id' => $user->id,
            'state' => EntitlementState::Active->value,
            'tier' => 'not-a-real-tier',
            'region' => 'MY',
            'provider' => 'stripe',
            'provider_customer_id' => 'cus_'.$user->id,
            'state_version' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            app(WebhookHandler::class)->ingest($this->event('evt_boom', 'checkout.session.completed', [
                'customer' => 'cus_'.$user->id,
            ]));
            $this->fail('expected the handler to throw and the journal to still record it');
        } catch (\Throwable) {
            // The journal write happens inside ingest()'s catch, before rethrow —
            // asserted below, independent of this test's own try/catch.
        }

        $entries = $this->getJson('/api/admin/billing/events')->assertOk()->json('entries');
        $this->assertCount(1, $entries);
        $this->assertSame('evt_boom', $entries[0]['providerEventId']);
        $this->assertSame('error', $entries[0]['outcome']);
        $this->assertNotNull($entries[0]['error']);
    }

    /**
     * SUBJECT PSEUDONYMIZATION — `billing_events.user_id` is a raw, nullable
     * FK at write time (resolved by customer id, never pseudonymized until
     * now). Returning it verbatim would be a second billing screen that
     * deanonymizes a learner, on top of the one v3-D141/D147 already guards.
     */
    public function test_the_subject_is_pseudonymized_not_the_raw_user_id(): void
    {
        $this->admin();
        $e = $this->entitlement();
        app(WebhookHandler::class)->ingest($this->event('evt_pseudo', 'invoice.paid', [
            'customer' => $e->provider_customer_id,
        ]));

        $entries = $this->getJson('/api/admin/billing/events')->assertOk()->json('entries');

        $expected = app(Pseudonymizer::class)->for($e->user_id);
        $this->assertSame($expected, $entries[0]['subjectPseudonym']);
        $this->assertStringStartsWith('u_', $entries[0]['subjectPseudonym']);
        $this->assertNotEquals((string) $e->user_id, $entries[0]['subjectPseudonym']);
    }

    /** The `userId` filter — a raw id from a support ticket, never a pseudonym
     *  (one-way by design, edge case #147), same convention every other admin
     *  audit viewer already uses. */
    public function test_the_userid_filter_narrows_to_one_learner(): void
    {
        $this->admin();
        $mine = $this->entitlement();
        $other = $this->entitlement();
        $handler = app(WebhookHandler::class);
        $handler->ingest($this->event('evt_mine', 'invoice.paid', ['customer' => $mine->provider_customer_id]));
        $handler->ingest($this->event('evt_other', 'invoice.paid', ['customer' => $other->provider_customer_id]));

        $entries = $this->getJson("/api/admin/billing/events?userId={$mine->user_id}")->assertOk()->json('entries');

        $this->assertCount(1, $entries);
        $this->assertSame('evt_mine', $entries[0]['providerEventId']);
    }

    /** The `outcome` filter — an operator triaging failures narrows straight
     *  to `outcome=error` rather than scrolling a mixed 200-row list. */
    public function test_the_outcome_filter_narrows_to_one_outcome(): void
    {
        $this->admin();
        app(WebhookHandler::class)->ingest(
            $this->event('evt_ok', 'invoice.paid', ['customer' => $this->entitlement()->provider_customer_id]),
        );
        app(WebhookHandler::class)->ingest($this->event('evt_skip', 'payment_intent.created', []));

        $entries = $this->getJson('/api/admin/billing/events?outcome=ignored_unhandled')->assertOk()->json('entries');

        $this->assertCount(1, $entries);
        $this->assertSame('evt_skip', $entries[0]['providerEventId']);
    }

    /**
     * The raw `payload` column is DELIBERATELY never returned — it is the
     * verified Stripe event verbatim and can carry a customer's email or
     * billing address. This is the one assertion protecting that scope
     * decision from silent drift.
     */
    public function test_the_raw_payload_is_never_returned(): void
    {
        $this->admin();
        app(WebhookHandler::class)->ingest($this->event('evt_shape', 'invoice.paid', [
            'customer' => $this->entitlement()->provider_customer_id,
            'receipt_email' => 'should-never-leave-the-server@example.com',
        ]));

        $entries = $this->getJson('/api/admin/billing/events')->assertOk()->json('entries');

        $this->assertArrayNotHasKey('payload', $entries[0]);
        $body = $this->getJson('/api/admin/billing/events')->getContent();
        $this->assertStringNotContainsString('should-never-leave-the-server', $body);
    }

    /** A duplicate delivery (Stripe's own retry behavior, edge case #118) is
     *  `insertOrIgnore`d — exactly one journal row survives, never two. */
    public function test_a_duplicate_delivery_journals_once(): void
    {
        $this->admin();
        $e = $this->entitlement();
        $ev = $this->event('evt_dup', 'invoice.paid', ['customer' => $e->provider_customer_id]);
        $handler = app(WebhookHandler::class);
        $handler->ingest($ev);
        $handler->ingest($ev);

        $this->assertSame(1, BillingEvent::where('provider_event_id', 'evt_dup')->count());
        $entries = $this->getJson('/api/admin/billing/events')->assertOk()->json('entries');
        $this->assertCount(1, $entries);
    }
}
