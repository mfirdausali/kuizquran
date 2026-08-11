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

    // ═════════════════ M10 SECURITY REVIEW — four findings ═════════════════════

    /**
     * FINDING S4: `AdminAudit`'s docblock says "`AdminAuditTest` asserts layer 2
     * directly and asserts that layer 1 is DOCUMENTED", and both the model and
     * the migration point at `docs/ADMIN-CONSOLE.md` for the Postgres grant.
     *
     * No such assertion existed, and the file did not exist either.
     *
     * That is not a documentation nit. The append-only guarantee has two layers,
     * and layer 1 — `REVOKE UPDATE, DELETE` on the app's role — is the only one
     * that survives a raw query, a psql session, or code that bypasses the
     * model. It CANNOT be tested from inside the app that lacks it: an
     * application holding UPDATE rights cannot prove it does not hold them. The
     * strongest available in-repo assertion is therefore that the runnable grant
     * and its verification query EXIST, so the human applying them has something
     * to apply.
     *
     * MUTATION: delete `docs/ADMIN-CONSOLE.md`, or remove the GRANT statement
     * from it. Red.
     */
    public function test_the_database_level_append_only_grant_is_documented(): void
    {
        $path = dirname(__DIR__, 3).'/docs/ADMIN-CONSOLE.md';

        $this->assertFileExists(
            $path,
            'AdminAudit and the admin migration both cite docs/ADMIN-CONSOLE.md for the '.
            'append-only grant. Layer 1 of a two-layer guarantee cannot be applied from a '.
            'document that does not exist.',
        );

        $doc = file_get_contents($path);

        // The runnable grant itself — not merely prose describing one.
        $this->assertMatchesRegularExpression(
            '/REVOKE\s+UPDATE,\s*DELETE.*ON\s+TABLE\s+admin_audit/is',
            $doc,
            'the document must carry the actual REVOKE, not a description of it',
        );
        $this->assertMatchesRegularExpression(
            '/GRANT\s+INSERT,\s*SELECT\s+ON\s+TABLE\s+admin_audit/is',
            $doc,
            'the app role still needs INSERT and SELECT, or the audit log cannot be written',
        );

        // And a way to CHECK it, since the grant cannot be asserted from here.
        $this->assertStringContainsString(
            'role_table_grants',
            $doc,
            'a grant nobody can verify is a grant nobody will notice is missing',
        );
    }

    // ═════════════════ M10 SECURITY REVIEW — three route findings ══════════════

    /**
     * FINDING S1: a reveal token was looked up BY VALUE ALONE, so it was usable
     * by any admin who obtained it, not only the one who minted it.
     *
     * Why that matters even though every admin is already allowlisted: `reveal`
     * writes exactly ONE audit row, at mint time, naming ONE actor. A second
     * operator keeping that token alive generated no row of their own, so the
     * audit log named an operator who was no longer the one holding the
     * identity — an audit-COMPLETENESS failure on the one surface whose entire
     * purpose is to make identity access reconstructable.
     *
     * Asserted as the OUTCOME a second admin observes (403 on a token that is
     * simultaneously proven still valid for its owner), never as "the query has
     * a where clause".
     *
     * MUTATION: drop `->where('admin_id', ...)` from `check()`. The second
     * admin then gets 200 and this test goes red.
     */
    public function test_a_reveal_token_is_useless_to_a_second_admin(): void
    {
        config([
            'admin.emails' => ['ops@example.com', 'ops2@example.com'],
            'admin.pseudonym_pepper' => 'test-pepper',
            'admin.reveal_ttl_seconds' => 900,
        ]);
        $first = User::factory()->create(['email' => 'ops@example.com', 'email_verified_at' => now()]);
        $second = User::factory()->create(['email' => 'ops2@example.com', 'email_verified_at' => now()]);
        $subject = User::factory()->create(['email' => 'learner@example.com']);

        Sanctum::actingAs($first);
        $token = $this->postJson("/api/admin/users/{$subject->id}/reveal", [
            'reason_code' => 'support_ticket',
            'reason_text' => 'investigating ticket 4821 about a missing session',
        ])->json('revealToken');
        $this->assertNotNull($token);

        // The SECOND admin — fully authenticated, fully allowlisted — is refused.
        Sanctum::actingAs($second);
        $this->getJson('/api/admin/reveal/'.$token)->assertStatus(403);

        // The token is genuinely still live for the admin who minted it, so the
        // 403 above is ownership and not merely an expired token.
        Sanctum::actingAs($first);
        $this->getJson('/api/admin/reveal/'.$token)->assertOk()->assertJson(['valid' => true]);
    }

    /**
     * FINDING S2: the bulk CSV export wrote NO audit row.
     *
     * The columns carry no identity, which is why it looked exempt. But stable
     * pseudonyms plus signup dates plus event counts is a complete behavioural
     * profile of the entire user base, joinable against any single previously
     * revealed identity. A bulk read of every learner is exactly the event an
     * audit log exists to record.
     *
     * MUTATION: delete the `AdminAudit::create` from `exportCsv`. Red here.
     */
    public function test_the_bulk_csv_export_is_audited(): void
    {
        $admin = $this->admin();
        User::factory()->count(3)->create();

        $this->assertSame(0, AdminAudit::count());

        $this->get('/api/admin/users/export.csv')->streamedContent();

        $row = AdminAudit::where('action', 'export_users_csv')->first();
        $this->assertNotNull($row, 'a bulk read of every learner must leave a record');
        $this->assertSame($admin->id, $row->actor_admin_id);
        // The subject is the whole table; naming one learner would be a lie.
        $this->assertNull($row->subject_pseudonym);
    }

    /**
     * FINDING S2, second half: the row is written BEFORE the stream is consumed,
     * so a dump that dies mid-flight has still been recorded. An audit log that
     * only captures COMPLETED exports is one a crash can silently empty.
     *
     * `streamDownload` defers the callback until the content is read, so
     * asserting the row exists on the returned response WITHOUT ever reading
     * the stream proves the ordering.
     */
    public function test_the_export_audit_row_precedes_the_stream(): void
    {
        $this->admin();
        User::factory()->count(2)->create();

        $this->get('/api/admin/users/export.csv');   // deliberately NOT consumed

        $this->assertSame(
            1,
            AdminAudit::where('action', 'export_users_csv')->count(),
            'the audit row must not depend on the stream being read to completion',
        );
    }
}
