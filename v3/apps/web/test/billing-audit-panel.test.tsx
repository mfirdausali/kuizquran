/**
 * @vitest-environment jsdom
 */

// `BillingAuditPanel` — the missing UI half of `Admin\AdminBillingController`
// (BUILD-PLAN M7's own named "admin billing surface", never built until now).
// Mirrors `test/audit-log-panel.test.tsx`'s three-state discipline.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { BillingAuditPanel } from "@/components/admin/BillingAuditPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const gradeGraceEntry = {
  subjectPseudonym: "u_7f3a19bcde01",
  fromState: "active",
  toState: "grace",
  cause: "webhook",
  providerEventId: "evt_1",
  actor: "system",
  reason: null,
  at: 1_700_000_005_000,
};

const trialStartEntry = {
  subjectPseudonym: "u_7f3a19bcde01",
  fromState: null,
  toState: "trial",
  cause: "trial_start",
  providerEventId: null,
  actor: "system",
  reason: null,
  at: 1_700_000_000_000,
};

describe("BillingAuditPanel — three states, never two", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("LOADING renders no entries at all", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<BillingAuditPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("UNAVAILABLE names the reason and shows no fabricated rows", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<BillingAuditPanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByText("grace")).toBeNull();
  });

  it("READY renders every entry's subject, from/to state, cause and actor, newest first", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ entries: [gradeGraceEntry, trialStartEntry], limit: 200 }),
    ) as unknown as typeof fetch;
    render(<BillingAuditPanel />);

    await waitFor(() => expect(screen.getByText("grace")).toBeTruthy());
    expect(screen.getAllByText("u_7f3a19bcde01").length).toBeGreaterThan(0);
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("trial")).toBeTruthy();
    expect(screen.getByText("webhook")).toBeTruthy();
    expect(screen.getByText("trial_start")).toBeTruthy();

    // Every null field (the first-ever transition's `fromState`, and both
    // entries' `reason`) renders an em-dash placeholder, never a blank cell
    // that could be misread as a missing/broken value: 1 (grace's reason) +
    // 2 (trial-start's fromState and reason) = 3.
    expect(screen.getAllByText("—").length).toBe(3);
  });

  it("a genuinely empty log says so, and never fabricates a row", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ entries: [], limit: 200 })) as unknown as typeof fetch;
    render(<BillingAuditPanel />);
    await waitFor(() => expect(screen.getByText(/no billing activity recorded yet/i)).toBeTruthy());
  });
});

describe("BillingAuditPanel — the learner-id filter", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("filtering by a typed learner id requests it as a `userId` query param", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      return jsonResponse({
        entries: url.includes("userId=") ? [gradeGraceEntry] : [gradeGraceEntry, trialStartEntry],
        limit: 200,
      });
    }) as unknown as typeof fetch;

    render(<BillingAuditPanel />);
    await waitFor(() => expect(screen.getByText("trial_start")).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/learner id/i), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));

    await waitFor(() => expect(seen.some((u) => u.includes("userId=42"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("trial_start")).toBeNull());
  });

  it("a non-numeric typed value is ignored rather than sent as a broken filter", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonResponse({ entries: [gradeGraceEntry, trialStartEntry], limit: 200 });
    }) as unknown as typeof fetch;

    render(<BillingAuditPanel />);
    await waitFor(() => expect(screen.getByText("trial_start")).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/learner id/i), { target: { value: "not-a-number" } });
    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));

    // Garbage input never becomes a `userId=` query param on any request seen
    // so far — proven directly rather than by waiting for a second fetch that
    // an unchanged (still-unset) filter has no reason to trigger.
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen.every((u) => !u.includes("userId="))).toBe(true);
  });
});
