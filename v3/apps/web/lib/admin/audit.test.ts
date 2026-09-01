// `lib/admin/audit.ts` — the missing frontend half of `Admin\AdminAuditController`
// (build-plan step 24, M8: "nav homes for flags/reports/templates/audit
// viewer"). Mirrors `lib/admin/flags.test.ts`'s three-state discipline and
// the real controller's response shape exactly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { loadAudit } from "./audit";

describe("loadAudit — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/admin/audit through the single egress, no subject filter by default", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ entries: [], limit: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadAudit();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/admin/audit");
    expect(seen[0]).not.toContain("subject=");
  });

  it("appends an encoded `subject` query param when given one", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ entries: [], limit: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadAudit("u_7f3a19bcde01");
    expect(seen[0]).toContain("/api/admin/audit?subject=u_7f3a19bcde01");
  });

  it("returns `ready` for the controller's real response shape", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          entries: [
            {
              actor: "u_1a2b3c4d5e6f",
              action: "reveal_identity",
              subjectPseudonym: "u_7f3a19bcde01",
              reasonCode: "support_ticket",
              reasonText: "investigating ticket 4821",
              at: 1_700_000_005_000,
              ip: "203.0.113.7",
              requestId: "req-abc123",
            },
            {
              actor: "u_1a2b3c4d5e6f",
              action: "export_users_csv",
              subjectPseudonym: null,
              reasonCode: "support_ticket",
              reasonText: "bulk pseudonymous export",
              at: 1_700_000_000_000,
              ip: "203.0.113.9",
              requestId: null,
            },
          ],
          limit: 200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadAudit();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.entries).toHaveLength(2);
      expect(load.entries[0]!.action).toBe("reveal_identity");
      expect(load.entries[0]!.subjectPseudonym).toBe("u_7f3a19bcde01");
      expect(load.entries[1]!.subjectPseudonym).toBeNull();
      expect(load.limit).toBe(200);
    }
  });

  it("carries `ip`/`requestId` through, including a genuinely null requestId", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          entries: [
            {
              actor: "u_1a2b3c4d5e6f",
              action: "rebuild_atom_cache",
              subjectPseudonym: null,
              reasonCode: "support_ticket",
              reasonText: "re-derive atom cache from the event log",
              at: 1_700_000_001_000,
              ip: "203.0.113.9",
              requestId: null,
            },
          ],
          limit: 200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadAudit();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.entries[0]!.ip).toBe("203.0.113.9");
      expect(load.entries[0]!.requestId).toBeNull();
    }
  });

  it("a response missing `ip`/`requestId` becomes `unavailable`, never a fabricated null", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          entries: [
            {
              actor: "u_1a2b3c4d5e6f",
              action: "reveal_identity",
              subjectPseudonym: null,
              reasonCode: "support_ticket",
              reasonText: "missing the new fields",
              at: 1_700_000_000_000,
            },
          ],
          limit: 200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadAudit();
    expect(load.state).toBe("unavailable");
  });

  it("a network throw becomes `unavailable`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const load = await loadAudit();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("Failed to fetch");
  });

  it("a 403 names the reason as an admin-account requirement", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    const load = await loadAudit();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("admin account");
  });

  it("a 200 whose JSON has no `entries` becomes `unavailable`, never an empty ready", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const load = await loadAudit();
    expect(load.state).toBe("unavailable");
  });

  it("a 200 carrying HTML becomes `unavailable`, never a fabricated report", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html></html>", { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadAudit();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("not JSON");
  });
});
