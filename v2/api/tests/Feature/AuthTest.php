<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** v2-D03: anonymous-first auth + account adoption. */
class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_mints_a_device_user_and_token(): void
    {
        $res = $this->postJson('/api/auth/anonymous');

        $res->assertStatus(201)->assertJson([
            'isAnonymous' => true,
            'hasHistory' => false,
        ]);
        $this->assertNotEmpty($res->json('token'));
        $this->assertDatabaseCount('users', 1);
        $this->assertTrue(User::first()->is_anonymous);
    }

    public function test_me_requires_a_valid_token(): void
    {
        $this->getJson('/api/me')->assertStatus(401);

        $token = $this->postJson('/api/auth/anonymous')->json('token');
        $this->withHeader('Authorization', "Bearer $token")
            ->getJson('/api/me')
            ->assertOk()
            ->assertJson(['signedIn' => true, 'isAnonymous' => true]);
    }

    public function test_register_claims_the_anonymous_user_in_place_no_new_row(): void
    {
        $token = $this->postJson('/api/auth/anonymous')->json('token');

        $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/auth/register', ['email' => 'learner@example.com', 'password' => 'sekritpass'])
            ->assertOk()
            ->assertJson(['ok' => true, 'email' => 'learner@example.com', 'isAnonymous' => false]);

        $this->assertDatabaseCount('users', 1); // claimed in place, not a second row
        $this->assertFalse(User::first()->is_anonymous);
    }

    public function test_register_rejects_a_taken_email(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);
        $token = $this->postJson('/api/auth/anonymous')->json('token');

        $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/auth/register', ['email' => 'taken@example.com', 'password' => 'sekritpass'])
            ->assertStatus(422);
    }

    public function test_login_issues_a_token_for_an_existing_adopted_account(): void
    {
        $user = User::factory()->create(['email' => 'learner@example.com', 'password' => 'sekritpass']);

        $res = $this->postJson('/api/auth/login', ['email' => 'learner@example.com', 'password' => 'sekritpass']);
        $res->assertOk()->assertJson(['isAnonymous' => false]);
        $this->assertNotEmpty($res->json('token'));

        $this->postJson('/api/auth/login', ['email' => 'learner@example.com', 'password' => 'wrong'])
            ->assertStatus(401);
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $token = $this->postJson('/api/auth/anonymous')->json('token');

        $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/auth/logout')
            ->assertOk();

        $this->withHeader('Authorization', "Bearer $token")
            ->getJson('/api/me')
            ->assertStatus(401);
    }
}
