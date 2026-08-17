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
