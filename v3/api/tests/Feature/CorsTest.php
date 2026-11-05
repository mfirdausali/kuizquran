<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * Commit 1 of the two-device determinism e2e (BUILD-PLAN M6's own exit
 * criterion): DECISIONS.md v3-D366/D367/D369/D371 through D377 each named
 * this gap and recommended landing CORS + the e2e suite's second
 * `webServer` entry first, independently verifiable from the actual
 * two-device scenario that follows in a later run. This is that
 * independent verification's backend half —
 * `apps/web/e2e/api-cors-smoke.test.ts` is the browser half.
 *
 * WHAT THIS FILE IS ACTUALLY ABOUT, found while writing it: `config('cors')`
 * never resolved empty before this file existed. Laravel 11's own
 * `Illuminate\Http\Middleware\HandleCors` is wired into the global
 * middleware stack regardless of whether an app publishes `config/cors.php`
 * — unpublished, it silently falls back to the framework's OWN bundled
 * default (`vendor/laravel/framework/config/cors.php`), which is
 * `'allowed_origins' => ['*']` for every `api/*` path. That means, before
 * this commit, ANY origin on the public internet could make a cross-origin
 * browser `fetch()` to this API's unauthenticated endpoints
 * (`/api/auth/anonymous`, `GET /api/overrides`, `GET /api/verifications`,
 * `GET /api/specs`) and read the response — never flagged anywhere in
 * DECISIONS.md, because nothing had looked at CORS at all until the
 * two-device e2e needed a genuinely cross-origin call. This file replaces
 * that wildcard with an explicit, env-driven allowlist that denies every
 * origin by default (`test_an_empty_allowlist_fails_closed_for_every_origin`
 * below) — `CORS_ALLOWED_ORIGINS` is set only by the Playwright e2e run.
 *
 * `$this->options(...)` (Laravel's own OPTIONS-request test helper), never
 * `$this->withHeaders(...)->call('OPTIONS', ...)`: the plain `call()` only
 * ever reads `$this->serverVariables`, never `$this->defaultHeaders` —
 * `withHeaders()` sets the latter, so chaining it onto a bare `call()` (the
 * first shape this file was written with) silently sends NEITHER `Origin`
 * NOR `Access-Control-Request-Method` at all. Found by the multi-origin
 * test below genuinely failing where it should have passed — the
 * single-origin test alongside it kept "passing" throughout, for the wrong
 * reason: `fruitcake/php-cors`'s single-origin echo (next test's own
 * header) never reads the request's `Origin` either, so it could not have
 * caught this.
 */
class CorsTest extends TestCase
{
    public function test_the_frameworks_own_bundled_default_is_a_wildcard(): void
    {
        $frameworkDefault = require base_path('vendor/laravel/framework/config/cors.php');

        $this->assertSame(['*'], $frameworkDefault['allowed_origins']);
    }

    /**
     * `fruitcake/php-cors` (Laravel's actual CORS engine)'s own
     * `isSingleOriginAllowed()`/`configureAllowedOrigin()`: when EXACTLY ONE
     * non-wildcard origin is configured, it is echoed back on every
     * response unconditionally — the request's own `Origin` header is never
     * compared at all (confirmed directly against
     * `vendor/fruitcake/php-cors/src/CorsService.php`). This is not a gap:
     * a real BROWSER independently rejects a response whose
     * `Access-Control-Allow-Origin` does not equal its own page origin, so
     * the genuine security boundary is enforced client-side regardless of
     * what this server echoes. `config/cors.php`'s one real deployment
     * (the e2e run) configures exactly one origin, so this is the path that
     * actually runs — asserted here so a future reader does not mistake it
     * for a missing origin check.
     */
    public function test_a_single_allowed_origin_is_echoed_back_regardless_of_the_requests_own_origin(): void
    {
        Config::set('cors.allowed_origins', ['http://allowed.example']);

        $response = $this->options('/api/auth/anonymous', [], [
            'Origin' => 'http://some-other-origin.example',
            'Access-Control-Request-Method' => 'POST',
        ]);

        $response->assertHeader('Access-Control-Allow-Origin', 'http://allowed.example');
    }

    /** With TWO OR MORE configured origins, `fruitcake/php-cors` takes its
     *  OTHER branch and genuinely matches the request's own `Origin` header
     *  against the list — proving the allowlist is real matching, not
     *  merely the single-origin echo above. */
    public function test_with_multiple_origins_configured_only_a_listed_one_gets_the_header(): void
    {
        Config::set('cors.allowed_origins', ['http://allowed-a.example', 'http://allowed-b.example']);

        $matched = $this->options('/api/auth/anonymous', [], [
            'Origin' => 'http://allowed-b.example',
            'Access-Control-Request-Method' => 'POST',
        ]);
        $matched->assertHeader('Access-Control-Allow-Origin', 'http://allowed-b.example');

        $unmatched = $this->options('/api/auth/anonymous', [], [
            'Origin' => 'http://not-on-the-list.example',
            'Access-Control-Request-Method' => 'POST',
        ]);
        $unmatched->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    /** The production default (`CORS_ALLOWED_ORIGINS` unset): fails closed for
     *  every origin, not merely for origins nobody thought to list — the
     *  opposite of the framework's own bundled wildcard default above. */
    public function test_an_empty_allowlist_fails_closed_for_every_origin(): void
    {
        Config::set('cors.allowed_origins', []);

        $response = $this->options('/api/auth/anonymous', [], [
            'Origin' => 'http://anything.example',
            'Access-Control-Request-Method' => 'POST',
        ]);

        $response->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    /** A real cross-origin call (not just the OPTIONS preflight) also
     *  carries the header on the actual response. */
    public function test_an_allowed_origin_gets_a_cors_header_on_the_real_response_too(): void
    {
        Config::set('cors.allowed_origins', ['http://allowed.example']);

        $response = $this->withHeaders([
            'Origin' => 'http://allowed.example',
        ])->postJson('/api/auth/anonymous');

        $response->assertCreated();
        $response->assertHeader('Access-Control-Allow-Origin', 'http://allowed.example');
    }

    /**
     * `config/cors.php`'s own parsing of `CORS_ALLOWED_ORIGINS` — a
     * comma-separated list, trimmed, with empty entries dropped (so an unset
     * or trailing-comma value never produces a stray `['']` that would
     * coincidentally match an `Origin: ` header some proxy sends empty).
     * Re-read directly from the config file's own return value under a real
     * env change, rather than asserting against `Config::set`'s already-
     * parsed array, which would just restate the fixture.
     */
    public function test_the_env_var_is_parsed_as_a_trimmed_comma_separated_list(): void
    {
        putenv('CORS_ALLOWED_ORIGINS=http://a.example, http://b.example,');
        try {
            $config = require base_path('config/cors.php');
        } finally {
            putenv('CORS_ALLOWED_ORIGINS');
        }

        $this->assertSame(['http://a.example', 'http://b.example'], $config['allowed_origins']);
    }

    public function test_an_unset_env_var_parses_to_an_empty_list(): void
    {
        putenv('CORS_ALLOWED_ORIGINS');
        $config = require base_path('config/cors.php');

        $this->assertSame([], $config['allowed_origins']);
    }

    /** Bearer tokens, never cookies (AuthController's own doc comment) — so
     *  this must never flip true, or a future edit silently opts every
     *  cross-origin caller into Sanctum's stateful-cookie CSRF dance. */
    public function test_credentials_are_never_supported(): void
    {
        $config = require base_path('config/cors.php');

        $this->assertFalse($config['supports_credentials']);
    }
}
