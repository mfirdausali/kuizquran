<?php

namespace Tests\Feature\Auth;

use Tests\TestCase;

/**
 * v3-D153/D154/D155 built real `apps/web` pages for the password-reset and
 * email-verification links this app's own backend notifications point at
 * (`AppServiceProvider`'s `ResetPassword`/`VerifyEmail` closures). Several
 * backend doc comments, written BEFORE those pages existed (build-plan step
 * 17 was still open), still assert the opposite — "apps/web ... does not
 * exist yet", "doesn't exist yet", "hasn't built yet" — the same "docblock
 * says X, reality is Y" shape v3-D90/D110/D123/D236/D244/D251/D258/D268/D269
 * have each already closed elsewhere in this tree.
 *
 * Structural, not behavioural: a behavioural test can only prove the links
 * work TODAY, never that a comment describing them is honest. Mirrors
 * v3-D236/D244's own AGREEMENT-not-wording technique: it asserts the stale
 * phrase is absent AND, biconditionally, that the real frontend routes those
 * comments were claiming did not exist are genuinely present — so the guard
 * cannot be satisfied by deleting the claim alone if the routes were ever
 * removed.
 */
class StaleFrontendDocsTest extends TestCase
{
    /** Every file whose doc comments once explained the pre-step-17 gap. */
    private const CHECKED_FILES = [
        'config/app.php',
        'app/Providers/AppServiceProvider.php',
        'app/Http/Controllers/Auth/EmailVerificationController.php',
        '.env.example',
    ];

    private const STALE_PATTERN = '/apps\/web[\s\S]{0,60}?(does not exist yet|doesn.t exist yet|hasn.t built yet)/i';

    private function apiRoot(): string
    {
        return dirname(__DIR__, 3);
    }

    private function v3Root(): string
    {
        return dirname(__DIR__, 4);
    }

    public function test_no_backend_doc_comment_still_claims_apps_web_is_unbuilt(): void
    {
        foreach (self::CHECKED_FILES as $relative) {
            $path = $this->apiRoot().'/'.$relative;
            $this->assertFileExists($path, "{$relative} is missing — update CHECKED_FILES.");
            $source = (string) file_get_contents($path);
            $this->assertDoesNotMatchRegularExpression(
                self::STALE_PATTERN,
                $source,
                "{$relative} still claims apps/web is unbuilt."
            );
        }
    }

    /**
     * The biconditional half: the two frontend routes the backend's own
     * link-builders target genuinely exist today, so the guard above
     * cannot be satisfied by deleting the stale prose alone.
     */
    public function test_the_frontend_routes_those_closures_target_genuinely_exist(): void
    {
        $this->assertFileExists($this->v3Root().'/apps/web/app/reset-password/page.tsx');
        $this->assertFileExists($this->v3Root().'/apps/web/app/verify-email/page.tsx');
    }
}
