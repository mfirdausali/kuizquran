<?php

namespace Tests\Feature\Admin;

use App\Models\AdminAudit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * THE STRIPE CREDENTIAL SURFACE (admin console).
 *
 * The properties under test are security properties, so they are asserted
 * rather than merely documented in the controller header. The one that matters
 * most is the first: a secret value must never appear in a response body, no
 * matter which field of the payload someone goes looking in.
 */
class StripeSettingsTest extends TestCase
{
    use RefreshDatabase;

    /** Values chosen so a leak is unambiguous when grepping a response. */
    private const FAKE_SECRET = 'sk_test_LEAKCANARY000000000000000';

    private const FAKE_WEBHOOK = 'whsec_LEAKCANARY111111111111111';

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.emails' => ['ops@example.com'], 'admin.pseudonym_pepper' => 'test-pepper']);
        config([
            'services.stripe.key' => 'pk_test_publishable000000000',
            'services.stripe.secret' => self::FAKE_SECRET,
            'services.stripe.webhook_secret' => self::FAKE_WEBHOOK,
        ]);
        Sanctum::actingAs(User::factory()->create([
            'email' => 'ops@example.com',
            'email_verified_at' => now(),
        ]));
    }

    /**
     * THE assertion of this file: no secret in the response, anywhere.
     *
     * Asserted against the RAW body rather than a named field, because the leak
     * this guards against is a future contributor adding a debug field, an echo
     * of the submitted value, or a helpful "current value" — none of which a
     * field-by-field assertion would catch.
     *
     * MUTATION: add `'value' => config('services.stripe.secret')` to any field
     * in `index()`. This test turns red; a shape-only test would not.
     */
    public function test_never_returns_a_secret_value(): void
    {
        $response = $this->getJson('/api/admin/stripe');
        $response->assertOk();

        $body = $response->getContent();
        $this->assertStringNotContainsString(self::FAKE_SECRET, $body);
        $this->assertStringNotContainsString(self::FAKE_WEBHOOK, $body);
        // The last-four fingerprint IS allowed — it confirms which key is
        // installed without being usable.
        $response->assertJsonPath('fields.1.fingerprint', '…'.substr(self::FAKE_SECRET, -4));
    }

    public function test_reports_presence_and_mode_without_exposing_values(): void
    {
        $response = $this->getJson('/api/admin/stripe');

        $response->assertOk()
            ->assertJsonPath('configured', true)
            ->assertJsonPath('mode', 'test')
            ->assertJsonPath('mixedModes', false)
            ->assertJsonPath('fields.0.env', 'STRIPE_KEY')
            ->assertJsonPath('fields.0.present', true)
            ->assertJsonPath('fields.0.validPrefix', true);
    }

    /**
     * A missing credential must read as missing, not as empty-and-fine — the
     * same principle as edge case #167's "unknown, never 0".
     */
    public function test_a_missing_credential_is_reported_as_absent(): void
    {
        config(['services.stripe.webhook_secret' => '']);

        $this->getJson('/api/admin/stripe')
            ->assertOk()
            ->assertJsonPath('configured', false)
            ->assertJsonPath('fields.2.present', false)
            ->assertJsonPath('fields.2.fingerprint', null);
    }

    /**
     * A well-formed key in the WRONG field is the most common paste error, and
     * it fails at the first real payment rather than at configuration time.
     */
    public function test_flags_a_key_with_an_unexpected_prefix(): void
    {
        config(['services.stripe.secret' => 'whsec_this_is_the_webhook_secret']);

        $this->getJson('/api/admin/stripe')
            ->assertOk()
            ->assertJsonPath('fields.1.present', true)
            ->assertJsonPath('fields.1.validPrefix', false);
    }

    /**
     * A live secret alongside a test publishable key is a real production
     * incident waiting for the first customer. It must be visible on the screen.
     */
    public function test_detects_mixed_live_and_test_credentials(): void
    {
        config([
            'services.stripe.key' => 'pk_live_publishable000000000',
            'services.stripe.secret' => 'sk_test_secret000000000',
        ]);

        $this->getJson('/api/admin/stripe')
            ->assertOk()
            ->assertJsonPath('mixedModes', true)
            ->assertJsonPath('mode', null);
    }

    /**
     * Writing credentials to the database is refused, and the refusal explains
     * itself. 501 rather than 404 so a future reader knows it was a decision.
     */
    public function test_refuses_to_persist_credentials(): void
    {
        $this->postJson('/api/admin/stripe', [
            'STRIPE_SECRET' => 'sk_live_someone_tried_to_save_this',
        ])
            ->assertStatus(501)
            ->assertJsonStructure(['error', 'why', 'howTo']);
    }

    public function test_connection_test_reports_not_configured_without_a_secret(): void
    {
        config(['services.stripe.secret' => '']);

        $this->postJson('/api/admin/stripe/test')
            ->assertStatus(422)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('reason', 'not_configured');
    }

    /**
     * An unconfigured probe short-circuits BEFORE the audit, so it writes no
     * row: there was no contact with the payment account to record.
     *
     * (Named for what it actually asserts. An earlier version of this test was
     * called `..._writes_an_audit_row` while asserting the count was UNCHANGED
     * — the assertion was right and the name was a lie, which is worse than a
     * missing test because it reads as coverage that does not exist.)
     */
    public function test_an_unconfigured_probe_writes_no_audit_row(): void
    {
        config(['services.stripe.secret' => '']);
        $before = AdminAudit::count();

        $this->postJson('/api/admin/stripe/test')->assertStatus(422);

        $this->assertSame($before, AdminAudit::count());
    }

    /** The whole surface sits behind the admin gate, like every sibling route. */
    public function test_requires_admin(): void
    {
        config(['admin.emails' => ['someone-else@example.com']]);

        $this->getJson('/api/admin/stripe')->assertForbidden();
        $this->postJson('/api/admin/stripe/test')->assertForbidden();
    }
}
