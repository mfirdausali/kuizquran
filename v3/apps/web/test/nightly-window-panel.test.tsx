/**
 * @vitest-environment jsdom
 */

// `NightlyWindowPanel` — the missing UI half of `Admin\NightlyWindowController`,
// the 7-consecutive-green-nights window viewer, never built until now.
// Mirrors `test/purge-ledger-panel.test.tsx`'s three-state discipline.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { NightlyWindowPanel } from "@/components/admin/NightlyWindowPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("NightlyWindowPanel — three states, never two", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("LOADING renders no streak at all", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("UNAVAILABLE names the reason and shows no fabricated streak", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByText(/of 7/)).toBeNull();
  });

  it("READY with no window declared shows 0 of 7 and the CLI hint, never a bare number", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 0,
        required: 7,
        satisfied: false,
        windowStartedAt: null,
        windowReason: null,
        nights: [],
        lastP1: null,
        blockedBy: "no window start declared — run `nightly:window --start` after the last engine/selection merge",
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/0 of 7/)).toBeTruthy());
    expect(screen.getByText(/NOT DECLARED/)).toBeTruthy();
    expect(screen.getByText(/nightly:window --start/)).toBeTruthy();
  });

  it("READY with a real 7-night streak renders every night's row and the satisfied verdict", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 7,
        required: 7,
        satisfied: true,
        windowStartedAt: "2026-09-01",
        windowReason: "engine merge abc1234",
        nights: [
          {
            night: "2026-09-07",
            green: true,
            severities: { fold_determinism_check: "green", selection_determinism_check: "green" },
            missing: [],
          },
        ],
        lastP1: null,
        blockedBy: null,
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/7 of 7/)).toBeTruthy());
    expect(screen.getByText(/satisfied/)).toBeTruthy();
    expect(screen.getByText("2026-09-07")).toBeTruthy();
    expect(screen.getByText(/fold_determinism_check=green/)).toBeTruthy();
  });

  /** The load-bearing case: a confirmed P1 must be VISIBLE, not just a
   *  lower streak number — an operator needs to see WHY it reset. */
  it("a confirmed P1 is rendered as an explicit alert naming the night and check", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 1,
        required: 7,
        satisfied: false,
        windowStartedAt: "2026-09-01",
        windowReason: "engine merge abc1234",
        nights: [
          { night: "2026-09-04", green: true, severities: { fold_determinism_check: "green" }, missing: [] },
        ],
        lastP1: { night: "2026-09-03", check: "fold_determinism_check" },
        blockedBy: "1 of 7 consecutive green nights",
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/last P1/i)).toBeTruthy());
    expect(screen.getByText(/2026-09-03/)).toBeTruthy();
    expect(screen.getAllByRole("alert").some((el) => /last P1/i.test(el.textContent ?? ""))).toBe(true);
  });

  it("a night missing one check renders that check as MISSING, not silently dropped", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        streak: 0,
        required: 7,
        satisfied: false,
        windowStartedAt: "2026-09-01",
        windowReason: "test",
        nights: [
          {
            night: "2026-09-02",
            green: false,
            severities: { fold_determinism_check: "green" },
            missing: ["selection_determinism_check"],
          },
        ],
        lastP1: null,
        blockedBy: "0 of 7 consecutive green nights",
      }),
    ) as unknown as typeof fetch;
    render(<NightlyWindowPanel />);

    await waitFor(() => expect(screen.getByText(/selection_determinism_check=MISSING/)).toBeTruthy());
  });
});
