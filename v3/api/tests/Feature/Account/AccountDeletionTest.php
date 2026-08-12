<?php

namespace Tests\Feature\Account;

use App\Console\Commands\PurgeDueAccountsCommand;
use App\Models\AccountDeletionRequest;
use App\Models\AdminRole;
use App\Models\Event;
use App\Models\PurgeLedgerEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Build-plan step 23 (M7): "PDPA export/delete/restore(-with-token) + purge
 * cascades" — LAUNCH-CHECKLIST.md gate 19, which named this the "only
 * remaining *code* gate on this list that is a legal exposure rather than a
 * quality one" because no purge path existed anywhere in `api/app`.
 *
 * Mirrors `BackupRestoreDrillCommand`'s own fixture shape (a keeper who must
 * survive untouched, a doomed subject who must not) throughout, since that
 * command already exercises the reconciliation half of this feature and this
 * suite is what proves the endpoint it was written in anticipation of.
 */
class AccountDeletionTest extends TestCase
{
    use RefreshDatabase;

    // ─────────────────────────── auth boundary ──────────────────────────────

    public function test_every_account_route_requires_authentication(): void
    {
        $this->getJson('/api/account/export')->assertStatus(401);
        $this->getJson('/api/account/deletion')->assertStatus(401);
        $this->postJson('/api/account/deletion')->assertStatus(401);
        $this->postJson('/api/account/deletion/restore', ['token' => 'x'])->assertStatus(401);
    }

    // ──────────────────────────────── export ────────────────────────────────

    public function test_export_returns_only_the_callers_own_data(): void
    {
        $me = User::factory()->create(['email' => 'me@example.com', 'name' => 'Me']);
        $other = User::factory()->create(['email' => 'other@example.com']);

        Event::create([
            'user_id' => $me->id, 'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'type' => 'tap', 'ts' => 1_700_000_000_000, 'received_at' => 1_700_000_000_100,
            'surah' => 12, 'ayah' => 3,
        ]);
        Event::create([
            'user_id' => $other->id, 'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'type' => 'tap', 'ts' => 1_700_000_000_000, 'received_at' => 1_700_000_000_100,
            'surah' => 12, 'ayah' => 9,
        ]);

        Sanctum::actingAs($me);
        $response = $this->getJson('/api/account/export')->assertOk();

        $this->assertSame('me@example.com', $response->json('account.email'));
        $this->assertCount(1, $response->json('events'));
        $this->assertSame(3, $response->json('events.0.ayah'));

        $body = json_encode($response->json());
        $this->assertStringNotContainsString('other@example.com', $body);
        $this->assertStringNotContainsString('9', collect($response->json('events'))->pluck('ayah')->implode(','));
    }

    // ────────────────────────── request deletion ────────────────────────────

    public function test_requesting_deletion_schedules_a_purge_and_does_not_delete_anything(): void
    {
        config(['pdpa.deletion_grace_days' => 14]);
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $before = (int) round(microtime(true) * 1000);
        $response = $this->postJson('/api/account/deletion')->assertStatus(201);

        $token = $response->json('restoreToken');
        $this->assertIsString($token);
        $this->assertNotSame('', $token);

        $purgeAt = $response->json('purgeAt');
        $this->assertGreaterThanOrEqual($before + (14 * 86400 * 1000) - 5000, $purgeAt);
        $this->assertLessThanOrEqual($before + (14 * 86400 * 1000) + 5000, $purgeAt);

        // Scheduling is not deleting.
        $this->assertNotNull(User::find($user->id));
        $this->assertSame(1, AccountDeletionRequest::where('user_id', $user->id)->count());

        // The raw token is never persisted — only its hash.
        $row = AccountDeletionRequest::where('user_id', $user->id)->first();
        $this->assertNotSame($token, $row->token_hash);
        $this->assertSame(hash('sha256', $token), $row->token_hash);
    }

    public function test_a_second_request_while_one_is_pending_is_refused(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $first = $this->postJson('/api/account/deletion')->assertStatus(201);
        $this->postJson('/api/account/deletion')->assertStatus(409);

        // The original request (and its purge date) must be UNCHANGED — a
        // 409 that silently reset the clock would be worse than no guard.
        $row = AccountDeletionRequest::where('user_id', $user->id)->first();
        $this->assertSame($first->json('purgeAt'), $row->purge_at_ms);
        $this->assertSame(1, AccountDeletionRequest::count());
    }

    public function test_deletion_status_reports_pending_and_purge_date(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->getJson('/api/account/deletion')->assertOk()->assertJson(['pending' => false]);

        $requested = $this->postJson('/api/account/deletion')->assertStatus(201);

        $status = $this->getJson('/api/account/deletion')->assertOk();
        $this->assertTrue($status->json('pending'));
        $this->assertSame($requested->json('purgeAt'), $status->json('purgeAt'));
    }

    /**
     * `admin_audit.actor_admin_id` is `restrictOnDelete` — an admin who has
     * ever performed an audited action cannot have their user row deleted at
     * all. Refusing the REQUEST up front, with a clear reason, is strictly
     * better than letting `pdpa:purge-due` discover a raw FK failure two
     * weeks later with no operator watching.
     */
    public function test_an_admin_cannot_request_self_deletion(): void
    {
        $admin = User::factory()->create();
        AdminRole::create(['user_id' => $admin->id, 'role' => 'operator', 'granted_at' => 1_700_000_000_000]);
        Sanctum::actingAs($admin);

        $this->postJson('/api/account/deletion')->assertStatus(403);
        $this->assertSame(0, AccountDeletionRequest::count());
    }

    // ─────────────────────────────── restore ────────────────────────────────

