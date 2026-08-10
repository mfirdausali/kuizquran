<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
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
}
