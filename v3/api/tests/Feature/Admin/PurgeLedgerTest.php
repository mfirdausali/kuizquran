<?php

namespace Tests\Feature\Admin;

use App\Console\Commands\PurgeDueAccountsCommand;
use App\Http\Controllers\Admin\Pseudonymizer;
use App\Models\AccountDeletionRequest;
use App\Models\PurgeLedgerEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * THE PDPA PURGE LEDGER VIEWER — the read half of `purge_ledger`, never
 * built. `purge_ledger` is written every night by `pdpa:purge-due` whenever
 * an elapsed deletion request is hard-purged, and read by nothing under
 * `app/` except `BackupRestoreDrillCommand`'s own internal reconciliation —
 * no admin-facing route has ever existed. Same "built + populated + zero
 * read surface" shape v3-D129/D130/D141 each closed for
 * `admin_audit`/`flag_ramp_audit`/`entitlement_transitions`.
 */
class PurgeLedgerTest extends TestCase
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

    /**
     * Seeds a real purged row through the REAL command (`pdpa:purge-due`),
     * the one and only writer of this table — never a hand-built row shaped
     * like one, matching AdminBillingTest's own discipline for the same
     * reason. The command stamps `purged_at_ms` with its OWN `now()`, never
     * a caller-supplied value (see `PurgeDueAccountsCommand::handle()`), so
     * this returns what the command actually wrote rather than assuming a
     * fixture timestamp survives the real write path.
     */
    private function purgeOneLearner(): array
    {
        $doomed = User::factory()->create();
        $doomedId = $doomed->id;
        $pastMs = (int) round(microtime(true) * 1000) - 60_000;

        AccountDeletionRequest::create([
            'user_id' => $doomedId,
            'token_hash' => hash('sha256', 'whatever-'.$doomedId),
            'requested_at_ms' => $pastMs,
            'purge_at_ms' => $pastMs, // already elapsed
        ]);

        $this->artisan(PurgeDueAccountsCommand::class)->assertSuccessful();

        $ledgerRow = PurgeLedgerEntry::where('user_id', $doomedId)->firstOrFail();

        return [$doomedId, $ledgerRow->purged_at_ms];
    }

    public function test_the_route_requires_admin(): void
    {
        $this->getJson('/api/admin/purge-ledger')->assertStatus(401);

        $learner = User::factory()->create();
        Sanctum::actingAs($learner);
        $this->getJson('/api/admin/purge-ledger')->assertStatus(403);
    }

    public function test_it_returns_entries_newest_first_through_the_real_purge_command(): void
    {
        $this->admin();
        [$firstId, $firstPurgedAtMs] = $this->purgeOneLearner();
        [$secondId, $secondPurgedAtMs] = $this->purgeOneLearner();

        $entries = $this->getJson('/api/admin/purge-ledger')->assertOk()->json('entries');

        $this->assertCount(2, $entries);
        $expectedSecond = app(Pseudonymizer::class)->for($secondId);
        $expectedFirst = app(Pseudonymizer::class)->for($firstId);
        // Ordered by (purged_at_ms, id) DESC — the second purge is never
        // BEFORE the first (both stamp the command's own real `now()`), and
        // ties at millisecond resolution are broken by the later row's
        // higher id, so "newest first" holds even on a fast test run.
        $this->assertGreaterThanOrEqual($firstPurgedAtMs, $secondPurgedAtMs);
        $this->assertSame($expectedSecond, $entries[0]['subjectPseudonym']);
        $this->assertSame($secondPurgedAtMs, $entries[0]['purgedAtMs']);
        $this->assertSame('pdpa_delete', $entries[0]['reason']);
        $this->assertSame($expectedFirst, $entries[1]['subjectPseudonym']);
    }

    /**
     * SUBJECT PSEUDONYMIZATION. `purge_ledger.user_id` is a raw integer at
     * write time (the migration deliberately has no FK — the user row is
     * already gone). This is the first surface that ever renders it to a
     * human, so returning it verbatim would be the one screen that
     * deanonymizes a purged learner to every admin who can load it.
     */
    public function test_the_subject_is_pseudonymized_not_the_raw_user_id(): void
    {
        $this->admin();
        [$purgedId] = $this->purgeOneLearner();

        $entries = $this->getJson('/api/admin/purge-ledger')->assertOk()->json('entries');

        $expected = app(Pseudonymizer::class)->for($purgedId);
        $this->assertSame($expected, $entries[0]['subjectPseudonym']);
        $this->assertStringStartsWith('u_', $entries[0]['subjectPseudonym']);
        $this->assertNotEquals((string) $purgedId, $entries[0]['subjectPseudonym']);
    }

    /**
     * `userId` filter — an operator confirming one specific purge (from a
     * support ticket or a restore-reconciliation question) narrows to just
     * that row. A raw id, never a pseudonym: pseudonyms are one-way by
     * design (edge case #147) and cannot be reversed into a `user_id` to
     * query by — same convention `AdminBillingController` already
     * established.
     */
    public function test_the_userid_filter_narrows_to_one_purge(): void
    {
        $this->admin();
        [$a] = $this->purgeOneLearner();
        $this->purgeOneLearner();

        $entries = $this->getJson("/api/admin/purge-ledger?userId={$a}")->assertOk()->json('entries');

        $this->assertCount(1, $entries);
        $expected = app(Pseudonymizer::class)->for($a);
        $this->assertSame($expected, $entries[0]['subjectPseudonym']);
    }

    /** READ-ONLY BY CONSTRUCTION — mirrors every other admin audit viewer. */
    public function test_the_route_accepts_no_writes(): void
    {
        $this->admin();
        $this->postJson('/api/admin/purge-ledger', ['action' => 'forged'])->assertStatus(405);
    }

    /** Never a full-table dump — same hard cap as every other audit viewer. */
    public function test_entries_are_capped(): void
    {
        $this->admin();
        for ($i = 0; $i < 210; $i++) {
            $user = User::factory()->create();
            PurgeLedgerEntry::create([
                'user_id' => $user->id,
                'purged_at_ms' => 1_700_000_000_000 + $i,
                'reason' => 'pdpa_delete',
            ]);
        }

        $response = $this->getJson('/api/admin/purge-ledger')->assertOk();
        $this->assertCount(200, $response->json('entries'));
        $this->assertSame(200, $response->json('limit'));
    }

    /** No entries anywhere must render an empty list, never a crash. */
    public function test_no_purges_yet_renders_an_empty_list(): void
    {
        $this->admin();

        $response = $this->getJson('/api/admin/purge-ledger')->assertOk();
        $this->assertSame([], $response->json('entries'));
    }
}
