<?php

namespace Tests\Feature\Admin;

use App\Http\Controllers\Admin\Pseudonymizer;
use App\Models\AdminAudit;
use App\Models\AdminRevealToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Build-plan step 24 (M8). PRIVACY: pseudonyms, reveal, audit, CSV.
 *
 * WIREFRAME §16: "Every learner is pseudonymous everywhere (`u_7f3a…`). Email and
 * name sit behind a Reveal identity action requiring a typed reason, audit-logged,
 * auto-re-masking after 15 minutes. Bulk CSV exports strip identity entirely."
 */
class AdminPrivacyTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        config([
            'admin.emails' => ['ops@example.com'],
            'admin.pseudonym_pepper' => 'test-pepper',
        ]);
        $admin = User::factory()->create(['email' => 'ops@example.com', 'email_verified_at' => now()]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    // ───────────────────────────── pseudonyms ──────────────────────────────────

    public function test_pseudonyms_are_stable_and_not_the_raw_id(): void
    {
        config(['admin.pseudonym_pepper' => 'test-pepper']);
        $p = app(Pseudonymizer::class);

        $this->assertSame($p->for(42), $p->for(42), 'stable across calls, so support threads correlate');
        $this->assertNotSame($p->for(42), $p->for(43));
        $this->assertStringStartsWith('u_', $p->for(42));
        $this->assertStringNotContainsString('42', substr($p->for(42), 2));
    }

    /**
     * An unset pepper must THROW, never silently produce a reversible digest.
     *
     * MUTATION: fall back to an empty pepper instead of throwing. Pseudonyms then
     * become brute-forceable over small integer user ids — a privacy failure that
     * looks like it works.
     */
    public function test_a_missing_pepper_throws_rather_than_degrading(): void
    {
        config(['admin.pseudonym_pepper' => '']);

        $this->expectException(\RuntimeException::class);
        app(Pseudonymizer::class)->for(1);
    }

    /** Different peppers must give different pseudonyms — the pepper is load-bearing. */
    public function test_the_pepper_actually_changes_the_output(): void
    {
        config(['admin.pseudonym_pepper' => 'pepper-a']);
        $a = app(Pseudonymizer::class)->for(7);
        config(['admin.pseudonym_pepper' => 'pepper-b']);
        $b = app(Pseudonymizer::class)->for(7);

        $this->assertNotSame($a, $b);
    }

    // ─────────────────────────────── reveal ────────────────────────────────────

    public function test_reveal_requires_a_structured_reason_code_and_typed_text(): void
    {
        $this->admin();
        $subject = User::factory()->create(['email' => 'learner@example.com']);

        $this->postJson("/api/admin/users/{$subject->id}/reveal", [])->assertStatus(422);

        $this->postJson("/api/admin/users/{$subject->id}/reveal", [
            'reason_code' => 'not_a_real_code',
            'reason_text' => 'a sufficiently long reason',
        ])->assertStatus(422);

        $this->postJson("/api/admin/users/{$subject->id}/reveal", [
            'reason_code' => 'support_ticket',
            'reason_text' => 'short',
        ])->assertStatus(422);

        $this->assertSame(0, AdminAudit::count(), 'a rejected reveal must not write an audit row');
    }

    public function test_a_valid_reveal_returns_identity_and_writes_an_audit_row(): void
    {
        $admin = $this->admin();
        $subject = User::factory()->create(['email' => 'learner@example.com', 'name' => 'Test Learner']);

        $response = $this->postJson("/api/admin/users/{$subject->id}/reveal", [
            'reason_code' => 'support_ticket',
            'reason_text' => 'investigating ticket 4821 about a missing session',
        ]);

        $response->assertOk();
        $this->assertSame('learner@example.com', $response->json('identity.email'));

        $audit = AdminAudit::first();
        $this->assertNotNull($audit);
        $this->assertSame('reveal_identity', $audit->action);
        $this->assertSame($admin->id, $audit->actor_admin_id);
        $this->assertSame('support_ticket', $audit->reason_code);
        // The audit references the PSEUDONYM, never the email.
        $this->assertStringStartsWith('u_', $audit->subject_pseudonym);
        $this->assertStringNotContainsString('learner@example.com', json_encode($audit->toArray()));
    }

    /**
     * EDGE CASE #148: "reveal on an anonymous account returns a defined response
     * and IS STILL AUDITED."
     *
     * MUTATION: return 404 instead of the defined response. A 404 would (a) leak
     * that the account is anonymous and (b) let an operator probe every user id
     * without leaving a trace.
     */
    public function test_revealing_an_anonymous_account_is_defined_and_still_audited(): void
    {
        $this->admin();
        $anon = User::factory()->create(['email' => null, 'is_anonymous' => true]);

        $response = $this->postJson("/api/admin/users/{$anon->id}/reveal", [
            'reason_code' => 'abuse_report',
            'reason_text' => 'checking a report about automated submissions',
        ]);

        $response->assertOk();
        $this->assertNull($response->json('identity'));
        $this->assertSame('anonymous — no identity held', $response->json('reason'));
        $this->assertSame(1, AdminAudit::count(), '#148: an anonymous reveal is STILL audited');
    }

    /**
     * EDGE CASE #147: the TTL is SERVER-SIDE.
     *
     * MUTATION: honour a client-supplied `expires_at`. This test forges a
     * far-future client expiry and asserts the server ignores it.
     */
    public function test_the_reveal_ttl_is_server_side_and_a_client_expiry_is_ignored(): void
    {
        $this->admin();
        config(['admin.reveal_ttl_seconds' => 900]);
        $subject = User::factory()->create(['email' => 'learner@example.com']);

        $response = $this->postJson("/api/admin/users/{$subject->id}/reveal", [
            'reason_code' => 'support_ticket',
            'reason_text' => 'investigating ticket 4821 about a missing session',
            // A forged client expiry, 100 years out.
            'expires_at' => (int) round(microtime(true) * 1000) + (100 * 365 * 86400 * 1000),
        ]);

        $token = AdminRevealToken::where('token', $response->json('revealToken'))->first();
        $nowMs = (int) round(microtime(true) * 1000);

        $this->assertLessThanOrEqual($nowMs + (900 * 1000) + 5000, $token->expires_at, '#147: the server sets the TTL, never the client');

        // And an expired token is refused on re-check.
        $token->update(['expires_at' => $nowMs - 1]);
        $this->getJson('/api/admin/reveal/'.$token->token)->assertStatus(403);
    }

    /**
     * EDGE CASE #149: free text is scanned for PII and the operator is WARNED,
     * because an append-only row holding a real name is unpurgeable.
     */
    public function test_pii_in_the_reason_text_is_detected_and_warned(): void
    {
        $this->admin();
        $subject = User::factory()->create(['email' => 'learner@example.com']);

        $response = $this->postJson("/api/admin/users/{$subject->id}/reveal", [
            'reason_code' => 'support_ticket',
            'reason_text' => 'ticket from ahmad.faiz@gmail.com about a missing session',
        ]);

        $response->assertStatus(422);
        $this->assertContains('email-shaped string', $response->json('detected'));
        $this->assertSame(0, AdminAudit::count());

        // An explicit acknowledgement lets it through — a visible, reviewable act.
        $this->postJson("/api/admin/users/{$subject->id}/reveal", [
            'reason_code' => 'support_ticket',
            'reason_text' => 'ticket from ahmad.faiz@gmail.com about a missing session',
            'acknowledge_pii_warning' => true,
        ])->assertOk();
    }

    public function test_the_free_text_scanner_detects_each_pii_shape(): void
    {
        $this->assertContains('email-shaped string', AdminAudit::scanFreeText('mail me at a@b.co'));
        $this->assertContains('name-shaped string', AdminAudit::scanFreeText('spoke to Ahmad Faiz today'));
        $this->assertContains('MyKad-shaped identifier', AdminAudit::scanFreeText('ic 880101-14-5501'));
        $this->assertSame([], AdminAudit::scanFreeText('ticket 4821, user u_7f3a19bc, missing session'));
    }

    // ──────────────────────── append-only audit ────────────────────────────────

    /**
     * The audit is APPEND-ONLY.
     *
     * MUTATION: remove the `updating`/`deleting` guards from the model.
     */
    public function test_an_audit_row_can_never_be_updated_or_deleted(): void
    {
        $admin = $this->admin();
        $row = AdminAudit::create([
            'actor_admin_id' => $admin->id,
            'action' => 'reveal_identity',
            'subject_pseudonym' => 'u_abc123',
            'reason_code' => 'support_ticket',
            'reason_text' => 'a legitimate reason',
            'at' => 1_700_000_000_000,
        ]);

        try {
            $row->update(['reason_text' => 'a rewritten reason']);
            $this->fail('an audit row must never be updatable — an editable audit log is not an audit log');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('APPEND-ONLY', $e->getMessage());
        }

        try {
            $row->delete();
            $this->fail('an audit row must never be deletable');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('APPEND-ONLY', $e->getMessage());
        }

        $this->assertSame('a legitimate reason', AdminAudit::find($row->id)->reason_text);
    }

    // ─────────────────────────── CSV export ────────────────────────────────────

    /**
     * §16: "Bulk CSV exports strip identity entirely."
     *
     * MUTATION: add an email column to `AdminUsersController::COLUMNS` and emit it.
     *
     * Asserts the emails are ABSENT FROM THE BYTES, not merely that a header is
     * missing — a column emitted without a header still leaks.
     */
    public function test_the_csv_export_contains_no_identity_whatsoever(): void
    {
        $this->admin();
        User::factory()->create(['email' => 'leaky@example.com', 'name' => 'Leaky McLeakface']);
        User::factory()->create(['email' => 'second@example.com', 'name' => 'Second Person']);

        $response = $this->get('/api/admin/users/export.csv');
        $response->assertOk();
        $csv = $response->streamedContent();

        $this->assertStringNotContainsString('leaky@example.com', $csv);
        $this->assertStringNotContainsString('second@example.com', $csv);
        $this->assertStringNotContainsString('Leaky McLeakface', $csv);
        $this->assertStringNotContainsString('Second Person', $csv);
        $this->assertStringNotContainsString('ops@example.com', $csv);
        $this->assertStringNotContainsString('@', $csv, 'no email-shaped string may appear anywhere in a bulk export');

        // And it is genuinely producing rows, so the assertions above are not
        // passing because the export is empty.
        $this->assertStringContainsString('pseudonym', $csv);
        $this->assertSame(4, substr_count(trim($csv), "\n") + 1, 'header + 3 users');
        $this->assertStringContainsString('u_', $csv);
    }

    /** There is no parameter that can turn identity back on. */
    public function test_no_query_parameter_can_reintroduce_identity(): void
    {
        $this->admin();
        User::factory()->create(['email' => 'leaky@example.com']);

        foreach (['include_emails=1', 'identity=true', 'reveal=1', 'full=1'] as $param) {
            $csv = $this->get('/api/admin/users/export.csv?'.$param)->streamedContent();
            $this->assertStringNotContainsString('leaky@example.com', $csv, "`{$param}` must not reintroduce identity");
        }
    }
}
