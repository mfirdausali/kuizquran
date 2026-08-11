<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * DEFECTS.md#B8's SERVER-SIDE half — build-plan step 21 (M6).
 *
 * B8's closing criterion demands "a test that revokes server-side and asserts
 * recovery". The CLIENT half lives in `apps/web/lib/sync/auth.test.ts`, which
 * necessarily stubs the network. This file is what makes that stub a FAITHFUL
 * MODEL rather than a fiction: it proves against the real Laravel app that
 *
 *   1. a revoked Sanctum token really does get 401 on POST /api/events,
 *   2. POST /api/auth/anonymous really is UNAUTHENTICATED and really returns
 *      201 with a usable token,
 *   3. the freshly minted token really does work on the same endpoint.
 *
 * Those three facts are exactly the ones the client stub asserts. If any of
 * them changed server-side, the client suite would keep passing against a
 * contract that no longer exists — which is the whole class of failure this
 * build has already shipped four times (v3-D38/D45/D49/D50).
 */
class TokenRevocationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * The revoked token is refused.
     *
     * NOTE ON THE HARNESS, and why this is one assertion per test method
     * rather than a single narrative: within ONE test method the auth guard
     * resolves and CACHES its user on the first authenticated request and
     * does not re-resolve from a changed Authorization header afterwards.
     * `EventsIngestionTest` documents this same quirk in its own words — "a
     * test-harness quirk, not a production bug (a real HTTP request is always
     * freshly resolved)". Asserting a 401 after a 200 in the same method
     * would therefore be testing the harness's cache, not the revocation. So
     * the revocation gets its OWN method, where the dead token is the first
     * and only credential the guard ever sees.
     */
    public function test_a_revoked_token_is_refused(): void
    {
        $minted = $this->postJson('/api/auth/anonymous')->assertStatus(201);
        $token = $minted->json('token');
        $this->assertIsString($token);
        $this->assertNotSame('', $token);

        // REVOKE, server-side — the same gesture PasswordResetController::reset()
        // already uses.
        User::query()->latest('id')->firstOrFail()->tokens()->delete();

        // The dead token is the FIRST credential this request presents, so
        // this 401 is the guard's real verdict on it. It is precisely what
        // the client's interceptor keys off, and what the client stub models.
        $this->postJson(
            '/api/events',
            ['events' => [['id' => 'ev-1', 'type' => 'session_start', 'ts' => 1000]]],
            ['Authorization' => 'Bearer '.$token],
        )->assertStatus(401);
    }

    /** The other half of recovery: a token that was NOT revoked still works,
     *  so the 401 above is about revocation and not about the endpoint being
     *  broken for everyone. Without this pair, a controller that 401'd
     *  unconditionally would pass the test above. */
    public function test_a_live_token_is_accepted_on_the_same_endpoint(): void
    {
        $minted = $this->postJson('/api/auth/anonymous')->assertStatus(201);

        $this->postJson(
            '/api/events',
            ['events' => [['id' => 'ev-1', 'type' => 'session_start', 'ts' => 1000]]],
            ['Authorization' => 'Bearer '.$minted->json('token')],
        )->assertOk()->assertJson(['accepted' => 1, 'ignored' => 0]);
    }

    /** A fresh mint after a revocation issues a DIFFERENT token — the client's
     *  "the stored token changed" assertion depends on this being true. */
    public function test_a_fresh_mint_after_revocation_issues_a_different_token(): void
    {
        $first = $this->postJson('/api/auth/anonymous')->assertStatus(201)->json('token');
        User::query()->latest('id')->firstOrFail()->tokens()->delete();
        $second = $this->postJson('/api/auth/anonymous')->assertStatus(201)->json('token');

        $this->assertNotSame($first, $second);
    }

    /** The mint endpoint must never require auth: a device whose only token is
     *  revoked has nothing else to present, and a gated mint is an unbreakable
     *  wedge — B8 with no recovery path at all. */
    public function test_the_mint_endpoint_is_unauthenticated(): void
    {
        $this->postJson('/api/auth/anonymous')
            ->assertStatus(201)
            ->assertJsonStructure(['token', 'isAnonymous', 'anchorHour', 'hasHistory']);
    }

    /**
     * A re-mint yields a DIFFERENT user with an EMPTY history.
     *
     * This is the fact behind the client's cursor reset: the new user's ingest
     * sequence starts at 0, so a carried-over pull cursor would skip their
     * entire history forever. It is also the documented, accepted consequence
     * that a re-mint SPLITS server-side history across two anonymous users —
     * the local log stays complete (invariant #2), and reunification is the
     * adoption merge job, not step 21.
     */
    public function test_a_re_mint_is_a_different_user_with_no_events(): void
    {
        // Sanctum::actingAs rather than swapped Bearer headers, for the same
        // documented reason as EventsIngestionTest: the guard caches its
        // resolved user within one test method, so two identities in one
        // method must be set on the guard directly.
        $this->postJson('/api/auth/anonymous')->assertStatus(201);
        $first = User::query()->latest('id')->firstOrFail();
        $this->postJson('/api/auth/anonymous')->assertStatus(201);
        $second = User::query()->latest('id')->firstOrFail();
        $this->assertNotSame($first->id, $second->id);

        Sanctum::actingAs($first);
        $this->postJson('/api/events', ['events' => [
            ['id' => 'ev-a', 'type' => 'session_start', 'ts' => 1],
        ]])->assertOk();

        // The second identity sees NOTHING of the first's history — its ingest
        // sequence starts at 0, which is exactly why the client MUST reset its
        // pull cursor on a re-mint.
        Sanctum::actingAs($second);
        $this->assertSame([], $this->getJson('/api/events')->assertOk()->json('events'));

        // While the first still has its own: a re-mint SPLITS server-side
        // history rather than moving it. Accepted and documented — the local
        // log stays complete (invariant #2), and reunification is the adoption
        // merge job, not step 21.
        Sanctum::actingAs($first);
        $this->assertCount(1, $this->getJson('/api/events')->assertOk()->json('events'));
    }

    /**
     * #108's server half, restated as a contract test the client depends on:
     * a re-POST of a uuid the server already holds is IGNORED, not duplicated
     * and not an error. The client's outbox treats `ignored` as SUCCESS, and
     * that is only safe because this is true.
     */
    public function test_reposting_the_same_uuid_reports_ignored_not_an_error(): void
    {
        $minted = $this->postJson('/api/auth/anonymous')->assertStatus(201);
        $headers = ['Authorization' => 'Bearer '.$minted->json('token')];
        $batch = ['events' => [
            ['id' => 'dup-1', 'type' => 'session_start', 'ts' => 1],
            ['id' => 'dup-2', 'type' => 'session_start', 'ts' => 2],
        ]];

        $this->postJson('/api/events', $batch, $headers)
            ->assertOk()
            ->assertJson(['accepted' => 2, 'ignored' => 0]);

        // The lost-response replay: the client never learned the first POST
        // succeeded, so it sends the same batch again.
        $this->postJson('/api/events', $batch, $headers)
            ->assertOk()
            ->assertJson(['accepted' => 0, 'ignored' => 2]);

        $this->assertDatabaseCount('events', 2);
    }
}
