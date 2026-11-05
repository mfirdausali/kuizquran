<?php

/**
 * CORS. Absent from this app until now (DECISIONS.md v3-D369/D371/D375/D377's
 * own recurring "NOT addressed" note): `Laravel 11`'s global `HandleCors`
 * middleware is wired in by the framework regardless, but with no
 * `config/cors.php` file `config('cors')` resolves to an empty array, which
 * `HandleCors` reads as an empty `paths` list — CORS handling is a no-op and
 * every cross-origin browser request to `/api/*` is silently unprotected by
 * CORS headers at all (fail-closed by *accident*, not by configured intent).
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
