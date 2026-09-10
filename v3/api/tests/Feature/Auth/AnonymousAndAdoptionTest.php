<?php

namespace Tests\Feature\Auth;

use App\Models\Event;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

/** v2-D03 (inherited): anonymous mint, then in-place adoption via register(). */
class AnonymousAndAdoptionTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_mints_a_bare_user_and_token(): void
    {
        $response = $this->postJson('/api/auth/anonymous')->assertStatus(201);

        $response->assertJson(['isAnonymous' => true, 'hasHistory' => false]);
        $this->assertNotEmpty($response->json('token'));
        $this->assertDatabaseCount('users', 1);
        $this->assertTrue(User::first()->is_anonymous);
    }

    public function test_register_adopts_the_same_user_id_in_place(): void
    {
        Notification::fake();

        $anon = $this->postJson('/api/auth/anonymous')->json();
        $userId = User::first()->id;

        $this->withHeaders(['Authorization' => 'Bearer '.$anon['token']])
            ->postJson('/api/auth/register', [
                'email' => 'learner@example.com',
                'password' => 'correct-horse',
                'name' => 'Learner',
            ])
            ->assertOk()
            ->assertJson(['ok' => true, 'email' => 'learner@example.com', 'isAnonymous' => false, 'emailVerified' => false]);

        $this->assertDatabaseCount('users', 1);
        $user = User::find($userId);
        $this->assertSame('learner@example.com', $user->email);
        $this->assertFalse($user->is_anonymous);
        $this->assertFalse($user->hasVerifiedEmail());
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_register_rejects_an_email_already_owned_by_another_account(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'taken@example.com']);

        $anon = $this->postJson('/api/auth/anonymous')->json();
        $this->withHeaders(['Authorization' => 'Bearer '.$anon['token']])
            ->postJson('/api/auth/register', ['email' => 'taken@example.com', 'password' => 'correct-horse'])
            ->assertStatus(422);
    }

    public function test_login_issues_a_fresh_token_for_an_existing_account(): void
    {
        $user = User::factory()->create(['email' => 'learner@example.com', 'password' => bcrypt('correct-horse')]);

        $response = $this->postJson('/api/auth/login', ['email' => 'learner@example.com', 'password' => 'correct-horse'])
            ->assertOk();

        $this->assertNotEmpty($response->json('token'));
        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_login_rejects_wrong_password(): void
    {
        User::factory()->create(['email' => 'learner@example.com', 'password' => bcrypt('correct-horse')]);

        $this->postJson('/api/auth/login', ['email' => 'learner@example.com', 'password' => 'wrong'])
            ->assertStatus(401);
    }

    /**
     * `login()`'s own docblock: "does not touch the caller's prior identity —
     * any not-yet-synced local events simply sync under whichever account is
     * signed in." That is exactly the moment a learner needs to know whether
     * the account they are switching THIS DEVICE into already carries real
     * history, versus a fresh account with nothing in it yet —
     * `SignInForm`'s own copy in `apps/web` warns "it replaces what this
     * device shows, it does not merge it," which is a materially different
     * warning depending on whether there is anything to replace it WITH.
     * `hasHistory` was hardcoded `false` unconditionally since this
     * controller was written (a stale comment blamed the events table not
     * existing yet — it has existed since build-plan step 14, many nights
     * before this test). This proves it is now a REAL read of `events`, not
     * a permanent placeholder: two accounts, one with a prior event and one
     * with none, must answer differently.
     */
    public function test_login_reports_hasHistory_true_for_an_account_with_prior_events(): void
    {
        $user = User::factory()->create(['email' => 'learner@example.com', 'password' => bcrypt('correct-horse')]);
        Event::create([
            'user_id' => $user->id,
            'uuid' => (string) Str::uuid(),
            'type' => 'rung_complete',
            'ts' => 1000,
            'surah' => 112,
            'ayah' => 1,
            'rung' => 'S2',
            'position' => 0,
            'choice' => 'w0',
            'correct' => true,
            'received_at' => 1000,
        ]);

        $this->postJson('/api/auth/login', ['email' => 'learner@example.com', 'password' => 'correct-horse'])
            ->assertOk()
            ->assertJson(['hasHistory' => true]);
    }

    public function test_login_reports_hasHistory_false_for_an_account_with_no_events(): void
    {
        User::factory()->create(['email' => 'learner@example.com', 'password' => bcrypt('correct-horse')]);

        $this->postJson('/api/auth/login', ['email' => 'learner@example.com', 'password' => 'correct-horse'])
            ->assertOk()
            ->assertJson(['hasHistory' => false]);
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('device')->plainTextToken;
        $user->createToken('other-device');

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/auth/logout')
            ->assertOk();

        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_me_requires_auth(): void
    {
        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_me_reports_signed_in_state(): void
    {
        $user = User::factory()->create(['email' => 'learner@example.com']);
        $token = $user->createToken('device')->plainTextToken;

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/me')
            ->assertOk()
            ->assertJson(['signedIn' => true, 'email' => 'learner@example.com', 'emailVerified' => true]);
    }

    /** Same real-vs-stubbed proof as the `login()` case above, for the
     *  session-restore endpoint every device calls on every page load. */
    public function test_me_reports_hasHistory_true_for_an_account_with_prior_events(): void
    {
        $user = User::factory()->create(['email' => 'learner@example.com']);
        $token = $user->createToken('device')->plainTextToken;
        Event::create([
            'user_id' => $user->id,
            'uuid' => (string) Str::uuid(),
            'type' => 'rung_complete',
            'ts' => 1000,
            'surah' => 112,
            'ayah' => 1,
            'rung' => 'S2',
            'position' => 0,
            'choice' => 'w0',
            'correct' => true,
            'received_at' => 1000,
        ]);

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/me')
            ->assertOk()
            ->assertJson(['hasHistory' => true]);
    }

    public function test_me_reports_hasHistory_false_for_an_account_with_no_events(): void
    {
        $user = User::factory()->create(['email' => 'learner@example.com']);
        $token = $user->createToken('device')->plainTextToken;

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/me')
            ->assertOk()
            ->assertJson(['hasHistory' => false]);
    }
}
