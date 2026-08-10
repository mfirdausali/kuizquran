<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

/**
 * DEFECTS.md#B7/#B8 (`AUTH-`): v2 had no password reset at all. B8's exact
 * failure mode — "a revoked token permanently disables sync" — is what the
 * final assertion in the happy path closes: reset revokes every existing
 * token AND mints a fresh one, so the device recovers without hand-clearing
 * local storage.
 */
class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_send_reset_link_dispatches_a_notification_for_a_known_email(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'learner@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'learner@example.com'])
            ->assertOk()
            ->assertJson(['ok' => true]);

        Notification::assertSentTo($user, ResetPassword::class);
    }

    /** Uniform response for an unknown email — no enumeration oracle. */
    public function test_send_reset_link_is_silent_for_an_unknown_email(): void
    {
        Notification::fake();

        $this->postJson('/api/forgot-password', ['email' => 'nobody@example.com'])
            ->assertOk()
            ->assertJson(['ok' => true]);

        Notification::assertNothingSent();
    }

    public function test_reset_with_a_valid_token_changes_the_password_and_mints_a_fresh_token(): void
    {
        $user = User::factory()->create(['email' => 'learner@example.com', 'password' => bcrypt('old-password')]);
        $staleToken = $user->createToken('device')->plainTextToken;
        $resetToken = Password::createToken($user);

        $response = $this->postJson('/api/reset-password', [
            'token' => $resetToken,
            'email' => 'learner@example.com',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk();

        $this->assertNotEmpty($response->json('token'));
        $this->assertTrue(Hash::check('new-password-123', $user->fresh()->password));

        // B8: every pre-reset token is dead, including the one the failing
        // device was stuck holding — never a permanent wedge.
        $this->assertNull(PersonalAccessToken::findToken(explode('|', $staleToken)[1]));
        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_reset_with_an_invalid_token_is_rejected(): void
    {
        $user = User::factory()->create(['email' => 'learner@example.com', 'password' => bcrypt('old-password')]);

        $this->postJson('/api/reset-password', [
            'token' => 'not-a-real-token',
            'email' => 'learner@example.com',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertStatus(422);

        $this->assertTrue(Hash::check('old-password', $user->fresh()->password));
    }

    public function test_reset_requires_password_confirmation_to_match(): void
    {
        $user = User::factory()->create(['email' => 'learner@example.com']);
        $resetToken = Password::createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $resetToken,
            'email' => 'learner@example.com',
            'password' => 'new-password-123',
            'password_confirmation' => 'does-not-match',
        ])->assertStatus(422);
    }
}
