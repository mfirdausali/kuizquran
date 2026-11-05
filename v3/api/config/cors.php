<?php

/**
 * CORS. Absent from this app until now (DECISIONS.md v3-D369/D371/D375/D377's
 * own recurring "NOT addressed" note) — and absent is NOT the same as
 * "no-op". `Laravel 11`'s global `HandleCors` middleware is wired in by the
 * framework regardless of whether this file exists; unpublished, it falls
 * back to the FRAMEWORK'S OWN bundled default
 * (`vendor/laravel/framework/config/cors.php`): `'allowed_origins' => ['*']`
 * for every `api/*` path. So before this file, ANY origin on the public
 * internet could make a cross-origin browser `fetch()` to this API's
 * unauthenticated endpoints (`POST /api/auth/anonymous`,
 * `GET /api/overrides`, `GET /api/verifications`, `GET /api/specs`) and read
 * the response — wide open by *accident*, never a decision anyone made,
 * found only while wiring the two-device e2e's genuinely cross-origin call
 * (see `tests/Feature/CorsTest.php`'s own header for the full finding).
 * This file replaces that wildcard with an explicit, env-driven allowlist
 * that denies every origin by default.
 *
 * Every real client of this API today is either same-origin (`apps/web`'s
 * production deploy, served from the same host) or not a browser at all
 * (PHPUnit, the fold-runner, `curl`). The one genuinely cross-origin browser
 * caller is the Playwright two-device e2e scenario (BUILD-PLAN M6's own exit
 * criterion), which boots this API as a SEPARATE server from the e2e Next.js
 * app — see `apps/web/playwright.config.ts`'s second `webServer` entry and
 * `scripts/e2e-serve.sh`. `CORS_ALLOWED_ORIGINS` is unset (so this list is
 * empty, matching no `Origin` header at all) everywhere except that one e2e
 * run, which sets it to the e2e server's own origin.
 *
 * Auth here is a Bearer token (Sanctum personal access tokens,
 * `AuthController`), never a cookie — so `supports_credentials` stays `false`
 * and `sanctum/csrf-cookie` is deliberately absent from `paths`: no caller of
 * this API ever needs Sanctum's stateful-cookie CSRF dance.
 */
return [

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(
        array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', '')))
    )),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
