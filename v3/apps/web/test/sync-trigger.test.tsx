/**
 * @vitest-environment jsdom
 */

// SyncTrigger — the missing WIRE for lib/sync/sync.ts#syncCycle().
//
// Found by the prior nightly run (DECISIONS.md v3-D88's "adjacent finding"):
// `syncCycle`/`pushOutbox`/`pullFromServer`/`shouldAttemptSync`/`backoffMs`
// were all built and unit-tested since build-plan step 21, exported from the
// module's own public barrel (`lib/sync/index.ts`), and had ZERO production
// callers anywhere in `apps/web` — `grep -rln "syncCycle" apps/web` (excluding
// tests) returned nothing outside `lib/sync/` itself. B5's actual fix
// (merge.ts) was real, but nothing ever CALLED the function that reaches it in
// a running app: a learner's second device never received their events.
//
// Modelled on v2's own precedent for this exact wiring —
// `v2/src/sync/useBackgroundSync.ts` — mount + `online` + `focus`, because
// that file already answers "when should this fire" for this codebase's own
// prior generation and nothing in v3 supersedes it. Ported, not invented.
//
// TWO PROPERTIES, each with its own mutation:
//
//   1. IT NEVER BLOCKS (#103). A mount that AWAITS the cycle before painting,
//      or that runs on every render instead of once + on the two events,
//      would violate the same "never a precondition" rule SyncStatus's own
//      suite already pins. Asserted here by NOT awaiting the render call and
//      confirming the component returns null synchronously.
//   2. IT RESPECTS shouldAttemptSync()'S OFFLINE HINT. `sync.ts` exports this
//      function precisely so a caller does not dial a dead network on every
//      focus event; a caller that ignores it uses one write-only export
//      forever. Asserted by forcing `navigator.onLine = false` and proving no
//      request is made.

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { act } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { append } from "@/lib/idb/append";
import { resetDbForTests } from "@/lib/idb/db";
import { writeLock } from "@/lib/idb/writeLock";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { resetSyncSummaryForTests, syncSummary } from "@/lib/sync/summary";
import { resetTokenForTests, setToken } from "@/lib/sync/token";
import { SyncTrigger } from "@/components/shell/SyncTrigger";

interface Call {
  url: string;
  method: string;
}

function installFetch(status = 200): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      if (status !== 200) return new Response("server error", { status });
      const path = String(url);
      if (path.startsWith("/api/events") && (init?.method ?? "GET") === "GET") {
        return new Response(JSON.stringify({ events: [], nextCursor: 0, hasMore: false }), {
          status: 200,
        });
      }
      if (path === "/api/events" && init?.method === "POST") {
        return new Response(JSON.stringify({ accepted: 0, ignored: 0 }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
  return calls;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  writeLock.forceForTests({ role: "writer" });
  resetApiFetchForTests();
  resetSyncSummaryForTests();
  resetTokenForTests();
  setToken("test-token");
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("mounts and runs one reconciliation", () => {
  it("calls the server (a pull, at minimum) once on mount", async () => {
    const calls = installFetch();
    render(<SyncTrigger />);
    await waitFor(() => expect(calls.some((c) => c.url.startsWith("/api/events"))).toBe(true));
  });

  it("renders nothing — a passive background island, not a screen", () => {
    installFetch();
    const { container } = render(<SyncTrigger />);
    expect(container.textContent).toBe("");
    expect(container.innerHTML).toBe("");
  });
});

describe("#103 — it never blocks paint", () => {
  it("returns null synchronously; the cycle runs in an effect, not before paint", () => {
    installFetch();
    // If this component awaited syncCycle before its first render, `render`
    // itself would hang here (jsdom has no fetch by default, and this test
    // doesn't await anything before asserting). It doesn't hang: null paints
    // immediately regardless of how the network call resolves.
    const { container } = render(<SyncTrigger />);
    expect(container.innerHTML).toBe("");
  });
});

describe("re-fires on reconnect and refocus (the v2 useBackgroundSync precedent)", () => {
  it("runs a second cycle on a window 'online' event", async () => {
    const calls = installFetch();
    render(<SyncTrigger />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const before = calls.length;

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(calls.length).toBeGreaterThan(before));
  });

  it("runs a second cycle on a window 'focus' event", async () => {
    const calls = installFetch();
    render(<SyncTrigger />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const before = calls.length;

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(calls.length).toBeGreaterThan(before));
  });
});

describe("v3-D161 — every completed cycle reports to lib/sync/summary.ts", () => {
  it("carries a real #110 oversize quarantine into syncSummary, so SyncStatus can escalate it", async () => {
    installFetch();
    // A genuinely oversize row — over EVENT_BYTE_MAX (8KB) — the same way a
    // real device could produce one (`specSnapshot` is the only unbounded
    // field on the wire). No Arabic anywhere: padding is a plain ASCII
    // filler string, addressed by fixture coordinates like every other test
    // in this file.
    await append(
      {
        type: "tap",
        ts: 1_700_000_000_000,
        surah: 112,
        ayah: 1,
        rung: "S1",
        id: "oversize-1",
        specSnapshot: { pad: "x".repeat(20_000) },
      },
      { now: 1_700_000_000_000, tz: "UTC" },
    );

    expect(syncSummary.current).toEqual({ cannotSync: 0, divergences: 0 });

    render(<SyncTrigger />);

    await waitFor(() => expect(syncSummary.current.cannotSync).toBeGreaterThan(0));
    expect(syncSummary.current).toEqual({ cannotSync: 1, divergences: 0 });
  });
});

describe("shouldAttemptSync() is honoured, not merely exported", () => {
  it("makes no request at all when the browser reports offline", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const calls = installFetch();
    render(<SyncTrigger />);
    // Give any errant effect a turn to run before asserting the negative.
    await act(async () => {
      await Promise.resolve();
    });
    expect(calls.length).toBe(0);
  });
});

describe("cleanup — no reconciliation after unmount", () => {
  it("does not call the server again once unmounted, even on 'online'", async () => {
    const calls = installFetch();
    const { unmount } = render(<SyncTrigger />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    unmount();
    const before = calls.length;

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });
    expect(calls.length).toBe(before);
  });
});

describe("a degraded cycle schedules exactly one retry via backoffMs, not a spin loop", () => {
  it("retries after a failed cycle, and stops retrying once it succeeds", async () => {
    vi.useFakeTimers();
    let status = 500;
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), method: init?.method ?? "GET" });
        if (status !== 200) return new Response("server error", { status });
        return new Response(JSON.stringify({ events: [], nextCursor: 0, hasMore: false }), {
          status: 200,
        });
      }),
    );

    render(<SyncTrigger />);
    // A small, non-zero advance: fake-indexeddb schedules some of its own
    // internal steps via zero-delay timers, so a literal 0ms window can end
    // before every microtask/timer pair in that chain has had a turn.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(calls.length).toBeGreaterThan(0);
    const afterFirst = calls.length;

    // Let the server recover before the retry fires, then run out the longest
    // possible backoff window. A spin loop would have made many more calls
    // than one retry's worth by this point; a dropped retry would make none.
    status = 200;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1_000);
    });
    expect(calls.length).toBeGreaterThan(afterFirst);
    const afterRetry = calls.length;

    // The retry succeeded (status is 200), so the attempt counter must have
    // reset — running the clock out again must NOT produce another spontaneous
    // call with no trigger event.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    expect(calls.length).toBe(afterRetry);
  });
});
