<?php

namespace Tests\Feature\Billing;

use App\Billing\StripeSignature;
use App\Models\Entitlement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Webhook signature verification — the one part of the Stripe integration that is
 * genuinely COMPLETE today (v3-D56), because the scheme is offline HMAC-SHA256
 * and needs no account and no network.
 */
class StripeSignatureTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'whsec_test_deadbeefcafe';

    public function test_a_correctly_signed_payload_verifies(): void
    {
        $payload = '{"id":"evt_1","type":"invoice.paid"}';
        $now = 1_700_000_000;
        $header = StripeSignature::sign($payload, self::SECRET, $now);

        $this->assertTrue(StripeSignature::verify($payload, $header, self::SECRET, $now));
    }

    /** MUTATION: verify a payload against a different secret. */
    public function test_a_wrong_secret_fails(): void
    {
        $payload = '{"id":"evt_1"}';
        $now = 1_700_000_000;
        $header = StripeSignature::sign($payload, self::SECRET, $now);

        $this->assertFalse(StripeSignature::verify($payload, $header, 'whsec_other', $now));
    }

    /** A single byte changed in the body must invalidate the signature. */
    public function test_a_tampered_payload_fails(): void
    {
        $payload = '{"id":"evt_1","amount":100}';
        $now = 1_700_000_000;
        $header = StripeSignature::sign($payload, self::SECRET, $now);

        $tampered = '{"id":"evt_1","amount":900}';
        $this->assertFalse(StripeSignature::verify($tampered, $header, self::SECRET, $now));
    }

    /** A captured webhook re-POSTed later must not pass — the replay window. */
    public function test_an_old_signature_is_outside_the_tolerance(): void
    {
        $payload = '{"id":"evt_1"}';
        $signedAt = 1_700_000_000;
        $header = StripeSignature::sign($payload, self::SECRET, $signedAt);

        $this->assertFalse(
            StripeSignature::verify($payload, $header, self::SECRET, $signedAt + 3600),
            'a replayed hour-old signature must be refused',
        );
        $this->assertTrue(StripeSignature::verify($payload, $header, self::SECRET, $signedAt + 60));
    }

    public function test_a_malformed_or_empty_header_fails(): void
    {
        $payload = '{}';
        foreach (['', 'garbage', 't=1700000000', 'v1=abc'] as $header) {
            $this->assertFalse(StripeSignature::verify($payload, $header, self::SECRET, 1_700_000_000), "header `{$header}` must not verify");
        }
    }

    /** An unset secret must FAIL CLOSED, never accept everything. */
    public function test_an_empty_secret_fails_closed(): void
    {
        $payload = '{}';
        $header = StripeSignature::sign($payload, '', 1_700_000_000);

        $this->assertFalse(StripeSignature::verify($payload, $header, '', 1_700_000_000));
    }

    // ───────────────────────── the route, end to end ───────────────────────────

    public function test_the_webhook_route_rejects_an_invalid_signature(): void
    {
        config(['services.stripe.webhook_secret' => self::SECRET]);

        $response = $this->call(
            'POST',
            '/api/billing/stripe/webhook',
            [], [], [],
            ['HTTP_STRIPE_SIGNATURE' => 't=1,v1=bad', 'CONTENT_TYPE' => 'application/json'],
            '{"id":"evt_1","type":"invoice.paid"}',
        );

        $response->assertStatus(400);
    }

    public function test_the_webhook_route_accepts_a_valid_signature(): void
    {
        config(['services.stripe.webhook_secret' => self::SECRET]);

        $user = User::factory()->create();
        Entitlement::create([
            'user_id' => $user->id,
            'state' => 'active',
            'tier' => 'monthly',
            'region' => 'MY',
            'provider' => 'stripe',
            'provider_customer_id' => 'cus_route',
        ]);

        $payload = json_encode([
            'id' => 'evt_route_1',
            'type' => 'invoice.payment_failed',
            'created' => time(),
            'data' => ['object' => ['customer' => 'cus_route']],
        ]);
        $header = StripeSignature::sign($payload, self::SECRET, time());

        $response = $this->call(
            'POST',
            '/api/billing/stripe/webhook',
            [], [], [],
            ['HTTP_STRIPE_SIGNATURE' => $header, 'CONTENT_TYPE' => 'application/json'],
            $payload,
        );

        $response->assertOk();
        $this->assertDatabaseHas('entitlements', ['user_id' => $user->id, 'state' => 'grace']);
    }

    /**
     * An UNCONFIGURED secret must not mean "accept everything" — that would make
     * the endpoint a public remote control for the entitlement state machine.
     */
    public function test_an_unconfigured_secret_refuses_service(): void
    {
        config(['services.stripe.webhook_secret' => null]);

        $response = $this->call(
            'POST',
            '/api/billing/stripe/webhook',
            [], [], [],
            ['HTTP_STRIPE_SIGNATURE' => 't=1,v1=x', 'CONTENT_TYPE' => 'application/json'],
            '{"id":"e"}',
        );

        $response->assertStatus(503);
    }
}
