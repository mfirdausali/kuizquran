// Commit 1 of the two-device determinism e2e (BUILD-PLAN M6's own exit
// criterion). DECISIONS.md v3-D366/D367/D369/D371 through D377 each named
// this as genuinely unswept and deliberately did not attempt it in one
// sitting, recommending it land in two commits: CORS config + a second
// Playwright `webServer` entry, verified by a trivial smoke request, FIRST
// — independently diagnosable from the actual two-device scenario that
// follows in a later run.
//
// This is that smoke request. It proves the thing the recommendation named
// as the risk: a genuinely CROSS-ORIGIN browser `fetch` (the e2e Next app's
// own origin, `BASE_URL`, calling the disposable v3/api server on a
// DIFFERENT origin, `E2E_API_BASE_URL`) is not silently blocked by the
// browser — which is exactly what would happen with no `config/cors.php` at
// all (an empty `paths` list makes Laravel's global `HandleCors` middleware
// a no-op, config/cors.php's own header explains why).
//
// The fetch runs INSIDE `page.evaluate()`, not from Playwright's Node side.
// A Node-side `fetch` has no CORS enforcement at all — it would prove the
// server answers, never that a BROWSER accepts the answer, which is the one
// thing this commit actually changes.

import { expect, test } from "@playwright/test";
import { E2E_API_BASE_URL } from "./apiServer.ts";

test.describe("v3/api CORS smoke (two-device e2e, commit 1 of 2)", () => {
  test("a cross-origin browser fetch from the e2e app to the disposable v3/api server succeeds", async ({
    page,
  }) => {
    // Any same-origin page load establishes the browser's notion of "this
    // page's origin" as the e2e Next app's own — the origin that must be on
    // v3/api's CORS allowlist (playwright.config.ts sets
    // CORS_ALLOWED_ORIGINS to exactly this) for the fetch below to be
    // anything other than blocked.
    await page.goto("/");

    const result = await page.evaluate(async (apiBase: string) => {
      try {
        const response = await fetch(`${apiBase}/api/auth/anonymous`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: "{}",
        });
        const body = (await response.json()) as { token?: string; isAnonymous?: boolean };
        return { ok: response.ok, status: response.status, body };
      } catch (err) {
        // A CORS rejection never reaches `.then`/`.catch` with an HTTP status
        // at all in a browser — `fetch` itself rejects with a opaque
        // TypeError ("Failed to fetch"). Surfacing that message is what makes
        // a real CORS failure distinguishable from a genuine 4xx/5xx in the
        // assertion below, instead of both looking like "the promise threw".
        return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
      }
    }, E2E_API_BASE_URL);

    expect(result.ok, `cross-origin fetch failed: ${JSON.stringify(result)}`).toBe(true);
    expect(result.status).toBe(201);
    expect(result.body?.isAnonymous).toBe(true);
    expect(typeof result.body?.token).toBe("string");
    expect(result.body?.token).not.toBe("");
  });

  test("the disposable v3/api server is reachable directly (readiness probe parity)", async ({
    request,
  }) => {
    // Playwright's own `webServer.url` readiness probe already hits this
    // exact endpoint before any test runs; this assertion is the same check
    // made explicit and failure-attributable to a specific test rather than
    // a config timeout with no test name attached.
    const response = await request.get(`${E2E_API_BASE_URL}/up`);
    expect(response.ok()).toBe(true);
  });
});
