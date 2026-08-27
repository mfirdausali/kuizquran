// `lib/admin/purgeLedger.ts` — the missing frontend half of
// `Admin\PurgeLedgerController`, the PDPA purge-ledger viewer, never built
// until now. Mirrors `lib/admin/billingAudit.test.ts`'s three-state
// discipline and the real controller's response shape exactly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { loadPurgeLedger } from "./purgeLedger";

describe("loadPurgeLedger — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/admin/purge-ledger through the single egress, no userId filter by default", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ entries: [], limit: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadPurgeLedger();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/admin/purge-ledger");
    expect(seen[0]).not.toContain("userId=");
  });

  it("appends an encoded `userId` query param when given one", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ entries: [], limit: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadPurgeLedger(42);
    expect(seen[0]).toContain("/api/admin/purge-ledger?userId=42");
  });

  it("returns `ready` for the controller's real response shape", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          entries: [
            { subjectPseudonym: "u_7f3a19bcde01", purgedAtMs: 1_700_000_005_000, reason: "pdpa_delete" },
            { subjectPseudonym: "u_a1b2c3d4e5f6", purgedAtMs: 1_700_000_000_000, reason: "pdpa_delete" },
          ],
          limit: 200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadPurgeLedger();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.entries).toHaveLength(2);
      expect(load.entries[0]!.purgedAtMs).toBe(1_700_000_005_000);
      expect(load.entries[0]!.reason).toBe("pdpa_delete");
      expect(load.limit).toBe(200);
    }
  });

  it("a network throw becomes `unavailable`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const load = await loadPurgeLedger();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("Failed to fetch");
  });

  it("a 403 names the reason as an admin-account requirement", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    const load = await loadPurgeLedger();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("admin account");
  });

  it("a 200 whose JSON has no `entries` becomes `unavailable`, never an empty ready", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const load = await loadPurgeLedger();
    expect(load.state).toBe("unavailable");
  });

  it("a 200 carrying HTML becomes `unavailable`, never a fabricated report", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html></html>", { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadPurgeLedger();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("not JSON");
  });
});
