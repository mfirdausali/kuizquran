<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * `config/cors.php`'s own header explains why this file exists at all: with
 * no `config/cors.php`, `config('cors')` resolves to an empty array, which
 * `Illuminate\Http\Middleware\HandleCors` (wired in globally by the
 * framework regardless, per Laravel 11's own default) reads as an empty
 * `paths` list — CORS handling becomes a silent no-op rather than a
 * deliberate deny. These tests prove the configured allowlist is actually
 * read by a real request through the real global middleware stack, not
 * merely that the file parses.
 *
 * Commit 1 of the two-device determinism e2e (BUILD-PLAN M6's own exit
 * criterion): DECISIONS.md v3-D366/D367/D369/D371 through D377 each named
 * this gap and recommended landing CORS + the e2e suite's second
 * `webServer` entry first, independently verifiable from the actual
 * two-device scenario that follows in a later run. This is that independent
 * verification's backend half — `apps/web/e2e/api-cors-smoke.test.ts` is the
 * browser half.
 */
class CorsTest extends TestCase
{
    public function test_allowed_origin_gets_a_cors_header_on_a_preflight(): void
    {
        Config::set('cors.allowed_origins', ['http://allowed.example']);

        $response = $this->withHeaders([
            'Origin' => 'http://allowed.example',
            'Access-Control-Request-Method' => 'POST',
        ])->call('OPTIONS', '/api/auth/anonymous');

        $response->assertHeader('Access-Control-Allow-Origin', 'http://allowed.example');
    }

    public function test_an_origin_not_on_the_allowlist_gets_no_cors_header(): void
    {
        Config::set('cors.allowed_origins', ['http://allowed.example']);

        $response = $this->withHeaders([
            'Origin' => 'http://not-allowed.example',
            'Access-Control-Request-Method' => 'POST',
        ])->call('OPTIONS', '/api/auth/anonymous');

        $response->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    /** The production default (`CORS_ALLOWED_ORIGINS` unset): fails closed for
     *  every origin, not merely for origins nobody thought to list. */
    public function test_an_empty_allowlist_fails_closed_for_every_origin(): void
    {
        Config::set('cors.allowed_origins', []);

        $response = $this->withHeaders([
            'Origin' => 'http://anything.example',
            'Access-Control-Request-Method' => 'POST',
        ])->call('OPTIONS', '/api/auth/anonymous');

        $response->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    /** A real cross-origin call (not just the preflight) also carries the
     *  header on the actual response, not only on the OPTIONS probe. */
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
