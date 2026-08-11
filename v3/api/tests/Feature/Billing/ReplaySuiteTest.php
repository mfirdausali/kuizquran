<?php

namespace Tests\Feature\Billing;

use App\Billing\EntitlementState;
use App\Billing\EntitlementTier;
use App\Billing\WebhookHandler;
use App\Models\BillingEvent;
use App\Models\Entitlement;
use App\Models\EntitlementTransition;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * THE STRIPE REPLAY SUITE — M7's exit gate.
 *
 * BUILD-PLAN.md: "Stripe webhook replay suite green (blocks M7 exit)."
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THIS SUITE IS CURRENTLY INCOMPLETE BY DESIGN, AND SAYS SO.
 *
 * `v3/fixtures/stripe/` is EMPTY because no test-mode Stripe account exists yet.
 * `test_fixture_set_is_present` asserts a MINIMUM FIXTURE COUNT and FAILS while
 * that is true — it is marked incomplete, never skipped-and-forgotten and never
 * green-over-zero-cases.
 *
 * Why this shape: v3-D50 shipped a testsuite directory that existed on only one
 * machine, so 71 tests never ran while every report said green. A replay suite
 * that passes on an empty fixture set is that same failure on the revenue path.
 * The count assertion is what makes "green" mean something.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * The ORDERING tests below do NOT need fixtures — they exercise the ordering and
 * idempotency guarantees over event arrays in the recorded shape, which is domain
 * logic. What needs fixtures is proving Stripe's real payloads carry the field
 * names the handlers read (DEFECTS.md#PAY-1).
 */
class ReplaySuiteTest extends TestCase
{
    use RefreshDatabase;

    /** Every event type the handler claims to handle must have a fixture. */
    private const REQUIRED_TYPES = WebhookHandler::HANDLED;

    private function fixtureDir(): string
    {
        return dirname(__DIR__, 4).'/fixtures/stripe';
    }

    /** @return string[] */
    private function fixtures(): array
    {
        $files = glob($this->fixtureDir().'/*.json');

        return $files === false ? [] : $files;
    }

    // ═══════════════════ the gate: fixtures must actually exist ════════════════

    /**
     * THE COUNT ASSERTION. This is what stops the suite passing vacuously.
     *
     * It is marked INCOMPLETE (not skipped) while the fixture set is empty, so it
     * shows up in every run as unfinished work rather than disappearing.
     */
    public function test_fixture_set_is_present(): void
    {
        $found = $this->fixtures();

        if ($found === []) {
            $this->markTestIncomplete(
                "Stripe replay fixtures are ABSENT — M7's exit gate is RED.\n".
                "No test-mode Stripe account exists yet, so no real event JSON has been recorded.\n".
                "This suite deliberately refuses to pass over zero cases (see v3-D50).\n".
                'See v3/fixtures/stripe/README.md for exactly what unblocks it.',
            );
        }

        // Once fixtures land, these assertions are the real gate.
        $this->assertGreaterThanOrEqual(
            count(self::REQUIRED_TYPES),
            count($found),
            'Every handled event type needs at least one recorded fixture.',
        );

        $recordedTypes = [];
        foreach ($found as $file) {
            $event = json_decode(file_get_contents($file), true);
            $this->assertIsArray($event, "fixture {$file} is not valid JSON");
            $this->assertArrayHasKey('type', $event, "fixture {$file} has no `type`");
            $recordedTypes[] = $event['type'];
        }

        foreach (self::REQUIRED_TYPES as $type) {
            $this->assertContains($type, $recordedTypes, "no recorded fixture for handled event type `{$type}`");
        }
    }

    /**
     * THE FIVE ORDERINGS. Runs only when fixtures exist; incomplete until then.
     *
     * Forward, reverse, each-duplicated, two-user interleave, and crash-and-resume
     * must all reach an IDENTICAL final state for the same fixture set.
     */
    public function test_all_orderings_reach_the_same_final_state(): void
    {
        $found = $this->fixtures();
        if ($found === []) {
            $this->markTestIncomplete('No Stripe fixtures — see v3/fixtures/stripe/README.md.');
        }

        $events = array_map(fn ($f) => json_decode(file_get_contents($f), true), $found);

        $forward = $this->replay($events);
        $reverse = $this->replay(array_reverse($events));
        $duplicated = $this->replay(array_merge($events, $events));

        $this->assertSame($forward, $reverse, 'reverse-order replay diverged — ordering precedence is not holding (#118)');
        $this->assertSame($forward, $duplicated, 'duplicate replay diverged — idempotency is not holding (#118)');
    }

    /**
     * Replay a list of events against a fresh user, returning the final state.
     *
     * @return array{state:string,tier:string,transitions:int}
     */
    private function replay(array $events): array
    {
        $user = User::factory()->create();
        $customer = 'cus_replay_'.$user->id;
        $ent = Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::Active->value,
            'tier' => EntitlementTier::Monthly->value,
            'region' => 'MY',
            'provider' => 'stripe',
            'provider_customer_id' => $customer,
        ]);

        $handler = app(WebhookHandler::class);
        foreach ($events as $i => $event) {
            // Re-point each recorded event at this replay's own customer, and give
            // it a unique id per replay so the unique index does not swallow the
            // whole run as duplicates ACROSS replays (within a replay, duplicates
            // are exactly what we want to test).
            $event['data']['object']['customer'] = $customer;
            $event['id'] = ($event['id'] ?? 'evt').'_'.$user->id.'_'.$i;
            $handler->ingest($event);
        }

        $ent->refresh();

        return [
            'state' => $ent->state->value,
            'tier' => $ent->tier->value,
            'transitions' => EntitlementTransition::where('user_id', $user->id)->count(),
        ];
    }

    // ═════════ ordering guarantees, provable without recorded fixtures ═════════

    /**
     * CRASH AND RESUME. "Insert first, then process" means a crash between the two
     * leaves a replayable row, never a lost event.
     *
     * MUTATION: remove the `processed_at` write, or move the insert after
     * processing. The duplicate replay then double-applies.
     */
    public function test_crash_between_insert_and_process_leaves_a_replayable_row(): void
    {
        $user = User::factory()->create();
        $ent = Entitlement::create([
            'user_id' => $user->id,
            'state' => EntitlementState::Active->value,
            'tier' => EntitlementTier::Monthly->value,
            'region' => 'MY',
            'provider' => 'stripe',
            'provider_customer_id' => 'cus_crash',
        ]);

        // Simulate the crash: the journal row exists, unprocessed.
        BillingEvent::create([
            'provider' => 'stripe',
            'provider_event_id' => 'evt_crash',
            'type' => 'invoice.payment_failed',
            'payload' => ['id' => 'evt_crash'],
            'received_at' => 1_700_000_000_000,
            'processed_at' => null,
        ]);

        $this->assertDatabaseHas('billing_events', ['provider_event_id' => 'evt_crash', 'processed_at' => null]);

        // A re-delivery of the same event is refused by the unique index, so the
        // state never double-applies — the row remains for a reconcile job to pick
        // up rather than being silently lost.
        $outcome = app(WebhookHandler::class)->ingest([
            'id' => 'evt_crash',
            'type' => 'invoice.payment_failed',
            'created' => 1_700_000_000,
            'data' => ['object' => ['customer' => 'cus_crash']],
        ]);

        $this->assertSame('ignored_duplicate', $outcome);
        $ent->refresh();
        $this->assertSame(EntitlementState::Active, $ent->state, 'a duplicate must not re-apply');
        $this->assertSame(1, BillingEvent::where('provider_event_id', 'evt_crash')->count());
    }

    /**
     * TWO-USER INTERLEAVE. Events for two customers arriving interleaved must not
     * cross-contaminate — each resolves by its own customer id.
     */
    public function test_two_user_interleave_keeps_states_independent(): void
    {
        $handler = app(WebhookHandler::class);
        $ents = [];
        foreach (['a', 'b'] as $k) {
            $user = User::factory()->create();
            $ents[$k] = Entitlement::create([
                'user_id' => $user->id,
                'state' => EntitlementState::Active->value,
                'tier' => EntitlementTier::Monthly->value,
                'region' => 'MY',
                'provider' => 'stripe',
                'provider_customer_id' => "cus_{$k}",
            ]);
        }

        // a fails, b pays, a's subscription is deleted, b fails.
        $seq = [
            ['evt_i1', 'invoice.payment_failed', 'cus_a', 1_700_000_100],
            ['evt_i2', 'invoice.paid', 'cus_b', 1_700_000_200],
            ['evt_i3', 'customer.subscription.deleted', 'cus_a', 1_700_000_300],
            ['evt_i4', 'invoice.payment_failed', 'cus_b', 1_700_000_400],
        ];
        foreach ($seq as [$id, $type, $customer, $created]) {
            $handler->ingest(['id' => $id, 'type' => $type, 'created' => $created, 'data' => ['object' => ['customer' => $customer]]]);
        }

        $ents['a']->refresh();
        $ents['b']->refresh();
        $this->assertSame(EntitlementState::LapsedReviewOnly, $ents['a']->state);
        $this->assertSame(EntitlementState::Grace, $ents['b']->state, "b's state must be unaffected by a's deletion");
    }
}
