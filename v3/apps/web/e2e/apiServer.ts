// Shared constants for the second, v3/api `webServer` entry
// (playwright.config.ts) and any e2e test that talks to it directly. Not a
// `.test.ts` file — the `testMatch`/`testIgnore` rules in
// playwright.config.ts only ever collect `*.test.ts` as a SUITE, so this
// plain helper is never picked up as one, the same way `idb-helpers.test.ts`
// is explicitly `testIgnore`d despite matching the suffix.
//
// One module, not two independently-computed ports, so the config and a test
// can never disagree about where the disposable v3/api instance is.

export const E2E_API_PORT = Number(process.env.E2E_API_PORT ?? 8011);
export const E2E_API_BASE_URL = `http://127.0.0.1:${E2E_API_PORT}`;
