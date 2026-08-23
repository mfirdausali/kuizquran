<?php

namespace Tests\Feature\Admin;

use App\Http\Controllers\Admin\Pseudonymizer;
use App\Models\AdminAudit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Build-plan step 24 (M8). THE AUDIT VIEWER.
 *
 * `admin_audit` has been written to by four call sites since M8 shipped
 * (`AdminRevealController::reveal`, `AdminUsersController::exportCsv`,
 * `SystemHealthController::rebuildAtomCache`, `StripeSettingsController::test`)
 * and read by none — the same "built + populated + zero read surface" shape
 * as `FlagRampAudit`, but on the append-only trail BUILD-PLAN M8 itself names
 * as a deliverable ("nav homes for flags/reports/templates/audit viewer").
 * An operator reviewing "who revealed identity X, and why" had a database
 * console and nothing else.
 */
class AdminAuditTest extends TestCase
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

    public function test_the_route_requires_admin(): void
    {
        $this->getJson('/api/admin/audit')->assertStatus(401);

        $learner = User::factory()->create();
        Sanctum::actingAs($learner);
        $this->getJson('/api/admin/audit')->assertStatus(403);
    }

    public function test_it_returns_entries_newest_first(): void
    {
        $admin = $this->admin();

        AdminAudit::create([
            'actor_admin_id' => $admin->id,
            'action' => 'reveal_identity',
            'subject_pseudonym' => 'u_aaaaaaaaaaaa',
            'reason_code' => 'support_ticket',
            'reason_text' => 'first, oldest',
            'at' => 1_700_000_000_000,
        ]);
        AdminAudit::create([
            'actor_admin_id' => $admin->id,
            'action' => 'export_users_csv',
            'subject_pseudonym' => null,
            'reason_code' => 'support_ticket',
            'reason_text' => 'second, newest',
            'at' => 1_700_000_005_000,
        ]);

        $response = $this->getJson('/api/admin/audit')->assertOk();
        $entries = $response->json('entries');

        $this->assertCount(2, $entries);
        $this->assertSame('second, newest', $entries[0]['reasonText']);
        $this->assertSame('first, oldest', $entries[1]['reasonText']);
        $this->assertSame('export_users_csv', $entries[0]['action']);
        $this->assertNull($entries[0]['subjectPseudonym']);
        $this->assertSame('u_aaaaaaaaaaaa', $entries[1]['subjectPseudonym']);
    }

    /**
     * The ACTOR is pseudonymized on the way out too — `subject_pseudonym` was
     * already pseudonymized at write time, but `actor_admin_id` is a raw FK.
     * Reading it back raw would make this the one screen that deanonymizes an
     * admin's own identity to every other admin who can load it.
     *
     * MUTATION: return `actor_admin_id` verbatim instead of running it through
     * `Pseudonymizer`. Red — the raw integer id would appear in the response.
     */
    public function test_the_actor_is_pseudonymized_not_the_raw_admin_id(): void
    {
        $admin = $this->admin();
        AdminAudit::create([
            'actor_admin_id' => $admin->id,
            'action' => 'reveal_identity',
            'subject_pseudonym' => 'u_aaaaaaaaaaaa',
            'reason_code' => 'support_ticket',
            'reason_text' => 'a legitimate reason',
            'at' => 1_700_000_000_000,
        ]);

        $entries = $this->getJson('/api/admin/audit')->assertOk()->json('entries');

        $expected = app(Pseudonymizer::class)->for($admin->id);
        $this->assertSame($expected, $entries[0]['actor']);
        $this->assertStringStartsWith('u_', $entries[0]['actor']);
        $this->assertNotEquals((string) $admin->id, $entries[0]['actor']);
    }

    /**
     * The `subject` filter — an operator investigating one pseudonym (e.g. the
     * one they just revealed) should be able to see every audit row that
     * names it, without scrolling the whole table.
     */
    public function test_the_subject_filter_narrows_to_one_pseudonym(): void
    {
        $admin = $this->admin();
        AdminAudit::create([
            'actor_admin_id' => $admin->id,
            'action' => 'reveal_identity',
            'subject_pseudonym' => 'u_aaaaaaaaaaaa',
            'reason_code' => 'support_ticket',
            'reason_text' => 'about learner A',
            'at' => 1_700_000_000_000,
        ]);
        AdminAudit::create([
            'actor_admin_id' => $admin->id,
            'action' => 'reveal_identity',
            'subject_pseudonym' => 'u_bbbbbbbbbbbb',
            'reason_code' => 'support_ticket',
            'reason_text' => 'about learner B',
            'at' => 1_700_000_001_000,
        ]);

        $entries = $this->getJson('/api/admin/audit?subject=u_aaaaaaaaaaaa')->assertOk()->json('entries');

        $this->assertCount(1, $entries);
        $this->assertSame('about learner A', $entries[0]['reasonText']);
    }

    /**
     * The route is READ-ONLY — it must never accept a write. There is no
     * POST/PUT/DELETE registered for it at all; asserted as an outcome
     * (method not allowed / not found) rather than by reading the route file.
     */
    public function test_the_route_accepts_no_writes(): void
    {
        $this->admin();
        $this->postJson('/api/admin/audit', ['action' => 'forged'])->assertStatus(405);
    }
}
