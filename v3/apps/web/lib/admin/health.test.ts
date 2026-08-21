// `lib/admin/health.ts` — the missing frontend half of
// `Admin\SystemHealthController` (build-plan step 24). Mirrors
// `lib/workbench/verifications.ts`'s own `loadFrontier` test shape: failure
// is a STATE, never an exception, and the real controller response shapes
// (pinned by `tests/Feature/Admin/SystemHealthTest.php`) are decoded exactly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { loadHealth, rebuildAtomCache } from "./health";

describe("loadHealth — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/admin/health through the single egress", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ checks: [], rebuildRunning: false }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadHealth();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/admin/health");
  });

  it("returns `ready` for the controller's real response shape", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          checks: [
            { metric: "fold_determinism_check", status: "ok", value: 0, detail: null },
            {
              metric: "selection_determinism_check",
              status: "unknown",
              value: null,
              detail: "probe failed: no selection_determinism_check result recorded",
            },
          ],
          rebuildRunning: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadHealth();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.report.checks).toHaveLength(2);
      expect(load.report.checks[0]!.status).toBe("ok");
      expect(load.report.checks[0]!.value).toBe(0);
      expect(load.report.checks[1]!.status).toBe("unknown");
      expect(load.report.checks[1]!.value).toBeNull();
    }
  });

  /**
   * EDGE CASE #167, at the frontend layer: a genuine 0 and an unreported
   * `unknown` must decode to DIFFERENT statuses, never collapsed to the same
   * thing by a `?? 0`-shaped bug in the reducer.
   */
  it("a genuine zero and an unreported unknown stay distinguishable", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          checks: [
            { metric: "fold_determinism_check", status: "ok", value: 0, detail: null },
            { metric: "selection_determinism_check", status: "unknown", value: null, detail: "x" },
          ],
          rebuildRunning: false,
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const load = await loadHealth();
    if (load.state !== "ready") throw new Error("expected ready");
    const [ok, unknown] = load.report.checks;
    expect(ok!.status).not.toBe(unknown!.status);
    expect(ok!.value).toBe(0);
    expect(unknown!.value).toBeNull();
  });

  it("a network throw becomes `unavailable`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const load = await loadHealth();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("Failed to fetch");
  });

  it("a 403 names the reason as an admin-account requirement", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    const load = await loadHealth();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("admin account");
  });

  it("a 200 whose JSON has no `checks` becomes `unavailable`, never an empty ready", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ rebuildRunning: false }), { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadHealth();
    expect(load.state).toBe("unavailable");
  });

  it("a 200 carrying HTML becomes `unavailable`, never a fabricated report", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html></html>", { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadHealth();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("not JSON");
  });
});

describe("rebuildAtomCache — the #168 mutex outcomes, distinguishable", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts to /api/admin/health/rebuild-atom-cache", async () => {
    const seen: Array<{ url: string; method: string }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), method: init?.method ?? "GET" });
      return new Response(JSON.stringify({ started: true, queued: false, usersProcessed: 1, atomsWritten: 2 }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    await rebuildAtomCache();
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("/api/admin/health/rebuild-atom-cache");
    expect(seen[0]!.method).toBe("POST");
  });

  it("a completed rebuild reports ok with the real counts", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ started: true, queued: false, usersProcessed: 4, atomsWritten: 9 }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;

    const outcome = await rebuildAtomCache();
    expect(outcome.ok).toBe(true);
    expect(outcome.queued).toBe(false);
    expect(outcome.usersProcessed).toBe(4);
    expect(outcome.atomsWritten).toBe(9);
  });

  /**
   * Edge case #130's other half (v3-D114 left this open;
   * AtomCacheRebuilder's own fix closes it): a dead-lettered learner's
   * existing atom_cache rows are left untouched, never wiped — the client
   * must surface that a rebuild completed WITH a quarantine, not silently
   * drop it.
   */
  it("a completed rebuild with dead letters reports the count, still ok", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          started: true,
          queued: false,
          usersProcessed: 4,
          atomsWritten: 9,
          deadLetters: [{ userId: 7, error: "unencodable event data" }],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const outcome = await rebuildAtomCache();
    expect(outcome.ok).toBe(true);
    expect(outcome.deadLetterCount).toBe(1);
  });

  it("a completed rebuild with an empty dead-letter list reports a genuine zero", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ started: true, queued: false, usersProcessed: 4, atomsWritten: 9, deadLetters: [] }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const outcome = await rebuildAtomCache();
    expect(outcome.deadLetterCount).toBe(0);
  });

  /** #168: a 202 while another rebuild holds the lock — QUEUED, never a failure. */
  it("a 202 while the mutex is held reports queued, not ok, not a bare failure", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          started: false,
          queued: true,
          reason: "a rebuild is already running; this request is queued, never run concurrently",
        }),
        { status: 202 },
      ),
    ) as unknown as typeof fetch;

    const outcome = await rebuildAtomCache();
    expect(outcome.ok).toBe(false);
    expect(outcome.queued).toBe(true);
    expect(outcome.message).toContain("already running");
  });

  it("a 500 failure is reported, never mistaken for a completed rebuild", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ started: false, queued: false, reason: "rebuild failed: boom" }), {
        status: 500,
      }),
    ) as unknown as typeof fetch;

    const outcome = await rebuildAtomCache();
    expect(outcome.ok).toBe(false);
    expect(outcome.queued).toBe(false);
    expect(outcome.message).toContain("boom");
  });

  it("a network throw becomes a non-ok outcome, never a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const outcome = await rebuildAtomCache();
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("Failed to fetch");
  });
});
