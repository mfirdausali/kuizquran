// `lib/admin/billingEvents.ts` — the missing frontend half of the new
// `Admin\BillingEventsController` (v3-D148). Mirrors
// `lib/admin/billingAudit.test.ts`'s three-state discipline and the real
// controller's response shape exactly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { loadBillingEvents } from "./billingEvents";

describe("loadBillingEvents — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/admin/billing/events through the single egress, no filters by default", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ entries: [], limit: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadBillingEvents();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/admin/billing/events");
    expect(seen[0]).not.toContain("userId=");
    expect(seen[0]).not.toContain("outcome=");
  });

  it("appends an encoded `userId` query param when given one", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ entries: [], limit: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadBillingEvents({ userId: 42 });
    expect(seen[0]).toContain("userId=42");
  });

  it("appends an `outcome` query param when given one", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ entries: [], limit: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadBillingEvents({ outcome: "error" });
    expect(seen[0]).toContain("outcome=error");
  });

  it("returns `ready` for the controller's real response shape, including a null subject and null error", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          entries: [
            {
              provider: "stripe",
              providerEventId: "evt_2",
              type: "payment_intent.created",
              outcome: "ignored_unhandled",
              error: null,
              subjectPseudonym: null,
              providerCreatedAt: 1_700_000_010_000,
              receivedAt: 1_700_000_010_500,
              processedAt: 1_700_000_010_600,
            },
            {
              provider: "stripe",
              providerEventId: "evt_1",
              type: "invoice.paid",
              outcome: "applied",
              error: null,
              subjectPseudonym: "u_7f3a19bcde01",
              providerCreatedAt: 1_700_000_000_000,
              receivedAt: 1_700_000_000_500,
              processedAt: 1_700_000_000_600,
            },
          ],
          limit: 200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadBillingEvents();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.entries).toHaveLength(2);
      expect(load.entries[0]!.subjectPseudonym).toBeNull();
      expect(load.entries[0]!.outcome).toBe("ignored_unhandled");
      expect(load.entries[1]!.subjectPseudonym).toBe("u_7f3a19bcde01");
      expect(load.limit).toBe(200);
    }
  });

  it("a network throw becomes `unavailable`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const load = await loadBillingEvents();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("Failed to fetch");
  });

  it("a 403 names the reason as an admin-account requirement", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    const load = await loadBillingEvents();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("admin account");
  });

  it("a 200 whose JSON has no `entries` becomes `unavailable`, never an empty ready", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const load = await loadBillingEvents();
    expect(load.state).toBe("unavailable");
  });

  it("a 200 carrying HTML becomes `unavailable`, never a fabricated report", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html></html>", { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadBillingEvents();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("not JSON");
  });
});
