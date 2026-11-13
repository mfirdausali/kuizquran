<?php

namespace Tests\Feature\Overrides;

use App\Models\Override;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * Build-plan step 15. v2-D21/D55's override layer, carried forward — PUBLIC
 * read (every client needs these to build correct questions, including an
 * anonymous not-yet-synced device — same reasoning v2's OverridesController
 * used), admin-gated write.
 *
 * DEFECTS.md#B1 closing test: `field: "custom"` is rejected forever, not
 * merely unresolved downstream — the write path itself is the gate.
 */
class OverridesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('admin.emails', ['admin@example.com']);
    }

    private function adminHeaders(): array
    {
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        $token = $admin->createToken('device')->plainTextToken;

        return ['Authorization' => 'Bearer '.$token];
    }

    public function test_read_is_public_no_auth_required(): void
    {
        $this->getJson('/api/overrides?surah=12')->assertOk()->assertJson(['overrides' => []]);
    }

    public function test_read_is_scoped_to_the_requested_surah(): void
    {
        $headers = $this->adminHeaders();
        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
        ], $headers)->assertCreated();
        $this->postJson('/api/overrides', [
            'surah' => 67, 'ayah' => 1, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'x'],
        ], $headers)->assertCreated();

        $response = $this->getJson('/api/overrides?surah=12')->assertOk();
        $this->assertCount(1, $response->json('overrides'));
        $this->assertSame(12, $response->json('overrides.0.surah'));
    }

    public function test_write_requires_admin(): void
    {
        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
        ])->assertStatus(401);

        $nonAdmin = User::factory()->create(['email' => 'nobody@example.com']);
        $token = $nonAdmin->createToken('device')->plainTextToken;
        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
        ], ['Authorization' => 'Bearer '.$token])->assertStatus(403);
    }

    public function test_an_admin_can_write_a_gloss_override(): void
    {
        $response = $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
            'note' => 'clarify archaic English',
        ], $this->adminHeaders())->assertCreated();

        $this->assertDatabaseHas('overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'field' => 'gloss',
        ]);
        $this->assertNotNull($response->json('override.createdAt'));
    }

    /** DEFECTS.md#B1's own closing language: "POST rejects kind=custom
     *  forever." */
    public function test_field_custom_is_rejected_forever(): void
    {
        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => null, 'questionType' => 'S1',
            'field' => 'custom', 'payload' => ['prompt' => 'who spoke?', 'options' => ['a', 'b'], 'correct' => 'a'],
        ], $this->adminHeaders())->assertStatus(422);

        $this->assertDatabaseCount('overrides', 0);
    }

    public function test_field_must_be_one_of_the_closed_set(): void
    {
        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'anything-else', 'payload' => [],
        ], $this->adminHeaders())->assertStatus(422);
    }

    // ═══════ v3-D405 — `note` is unscanned, unpurgeable PII in an append-only row ═══════

    /**
     * `overrides` is APPEND-ONLY (`Override`'s own `booted()` guard) with no
     * PDPA purge relief on `note` — the identical unpurgeable-PII shape
     * `AdminRevealController::reveal()`'s own free-text `reason_text` already
     * guards with `AdminAudit::scanFreeText()`, never wired on this write
     * path's own free-text `note`.
     *
     * MUTATION: remove the `scanFreeText` check from `OverridesController::store()`.
     */
    public function test_a_note_containing_an_email_is_rejected_unless_acknowledged(): void
    {
        $response = $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
            'note' => 'flagged by a learner, sitipah.rahman@example.com, via support',
        ], $this->adminHeaders());

        $response->assertStatus(422);
        $response->assertJsonFragment(['detected' => ['email-shaped string']]);
        $this->assertDatabaseCount('overrides', 0);
    }

    public function test_a_note_pii_warning_is_overridable_with_explicit_acknowledgement(): void
    {
        $note = 'flagged by a learner, sitipah.rahman@example.com, via support';

        $response = $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
            'note' => $note,
            'acknowledge_pii_warning' => true,
        ], $this->adminHeaders());

        $response->assertCreated();
        $this->assertDatabaseHas('overrides', ['note' => $note]);
    }

    public function test_editor_id_is_always_the_authenticated_admin_never_the_body(): void
    {
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        $someoneElse = User::factory()->create();
        $token = $admin->createToken('device')->plainTextToken;

        $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
            'editorId' => $someoneElse->id,
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        $this->assertDatabaseHas('overrides', ['editor_id' => $admin->id]);
        $this->assertDatabaseMissing('overrides', ['editor_id' => $someoneElse->id]);
    }

    /**
     * `Override::editor()` (a `BelongsTo<User>`) has existed since the
     * override layer shipped — the model's own docblock even calls it out
     * ("for the editor's audit list") — but `toWire()` sent only the raw
     * `editorId` integer, and nothing resolved it to anything a human can
     * read. `OverrideEditor.tsx`'s own list (wired at v3-D125) is the one
     * screen that shows override history to an admin; it never named who
     * made a correction. This is the wire half of that gap.
     */
    public function test_the_wire_response_names_the_editor_by_email_not_just_id(): void
    {
        $headers = $this->adminHeaders();
        $response = $this->postJson('/api/overrides', [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
        ], $headers)->assertCreated();

        $this->assertSame('admin@example.com', $response->json('override.editorEmail'));

        // v3-D403: an admin re-reading their own history (same workbench
        // session, same Bearer token) still gets the email — the route is
        // public, not "editorEmail never ships again".
        $indexResponse = $this->getJson('/api/overrides?surah=12', $headers)->assertOk();
        $this->assertSame('admin@example.com', $indexResponse->json('overrides.0.editorEmail'));
    }

    /**
     * v3-D403: this route has NO `auth:sanctum` middleware at all (see the
     * class docblock — "every client, including an anonymous not-yet-synced
     * device" must reach it) — so it is reachable by literally anyone, with
     * no Bearer token whatsoever. `editorEmail`/`editorId`/`note` exist only
     * to populate `OverrideEditor.tsx`'s admin-only history list;
     * `applyOverrides()` (the one consumer every real caller of this route
     * is actually serving) never reads any of the three. Before this fix,
     * every admin's email address — the same ADMIN_EMAILS address B7's own
     * fix and PasswordResetController's "deliberately uniform response"
     * both exist to keep an attacker from enumerating — was readable by an
     * anonymous GET with zero credentials.
     */
    public function test_an_unauthenticated_read_never_exposes_the_editors_identity(): void
    {
        // Seeded directly (never through an authenticated HTTP call) --
        // Laravel's testing HTTP kernel caches a resolved guard's user for
        // the rest of the TEST METHOD, Bearer header or not (the guard
        // instance, and RequestGuard::user()'s own cache, persist across
        // postJson/getJson calls sharing one $this->app, a testing-harness
        // artifact that never happens across real, separate production
        // requests). Going through postJson(...,$adminHeaders) first would
        // resolve-and-cache the admin on this test's shared guard, and the
        // later "unauthenticated" GET would silently inherit it -- passing
        // for the wrong reason. Seeding via Eloquent means NO request in
        // this test method ever authenticates, so the GET below is
        // genuinely, not just nominally, anonymous.
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        Override::create([
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'question_type' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
            'editor_id' => $admin->id, 'note' => 'confirmed with the qari on a call',
            'created_at' => 1000,
        ]);

        // No Authorization header at all -- the exact anonymous-device shape
        // this route's own docblock says it must serve.
        $response = $this->getJson('/api/overrides?surah=12')->assertOk();

        $this->assertNull($response->json('overrides.0.editorEmail'));
        $this->assertNull($response->json('overrides.0.editorId'));
        $this->assertNull($response->json('overrides.0.note'));
        // The fields a learner's device actually needs are untouched.
        $this->assertSame('gloss', $response->json('overrides.0.field'));
        $this->assertSame(['lang' => 'en', 'text' => 'when'], $response->json('overrides.0.payload'));
    }

    /**
     * A signed-in but non-admin caller (an ordinary learner's own Bearer
     * token, e.g. from an adopted account) must not be treated as "has
     * credentials, so show the PII" either -- only User::isAdmin()'s
     * allowlist+verified-email test grants it, same as EnsureIsAdmin.
     * Same seed-directly reasoning as the test above: this is the only
     * authenticated call in this test method, so the guard the learner's
     * own token resolves is genuinely theirs, not an admin's left over from
     * an earlier call.
     */
    public function test_an_authenticated_non_admin_read_never_exposes_the_editors_identity(): void
    {
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        Override::create([
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'question_type' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
            'editor_id' => $admin->id, 'created_at' => 1000,
        ]);

        $learner = User::factory()->create(['email' => 'learner@example.com']);
        $learnerToken = $learner->createToken('device')->plainTextToken;

        $response = $this->getJson('/api/overrides?surah=12', ['Authorization' => 'Bearer '.$learnerToken])->assertOk();

        $this->assertNull($response->json('overrides.0.editorEmail'));
    }

    public function test_rows_are_append_only_a_correction_is_a_new_row(): void
    {
        $headers = $this->adminHeaders();
        $body = [
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'questionType' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
        ];
        $this->postJson('/api/overrides', $body, $headers)->assertCreated();
        $body['payload'] = ['lang' => 'en', 'text' => 'at the time'];
        $this->postJson('/api/overrides', $body, $headers)->assertCreated();

        $this->assertDatabaseCount('overrides', 2);
        $response = $this->getJson('/api/overrides?surah=12')->assertOk();
        $this->assertCount(2, $response->json('overrides'));
    }

    // ───────────── the append-only gap: no structural enforcement at all ──────────

    /**
     * The test above (`test_rows_are_append_only_a_correction_is_a_new_row`)
     * only proves the HTTP layer never issues an UPDATE — it says nothing
     * about whether the `Override` model itself could be rewritten in place.
     * Unlike `AdminAudit`/`PurgeLedgerEntry`/`AyahVerification`/
     * `GlossDraftReview`, `Override` carried no ORM `booted()` guard: nothing
     * stopped a future developer (or a bug in a refactor) from fetching a row
     * and calling `->update()`/`->delete()` on it directly, silently
     * bypassing both B4's `(created_at, id)` tie-break AND
     * `CorpusHashRecomputer`'s re-hash, which only fires on the INSERT path.
     *
     * MUTATION: remove the `updating`/`deleting` guards from the model.
     */
    public function test_a_row_can_never_be_updated_or_deleted_directly_on_the_model(): void
    {
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        $row = Override::create([
            'surah' => 12, 'ayah' => 4, 'position' => 1, 'question_type' => 'S1',
            'field' => 'gloss', 'payload' => ['lang' => 'en', 'text' => 'when'],
            'editor_id' => $admin->id, 'created_at' => 1_700_000_000_000,
        ]);

        try {
            $row->update(['payload' => ['lang' => 'en', 'text' => 'tampered']]);
            $this->fail('an override row must never be updatable directly — a correction is a new row');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('APPEND-ONLY', $e->getMessage());
        }

        try {
            $row->delete();
            $this->fail('an override row must never be deletable directly');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('APPEND-ONLY', $e->getMessage());
        }

        $this->assertDatabaseHas('overrides', [
            'id' => $row->id, 'field' => 'gloss',
        ]);
    }

    /**
     * Same reasoning as `VerificationsTest`'s/`GlossDraftsTest`'s identical
     * check — the ORM guard above is layer 2 only. Layer 1 (`REVOKE UPDATE,
     * DELETE` on the app's Postgres role) cannot be asserted from inside the
     * app that lacks it, so the strongest available check is that the
     * runnable grant for `overrides` exists in the document the other
     * append-only tables' grants already live in.
     *
     * MUTATION: remove the `overrides` GRANT block from
     * docs/ADMIN-CONSOLE.md. Red.
     */
    public function test_the_database_level_append_only_grant_is_documented(): void
    {
        $path = dirname(__DIR__, 3).'/docs/ADMIN-CONSOLE.md';
        $this->assertFileExists($path);

        $doc = file_get_contents($path);

        $this->assertMatchesRegularExpression(
            '/REVOKE\s+UPDATE,\s*DELETE.*ON\s+TABLE\s+overrides/is',
            $doc,
            'the document must carry the actual REVOKE for overrides, not just the other append-only tables',
        );
        $this->assertMatchesRegularExpression(
            '/GRANT\s+INSERT,\s*SELECT\s+ON\s+TABLE\s+overrides/is',
            $doc,
            'the app role still needs INSERT and SELECT, or an override could never be recorded',
        );
    }
}
