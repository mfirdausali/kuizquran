<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_signed_link_verifies_the_email(): void
    {
        $user = User::factory()->unverified()->create();
        $token = $user->createToken('device')->plainTextToken;

        $url = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);

        $this->assertFalse($user->fresh()->hasVerifiedEmail());

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->get($url)
            ->assertOk()
            ->assertJson(['ok' => true, 'alreadyVerified' => false]);

        $this->assertTrue($user->fresh()->hasVerifiedEmail());
    }

    public function test_unsigned_or_tampered_link_is_rejected(): void
    {
        $user = User::factory()->unverified()->create();
        $token = $user->createToken('device')->plainTextToken;

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson("/api/email/verify/{$user->id}/wrong-hash?expires=".now()->addHour()->timestamp.'&signature=deadbeef')
            ->assertStatus(403);

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_link_cannot_verify_a_different_users_email(): void
    {
        $owner = User::factory()->unverified()->create();
        $attacker = User::factory()->unverified()->create();
        $attackerToken = $attacker->createToken('device')->plainTextToken;

        $url = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), [
            'id' => $owner->id,
            'hash' => sha1($owner->email),
        ]);

        $this->withHeaders(['Authorization' => 'Bearer '.$attackerToken])
            ->get($url)
            ->assertStatus(403);

        $this->assertFalse($owner->fresh()->hasVerifiedEmail());
    }

    public function test_resend_sends_a_new_notification_for_an_unverified_user(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create();
        $token = $user->createToken('device')->plainTextToken;

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/email/verification-notification')
            ->assertOk()
            ->assertJson(['ok' => true, 'alreadyVerified' => false]);

        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_resend_is_a_no_op_for_an_already_verified_user(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $token = $user->createToken('device')->plainTextToken;

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/email/verification-notification')
            ->assertOk()
            ->assertJson(['ok' => true, 'alreadyVerified' => true]);

        Notification::assertNothingSent();
    }
}
