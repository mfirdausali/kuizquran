/**
 * @vitest-environment jsdom
 */

// `PlanPanel` — see the component's own header for why this exists:
// `readEntitlementSnapshot`/`refreshEntitlementSnapshot` (v3-D88/v3-D89) had
// zero renderers anywhere in the app until this panel. What a pure test on
// `planSummary.ts` cannot reach:
//
//   1. IT ACTUALLY FETCHES on mount, and renders the live answer.
//   2. A FAILED LIVE FETCH FALLS BACK TO THE CACHE, never a blank/broken
//      screen for an offline learner who has synced before.
//   3. A GENUINELY UNAVAILABLE STATE (no live fetch, no prior cache) shows an
//      honest banner, never a false default.
//   4. THE THREE STATES ARE DISTINCT RENDERS, matching this codebase's own
//      "checking / unavailable / ready" discipline (`AnchorHourPanel` et al.).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { resetDbForTests } from "@/lib/idb/db.ts";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { resetTokenForTests } from "@/lib/sync/token";
import { PlanPanel } from "@/components/settings/PlanPanel";

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  resetApiFetchForTests();
  resetTokenForTests();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PlanPanel", () => {
  it("renders the live entitlement snapshot on mount", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(200, { state: "active", tier: "lifetime", region: "INTL", trialSurah: null, trialStartedAt: null }),
    );

    render(<PlanPanel />);

    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/plan is active/i);
    expect(screen.getByText(/lifetime/)).toBeTruthy();
    expect(screen.getByText(/INTL/)).toBeTruthy();
  });

  it("a trial in progress reports days remaining, computed from trialStartedAt", async () => {
    const now = Date.now();
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(200, {
        state: "trial",
        tier: "none",
        region: "MY",
        trialSurah: 67,
        trialStartedAt: now - 3 * 24 * 60 * 60 * 1000,
      }),
    );

    render(<PlanPanel />);

    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/11 days left/);
  });

  it("falls back to the last cached snapshot when the live fetch fails, never a blank screen", async () => {
    // First render: a real successful fetch persists a cache entry.
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(200, { state: "active", tier: "monthly", region: "MY", trialSurah: null, trialStartedAt: null }),
    );
    const { unmount } = render(<PlanPanel />);
    await screen.findByRole("status");
    unmount();
    cleanup();

    // Second render: the live fetch now fails outright.
    vi.mocked(fetch).mockResolvedValueOnce(new Response("server error", { status: 500 }));
    render(<PlanPanel />);

    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/plan is active/i);
    // And the panel says honestly that this is a stale, cached answer.
    expect(screen.getByText(/last known status/i)).toBeTruthy();
  });

  it("shows an honest unavailable banner when there is no live fetch and no prior cache", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("server error", { status: 500 }));

    render(<PlanPanel />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/could not read your plan status/i);
  });

  it("never claims a state before the fetch resolves — loading is a distinct render", () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    render(<PlanPanel />);
    expect(screen.getByText(/checking your plan/i)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a lapsed learner sees review-stays-open language, not a bare 'lapsed_review_only' literal", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(200, {
        state: "lapsed_review_only",
        tier: "monthly",
        region: "MY",
        trialSurah: null,
        trialStartedAt: null,
      }),
    );

    render(<PlanPanel />);

    const status = await screen.findByRole("status");
    expect(status.textContent).not.toMatch(/lapsed_review_only/);
    expect(status.textContent).toMatch(/review.*stays open forever/i);
  });
});
