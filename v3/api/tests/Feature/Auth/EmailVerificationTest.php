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

    /**
     * DECISIONS.md v3-D154's own "not addressed" list: the signed link this
     * notification carries pointed at the BACKEND'S OWN route directly, which
     * sits behind `signed` AND `auth:sanctum` — a bare click from an email
     * client (no Bearer header) would 401 before a learner saw anything.
     * `AppServiceProvider`'s `VerifyEmail::createUrlUsing` closure now routes
     * through the frontend instead. Proves the real, UNFAKED notification
     * (not a hand-built URL) carries a frontend link whose four query
     * params reconstruct into the exact signed backend call that actually
     * verifies the email — the end-to-end property, not just that a closure
     * runs.
     */
    public function test_the_real_notification_links_to_the_frontend_and_its_params_verify_for_real(): void
    {
        config(['app.frontend_url' => 'https://learn.example.test']);

        $user = User::factory()->unverified()->create();
        $token = $user->createToken('device')->plainTextToken;

        $notification = new VerifyEmail;
        $mail = $notification->toMail($user);
        $actionUrl = $mail->actionUrl;

        $this->assertStringStartsWith('https://learn.example.test/verify-email?', $actionUrl);

        $query = [];
        parse_str((string) parse_url($actionUrl, PHP_URL_QUERY), $query);
        $this->assertSame((string) $user->id, $query['id'] ?? null);
        $this->assertSame(sha1($user->email), $query['hash'] ?? null);
        $this->assertNotEmpty($query['expires'] ?? null);
        $this->assertNotEmpty($query['signature'] ?? null);

        // The exact reconstruction `lib/account/auth.ts#confirmEmailVerification`
        // performs client-side from the parsed link params.
        $backendUrl = "/api/email/verify/{$query['id']}/{$query['hash']}"
            .'?expires='.$query['expires'].'&signature='.$query['signature'];

        $this->assertFalse($user->fresh()->hasVerifiedEmail());

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->get($backendUrl)
            ->assertOk()
            ->assertJson(['ok' => true, 'alreadyVerified' => false]);

        $this->assertTrue($user->fresh()->hasVerifiedEmail());
    }
}
