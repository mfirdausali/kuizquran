// `lib/admin/flagAudit.ts` — the missing frontend half of the new
// `Admin\FlagAuditController` (build-plan step 26, M8: "nav homes for
// flags/reports/templates/audit viewer"). `FlagRampAudit` has been written
// by `FlagService::kill`/`ramp`/`acknowledgeKill` since the flag plane
// shipped and read by nothing — the gap v3-D125 named as a sibling of
// `AdminAudit`'s own "written, never read" shape (fixed for `AdminAudit` in
// v3-D129). Mirrors `lib/admin/audit.test.ts`'s three-state discipline and
// the real controller's response shape exactly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { loadFlagAudit } from "./flagAudit";

describe("loadFlagAudit — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/admin/flags/audit through the single egress, no flag filter by default", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ entries: [], limit: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadFlagAudit();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/admin/flags/audit");
    expect(seen[0]).not.toContain("flag=");
  });

  it("appends an encoded `flag` query param when given one", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ entries: [], limit: 200 }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadFlagAudit("social.leaderboard");
    expect(seen[0]).toContain("/api/admin/flags/audit?flag=social.leaderboard");
  });

  it("returns `ready` for the controller's real response shape, including a null system actor", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          entries: [
            {
              flagKey: "social.leaderboard",
              action: "enable",
              actor: "u_1a2b3c4d5e6f",
              reason: "re-ramping after the retention fix shipped",
              acknowledgesRetentionRisk: true,
              acknowledgesNoDarkPattern: true,
              typedFlagName: "social.leaderboard",
              at: 1_700_000_005_000,
            },
            {
              flagKey: "social.leaderboard",
              action: "auto_waive",
              actor: null,
              reason: null,
              acknowledgesRetentionRisk: false,
              acknowledgesNoDarkPattern: false,
              typedFlagName: null,
              at: 1_700_000_000_000,
            },
          ],
          limit: 200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadFlagAudit();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.entries).toHaveLength(2);
      expect(load.entries[0]!.action).toBe("enable");
      expect(load.entries[0]!.actor).toBe("u_1a2b3c4d5e6f");
      expect(load.entries[1]!.action).toBe("auto_waive");
      expect(load.entries[1]!.actor).toBeNull();
      expect(load.limit).toBe(200);
    }
  });

  it("a network throw becomes `unavailable`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const load = await loadFlagAudit();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("Failed to fetch");
  });

  it("a 403 names the reason as an admin-account requirement", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    const load = await loadFlagAudit();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("admin account");
  });

  it("a 200 whose JSON has no `entries` becomes `unavailable`, never an empty ready", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const load = await loadFlagAudit();
    expect(load.state).toBe("unavailable");
  });

  it("a 200 carrying HTML becomes `unavailable`, never a fabricated report", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html></html>", { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadFlagAudit();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("not JSON");
  });
});
