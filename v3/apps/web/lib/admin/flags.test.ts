// `lib/admin/flags.ts` — the missing frontend half of `Admin\FlagController`
// (build-plan step 26, M8: "nav homes for flags/reports/templates/audit
// viewer"). The backend has been live and fully tested since the flag plane
// shipped (`tests/Feature/Flags/FlagPlaneTest.php`, 13 tests covering #126's
// kill-always-wins race, #127's cache bust, #159's ack-never-re-enables, and
// the M10 security-review versionless-ramp fix) but nothing under `apps/web`
// ever called `/api/admin/flags*` — the same "built + tested + zero
// production callers" shape as v3-D100/D124's `SystemHealthController`/
// `ContentFreezeController` findings. Mirrors `lib/admin/health.ts`'s
// three-state discipline and its real controller response shapes exactly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { acknowledgeFlag, enableFlag, killFlag, loadFlags } from "./flags";

describe("loadFlags — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/admin/flags through the single egress", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ flags: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadFlags();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/admin/flags");
  });

  it("returns `ready` for the controller's real response shape", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          flags: [
            {
              key: "social.leaderboard",
              description: "Ranked leaderboard. v3-D06 forbids ranking at launch.",
              enabled: false,
              version: 0,
              killedAt: null,
              bannerVisible: false,
              ackAt: null,
              ackAutoWaived: false,
            },
            {
              key: "notifications.push",
              description: "Web push reminders. Requires template approval.",
              enabled: true,
              version: 4,
              killedAt: "2026-08-20T03:00:00Z",
              bannerVisible: true,
              ackAt: null,
              ackAutoWaived: false,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadFlags();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.flags).toHaveLength(2);
      expect(load.flags[0]!.key).toBe("social.leaderboard");
      expect(load.flags[0]!.enabled).toBe(false);
      expect(load.flags[1]!.bannerVisible).toBe(true);
      expect(load.flags[1]!.killedAt).toBe("2026-08-20T03:00:00Z");
    }
  });

  it("a network throw becomes `unavailable`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const load = await loadFlags();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("Failed to fetch");
  });

  it("a 403 names the reason as an admin-account requirement", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    const load = await loadFlags();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("admin account");
  });

  it("a 200 whose JSON has no `flags` becomes `unavailable`, never an empty ready", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const load = await loadFlags();
    expect(load.state).toBe("unavailable");
  });

  it("a 200 carrying HTML becomes `unavailable`, never a fabricated report", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html></html>", { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadFlags();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("not JSON");
  });
});

describe("killFlag — #126/#127: unconditional, one click", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts to /api/admin/flags/:key/kill with no body", async () => {
    const seen: Array<{ url: string; method: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), method: init?.method ?? "GET", body: init?.body });
      return new Response(JSON.stringify({ killed: true, key: "social.friends" }), { status: 200 });
    }) as unknown as typeof fetch;

    const outcome = await killFlag("social.friends");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("/api/admin/flags/social.friends/kill");
    expect(seen[0]!.method).toBe("POST");
    expect(outcome.ok).toBe(true);
  });

  it("a network throw becomes a non-ok outcome, never a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const outcome = await killFlag("social.friends");
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("Failed to fetch");
  });

  it("an unknown flag's 404 is reported, not swallowed", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "unknown flag" }), { status: 404 }),
    ) as unknown as typeof fetch;

    const outcome = await killFlag("not.a.real.flag");
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("unknown flag");
  });
});

describe("enableFlag — the ceremony is server-validated, the client just carries it", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  const ceremony = {
    reason: "ramping to 5% to measure retention effect over 28 days",
    typedFlagName: "experiments.scheduler_v2",
    acknowledgesRetentionRisk: true,
    acknowledgesNoDarkPattern: true,
    version: 0,
  };

  it("posts every ceremony field, snake_cased for the Laravel contract", async () => {
    const seen: Array<{ url: string; method: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify({ enabled: true, key: "experiments.scheduler_v2" }), { status: 200 });
    }) as unknown as typeof fetch;

    const outcome = await enableFlag("experiments.scheduler_v2", ceremony);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("/api/admin/flags/experiments.scheduler_v2/enable");
    expect(seen[0]!.method).toBe("POST");
    expect(seen[0]!.body).toEqual({
      reason: ceremony.reason,
      typed_flag_name: ceremony.typedFlagName,
      acknowledges_retention_risk: true,
      acknowledges_no_dark_pattern: true,
      version: 0,
    });
    expect(outcome.ok).toBe(true);
  });

  it("a 422 ceremony-incomplete response surfaces the field errors, not a bare failure", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: "ceremony incomplete",
          errors: { reason: "reason must be at least 20 characters" },
        }),
        { status: 422 },
      ),
    ) as unknown as typeof fetch;

    const outcome = await enableFlag("experiments.scheduler_v2", { ...ceremony, reason: "short" });
    expect(outcome.ok).toBe(false);
    expect(outcome.errors?.reason).toBe("reason must be at least 20 characters");
  });

  /** #126 at the client layer: a 409 must never be read as success. */
  it("a 409 version conflict is reported, never mistaken for success", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: "version conflict — the flag changed underneath you. Re-read and retry." }),
        { status: 409 },
      ),
    ) as unknown as typeof fetch;

    const outcome = await enableFlag("social.leaderboard", ceremony);
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("version conflict");
  });
});

describe("acknowledgeFlag — #159: never claims a re-enable", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts to /api/admin/flags/:key/ack", async () => {
    const seen: Array<{ url: string; method: string }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), method: init?.method ?? "GET" });
      return new Response(JSON.stringify({ acknowledged: true, enabled: false, bannerVisible: true }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const outcome = await acknowledgeFlag("social.activity_feed");
    expect(seen[0]!.url).toContain("/api/admin/flags/social.activity_feed/ack");
    expect(seen[0]!.method).toBe("POST");
    expect(outcome.ok).toBe(true);
  });
});
