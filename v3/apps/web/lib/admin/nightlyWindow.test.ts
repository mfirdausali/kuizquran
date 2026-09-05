// `lib/admin/nightlyWindow.ts` — the missing frontend half of
// `Admin\NightlyWindowController`, the 7-consecutive-green-nights window
// viewer, never built until now. Mirrors `lib/admin/purgeLedger.test.ts`'s
// three-state discipline and the real controller's response shape exactly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { loadNightlyWindow } from "./nightlyWindow";

const readyStatus = {
  streak: 3,
  required: 7,
  satisfied: false,
  windowStartedAt: "2026-09-01",
  windowReason: "engine merge abc1234",
  nights: [
    { night: "2026-09-01", green: true, severities: { fold_determinism_check: "green" }, missing: [] },
  ],
  lastP1: null,
  blockedBy: "3 of 7 consecutive green nights",
};

describe("loadNightlyWindow — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/admin/nightly-window through the single egress", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify(readyStatus), { status: 200 });
    }) as unknown as typeof fetch;

    await loadNightlyWindow();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/admin/nightly-window");
  });

  it("returns `ready` for the controller's real response shape", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(readyStatus), { status: 200, headers: { "Content-Type": "application/json" } }),
    ) as unknown as typeof fetch;

    const load = await loadNightlyWindow();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.status.streak).toBe(3);
      expect(load.status.required).toBe(7);
      expect(load.status.satisfied).toBe(false);
      expect(load.status.windowStartedAt).toBe("2026-09-01");
      expect(load.status.nights).toHaveLength(1);
      expect(load.status.lastP1).toBeNull();
    }
  });

  it("a satisfied window with a confirmed P1 in its history round-trips lastP1", async () => {
    const status = { ...readyStatus, streak: 1, lastP1: { night: "2026-09-03", check: "fold_determinism_check" } };
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(status), { status: 200 })) as unknown as typeof fetch;

    const load = await loadNightlyWindow();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.status.lastP1).toEqual({ night: "2026-09-03", check: "fold_determinism_check" });
    }
  });

  it("a confirmed P1's pseudonymized findings round-trip verbatim (v3-D178)", async () => {
    const status = {
      ...readyStatus,
      streak: 1,
      lastP1: { night: "2026-09-03", check: "fold_determinism_check" },
      lastP1Findings: [
        { type: "fold", subjectPseudonym: "u_abc123", key: "12:ayah:5", kind: "divergence", cachedVersion: null },
        { type: "fold", subjectPseudonym: "u_def456", key: "12:ayah:9", kind: "skew", cachedVersion: "2026.08.01" },
      ],
    };
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(status), { status: 200 })) as unknown as typeof fetch;

    const load = await loadNightlyWindow();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.status.lastP1Findings).toEqual(status.lastP1Findings);
    }
  });

  /** v3-D179: a `selection_determinism_check` P1's own findings are a
   *  different shape than a fold P1's — no `subjectPseudonym`/`key`/`kind`,
   *  and no learner id at all, since the check replays a committed fixture
   *  log rather than production events. */
  it("a selection-check P1's own divergence findings round-trip verbatim (v3-D179)", async () => {
    const status = {
      ...readyStatus,
      streak: 1,
      lastP1: { night: "2026-09-03", check: "selection_determinism_check" },
      lastP1Findings: [
        {
          type: "selection",
          seed: 7,
          traceKey: "site-a:device-1:3",
          baseline: { lane: "s1", variantIndex: 0 },
          replayed: { lane: "cloze", variantIndex: 1 },
        },
        { type: "selection", seed: 42, traceKey: "site-b:device-2:1", baseline: null, replayed: null },
      ],
    };
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(status), { status: 200 })) as unknown as typeof fetch;

    const load = await loadNightlyWindow();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.status.lastP1Findings).toEqual(status.lastP1Findings);
    }
  });

  /** A malformed selection finding (missing `traceKey`) must degrade the
   *  whole list to null, the exact same discipline as a malformed fold
   *  finding — never a partial fabrication. */
  it("a malformed selection finding degrades the whole list to null", async () => {
    const status = {
      ...readyStatus,
      lastP1: { night: "2026-09-03", check: "selection_determinism_check" },
      lastP1Findings: [{ type: "selection", seed: 7 /* missing traceKey */ }],
    };
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(status), { status: 200 })) as unknown as typeof fetch;

    const load = await loadNightlyWindow();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.status.lastP1Findings).toBeNull();
    }
  });

  it("no confirmed P1 means null findings, never a fabricated empty list", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(readyStatus), { status: 200 })) as unknown as typeof fetch;

    const load = await loadNightlyWindow();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.status.lastP1Findings).toBeNull();
    }
  });

  it("a malformed lastP1Findings entry degrades the whole list to null, never a partial fabrication", async () => {
    const status = {
      ...readyStatus,
      lastP1: { night: "2026-09-03", check: "fold_determinism_check" },
      lastP1Findings: [{ subjectPseudonym: "u_abc123", key: "12:ayah:5" /* missing kind/cachedVersion */ }],
    };
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(status), { status: 200 })) as unknown as typeof fetch;

    const load = await loadNightlyWindow();
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.status.lastP1Findings).toBeNull();
    }
  });

  it("a network throw becomes `unavailable`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const load = await loadNightlyWindow();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("Failed to fetch");
  });

  it("a 403 names the reason as an admin-account requirement", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    const load = await loadNightlyWindow();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("admin account");
  });

  it("a 200 whose JSON has no `streak` becomes `unavailable`, never a fabricated report", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const load = await loadNightlyWindow();
    expect(load.state).toBe("unavailable");
  });

  it("a 200 carrying HTML becomes `unavailable`, never a fabricated report", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html></html>", { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadNightlyWindow();
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("not JSON");
  });
});
