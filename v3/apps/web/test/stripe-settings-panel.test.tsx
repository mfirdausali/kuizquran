/**
 * @vitest-environment jsdom
 */

// `StripeSettingsPanel` had NO test coverage at all — found while building
// `SystemHealthPanel` (build-plan step 24) as an adjacent instance of the
// same class of bug this codebase repeatedly closes: a mechanism shipped
// with nothing ever exercising it against a real path.
//
// Every OTHER `apiFetch` call site in this app passes an `/api/...`-prefixed
// path (`lib/workbench/verifications.ts`, `lib/account/api.ts`,
// `lib/entitlement/sync.ts`, `lib/sync/sync.ts`) — Laravel's
// `withRouting(api: ...)` prefixes every route in `routes/api.php` with
// `/api`, and `SystemHealthTest`/every other Feature test calls
// `/api/admin/...`. `StripeSettingsPanel` alone called `apiFetch("/admin/
// stripe")` and `apiFetch("/admin/stripe/test", ...)` — missing the `/api`
// prefix, so in any real deployment (no dev-only rewrite exists for
// `/admin/*`; checked `next.config.mjs`) both calls 404 before Laravel ever
// sees them. The shipped Stripe settings screen has never actually loaded.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { StripeSettingsPanel } from "@/components/admin/StripeSettingsPanel";

afterEach(cleanup);

describe("StripeSettingsPanel — requests the real, api-prefixed paths", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("loads from /api/admin/stripe, not /admin/stripe", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(
        JSON.stringify({
          fields: [],
          configured: false,
          mode: null,
          mixedModes: false,
          webhookUrl: "https://example.test/api/billing/stripe/webhook",
          note: "",
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    render(<StripeSettingsPanel />);
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));

    expect(seen[0]).toContain("/api/admin/stripe");
    expect(seen[0]).not.toBe("/admin/stripe");
  });

  it("probes /api/admin/stripe/test, not /admin/stripe/test", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST") seen.push(url);
      return new Response(
        JSON.stringify({
          fields: [],
          configured: true,
          mode: "test",
          mixedModes: false,
          webhookUrl: "https://example.test/api/billing/stripe/webhook",
          note: "",
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    render(<StripeSettingsPanel />);
    const button = await screen.findByRole("button", { name: /test connection/i });
    button.click();

    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
    expect(seen[0]).toContain("/api/admin/stripe/test");
  });
});

// `ProbeResult.livemode` — Stripe's own answer to "is this live?" (`test()`'s
// own docblock: "which beats inferring it from the prefix — the two
// disagreeing is worth knowing") — was fetched and typed
// (`ProbeResult.livemode`) since the probe shipped, but never read anywhere
// in the render; only `probe.message` was. So a swapped test/live secret
// with a correct-looking prefix disagreed with Stripe's own report and
// nothing on screen said so — the same "written, never read" shape this
// build has closed repeatedly elsewhere, here on the one field this panel's
// own docblock names as worth having.
describe("StripeSettingsPanel — warns when Stripe's own livemode disagrees with the configured prefix", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  function mockFetch(mode: "live" | "test" | null, livemode: boolean) {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/test") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            ok: true,
            livemode,
            message: livemode ? "Connected to Stripe in LIVE mode." : "Connected to Stripe in test mode.",
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          fields: [],
          configured: true,
          mode,
          mixedModes: false,
          webhookUrl: "https://example.test/api/billing/stripe/webhook",
          note: "",
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
  }

  it("shows a disagreement banner when Stripe reports live but the configured keys look like test", async () => {
    mockFetch("test", true);
    render(<StripeSettingsPanel />);
    const button = await screen.findByRole("button", { name: /test connection/i });
    button.click();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/disagrees/i);
    expect(alert.textContent).toMatch(/LIVE/);
    expect(alert.textContent).toMatch(/test/);
  });

  it("shows no disagreement banner when Stripe's own livemode agrees with the configured prefix", async () => {
    mockFetch("live", true);
    render(<StripeSettingsPanel />);
    const button = await screen.findByRole("button", { name: /test connection/i });
    button.click();

    await screen.findByText(/Connected to Stripe in LIVE mode\./);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