    public function test_restoring_with_the_correct_token_cancels_the_pending_deletion(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $token = $this->postJson('/api/account/deletion')->assertStatus(201)->json('restoreToken');

        $this->postJson('/api/account/deletion/restore', ['token' => $token])
            ->assertOk()
            ->assertJson(['ok' => true, 'restored' => true]);

        $this->assertSame(0, AccountDeletionRequest::where('user_id', $user->id)->count());
        $this->getJson('/api/account/deletion')->assertJson(['pending' => false]);

        // And the user can request deletion again afterwards — restoring is
        // a genuine cancel, not a one-way door.
        $this->postJson('/api/account/deletion')->assertStatus(201);
    }

    public function test_restoring_with_the_wrong_token_is_refused_and_does_not_cancel(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $this->postJson('/api/account/deletion')->assertStatus(201);

        $this->postJson('/api/account/deletion/restore', ['token' => 'not-the-real-token'])
            ->assertStatus(404);

        $this->assertSame(1, AccountDeletionRequest::where('user_id', $user->id)->count());
    }

    public function test_restoring_with_nothing_pending_is_refused(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/account/deletion/restore', ['token' => 'anything'])
            ->assertStatus(404);
    }

    /**
     * FINDING-SHAPED CHECK, matching the M10 reveal-token review (S1): a
     * restore token must be scoped to its OWN user, never usable by whoever
     * else happens to present it — even another genuinely authenticated
     * learner.
     *
     * MUTATION performed and reverted while writing this test: dropping the
     * `where('user_id', ...)` from `restoreDeletion()`'s query and looking
     * the token up by hash alone turns this red (learner B's request would
     * succeed against learner A's token).
     */
    public function test_a_restore_token_is_useless_to_a_different_user(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();

        Sanctum::actingAs($a);
        $token = $this->postJson('/api/account/deletion')->assertStatus(201)->json('restoreToken');

        Sanctum::actingAs($b);
        $this->postJson('/api/account/deletion/restore', ['token' => $token])->assertStatus(404);

        // A's request is untouched.
        $this->assertSame(1, AccountDeletionRequest::where('user_id', $a->id)->count());
    }

    // ─────────────────────────── the purge command ──────────────────────────

    public function test_purge_due_ignores_a_request_still_inside_its_grace_period(): void
    {
        $user = User::factory()->create();
        AccountDeletionRequest::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', 'irrelevant'),
            'requested_at_ms' => (int) round(microtime(true) * 1000),
            'purge_at_ms' => (int) round(microtime(true) * 1000) + 86_400_000,
        ]);

        $this->artisan(PurgeDueAccountsCommand::class)->assertSuccessful();

        $this->assertNotNull(User::find($user->id));
        $this->assertSame(0, PurgeLedgerEntry::count());
    }

    public function test_purge_due_hard_deletes_an_elapsed_request_and_leaves_a_ledger_row(): void
    {
        $doomed = User::factory()->create(['email' => 'doomed@example.com']);
        $keeper = User::factory()->create(['email' => 'keeper@example.com']);

        Event::create([
            'user_id' => $doomed->id, 'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'type' => 'tap', 'ts' => 1_700_000_000_000, 'received_at' => 1_700_000_000_100,
        ]);
        Sanctum::actingAs($doomed);
        $token = $doomed->createToken('device')->plainTextToken;
        $this->assertNotNull($token);

        AccountDeletionRequest::create([
            'user_id' => $doomed->id,
            'token_hash' => hash('sha256', 'whatever'),
            'requested_at_ms' => 1_700_000_000_000,
            'purge_at_ms' => (int) round(microtime(true) * 1000) - 1000, // already elapsed
        ]);

        $this->artisan(PurgeDueAccountsCommand::class)->assertSuccessful();

        $this->assertNull(User::find($doomed->id), 'the elapsed request must be hard-deleted');
        $this->assertSame(0, Event::where('user_id', $doomed->id)->count(), 'events cascade with the user');
        $this->assertSame(0, AccountDeletionRequest::where('user_id', $doomed->id)->count());
        $this->assertSame(0, $doomed->tokens()->count(), 'sanctum tokens are polymorphic and must be removed explicitly');

        $ledger = PurgeLedgerEntry::where('user_id', $doomed->id)->first();
        $this->assertNotNull($ledger, 'purge_ledger must record the purge — this is what a restore reconciles against');
        $this->assertSame('pdpa_delete', $ledger->reason);

        // The keeper — never requested deletion — is untouched.
        $this->assertNotNull(User::find($keeper->id));
    }

    /** Running the command with nothing due must not touch any user. */
    public function test_purge_due_is_a_genuine_no_op_when_nothing_is_due(): void
    {
        $keeper = User::factory()->create();

        $this->artisan(PurgeDueAccountsCommand::class)->assertSuccessful();

        $this->assertNotNull(User::find($keeper->id));
        $this->assertSame(0, PurgeLedgerEntry::count());
    }

    // ──────────────────────── purge_ledger is append-only ───────────────────

    public function test_purge_ledger_can_never_be_updated_or_deleted(): void
    {
        $row = PurgeLedgerEntry::create([
            'user_id' => 999,
            'purged_at_ms' => 1_700_000_000_000,
            'reason' => 'pdpa_delete',
        ]);

        try {
            $row->update(['reason' => 'tampered']);
            $this->fail('a purge_ledger row must never be updatable');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('APPEND-ONLY', $e->getMessage());
        }

        try {
            $row->delete();
            $this->fail('a purge_ledger row must never be deletable — a restore reconciles against it');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('APPEND-ONLY', $e->getMessage());
        }

        $this->assertSame('pdpa_delete', PurgeLedgerEntry::find($row->id)->reason);
    }
}
