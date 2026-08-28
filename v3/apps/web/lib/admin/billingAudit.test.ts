// `lib/admin/billingAudit.ts` — the missing frontend half of
// `Admin\AdminBillingController` (BUILD-PLAN M7's own named "admin billing
// surface", never built until now). Mirrors `lib/admin/audit.test.ts`'s
// three-state discipline and the real controller's response shape exactly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { loadBillingAudit, submitBillingOverride } from "./billingAudit";

describe("loadBillingAudit — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/admin/billing through the single egress, no userId filter by default", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ entries: [], limit: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadBillingAudit();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/admin/billing");
    expect(seen[0]).not.toContain("userId=");
  });

  it("appends an encoded `userId` query param when given one", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ entries: [], limit: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadBillingAudit(42);
    expect(seen[0]).toContain("/api/admin/billing?userId=42");
  });

  it("returns `ready` for the controller's real response shape", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          entries: [
            {
              subjectPseudonym: "u_7f3a19bcde01",
              fromState: "active",
              toState: "grace",
              cause: "webhook",
              providerEventId: "evt_1",
              actor: "system",
              reason: null,
              at: 1_700_000_005_000,
            },
            {
              subjectPseudonym: "u_7f3a19bcde01",
              fromState: null,
              toState: "trial",
              cause: "trial_start",
              providerEventId: null,
              actor: "system",
              reason: null,
              at: 1_700_000_000_000,
            },
          ],
          limit: 200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadBillingAudit();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.entries).toHaveLength(2);
      expect(load.entries[0]!.toState).toBe("grace");
      expect(load.entries[1]!.fromState).toBeNull();
      expect(load.limit).toBe(200);
    }
  });

  it("a network throw becomes `unavailable`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const load = await loadBillingAudit();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("Failed to fetch");
  });

  it("a 403 names the reason as an admin-account requirement", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    const load = await loadBillingAudit();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("admin account");
  });

  it("a 200 whose JSON has no `entries` becomes `unavailable`, never an empty ready", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const load = await loadBillingAudit();
    expect(load.state).toBe("unavailable");
  });

  it("a 200 carrying HTML becomes `unavailable`, never a fabricated report", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html></html>", { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadBillingAudit();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("not JSON");
  });
});

// `submitBillingOverride` — the write half. `EntitlementMachine::CAUSE_ADMIN_OVERRIDE`
// (v3-D147) existed with no caller anywhere until now; this is that caller's
// client. The server decides everything (reason length, valid state/tier
// values, the 404/409 cases) — this module only shapes the request and
// reports the response back, same discipline as `enableFlag`.
describe("submitBillingOverride — never throws, the server decides everything", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("POSTs to /api/admin/billing/{userId}/override with state, tier and reason", async () => {
    const seen: { url: string; body: unknown }[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify({ applied: true, state: "lapsed_review_only", tier: "monthly" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const outcome = await submitBillingOverride(42, {
      state: "lapsed_review_only",
      reason: "refund per support ticket 9911",
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("/api/admin/billing/42/override");
    expect(seen[0]!.body).toEqual({ state: "lapsed_review_only", reason: "refund per support ticket 9911" });
    expect(outcome).toEqual({ ok: true, message: "applied", state: "lapsed_review_only", tier: "monthly" });
  });

  it("omits a field the caller left unset, rather than sending it as null/undefined", async () => {
    const seen: unknown[] = [];
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init?.body ? JSON.parse(String(init.body)) : null);
      return new Response(JSON.stringify({ applied: true, state: "active", tier: "lifetime" }), { status: 200 });
    }) as unknown as typeof fetch;

    await submitBillingOverride(7, { tier: "lifetime", reason: "goodwill lifetime grant per ticket 4471" });

    expect(seen[0]).toEqual({ tier: "lifetime", reason: "goodwill lifetime grant per ticket 4471" });
  });

  it("a 422 reports the server's own error message verbatim, never a re-derived one", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: "reason must be at least 10 characters" }), { status: 422 }),
    ) as unknown as typeof fetch;

    const outcome = await submitBillingOverride(42, { state: "active", reason: "short" });
    expect(outcome).toEqual({ ok: false, message: "reason must be at least 10 characters" });
  });

  it("a 404 (no entitlement row) reports the server's reason, not a fabricated success", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "no entitlement row for this learner — nothing to override" }), {
          status: 404,
        }),
    ) as unknown as typeof fetch;

    const outcome = await submitBillingOverride(42, { state: "active", reason: "refund per support ticket 9911" });
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("nothing to override");
  });

  it("a network throw becomes a non-ok outcome, never a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const outcome = await submitBillingOverride(42, { state: "active", reason: "refund per support ticket 9911" });
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("Failed to fetch");
  });
});
