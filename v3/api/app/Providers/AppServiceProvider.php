<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // config('app.frontend_url') — see the doc block there for why this
        // points at a route apps/web hasn't built yet (build-plan step 17).
        ResetPassword::createUrlUsing(function ($notifiable, string $token) {
            $frontend = rtrim(config('app.frontend_url'), '/');

            return "{$frontend}/reset-password?token={$token}&email=".urlencode($notifiable->getEmailForPasswordReset());
        });

        // Same reasoning, and — until DECISIONS.md v3-D154 — the same gap:
        // left at Laravel's default, this notification's link points at the
        // BACKEND'S OWN `email/verify/{id}/{hash}` route directly. That route
        // sits behind `signed` AND `auth:sanctum` (see
        // EmailVerificationController's own docblock), so a bare GET from an
        // email client — no Bearer header attached — would 401 before a
        // learner ever saw anything. Route through the frontend instead,
        // carrying the SAME four pieces (`id`, `hash`, `expires`, `signature`)
        // Laravel's own `URL::temporarySignedRoute` call would have used, so
        // `apps/web`'s `confirmEmailVerification` (which DOES attach this
        // device's Bearer token via `apiFetch`) can reconstruct the exact
        // signed backend call.
        VerifyEmail::createUrlUsing(function ($notifiable) {
            $frontend = rtrim(config('app.frontend_url'), '/');
            $hash = sha1($notifiable->getEmailForVerification());

            $signedBackendUrl = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), [
                'id' => $notifiable->getKey(),
                'hash' => $hash,
            ]);

            parse_str((string) parse_url($signedBackendUrl, PHP_URL_QUERY), $query);

            return "{$frontend}/verify-email?id={$notifiable->getKey()}&hash={$hash}"
                ."&expires=".urlencode((string) ($query['expires'] ?? ''))
                ."&signature=".urlencode((string) ($query['signature'] ?? ''));
        });
    }
}
