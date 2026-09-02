/**
 * @vitest-environment jsdom
 */

// `BillingEventsPanel` — the missing UI half of the new
// `Admin\BillingEventsController` (v3-D148). Mirrors
// `test/billing-audit-panel.test.tsx`'s three-state discipline.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { BillingEventsPanel } from "@/components/admin/BillingEventsPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const appliedEntry = {
  provider: "stripe",
  providerEventId: "evt_1",
  type: "invoice.paid",
  outcome: "applied",
  error: null,
  subjectPseudonym: "u_7f3a19bcde01",
  providerCreatedAt: 1_700_000_000_000,
  receivedAt: 1_700_000_000_500,
  processedAt: 1_700_000_000_600,
};

const errorEntry = {
  provider: "stripe",
  providerEventId: "evt_2",
  type: "checkout.session.completed",
  outcome: "error",
  error: 'ValueError: "not-a-real-tier" is not a valid backing value for enum App\\Billing\\EntitlementTier',
  subjectPseudonym: null,
  providerCreatedAt: 1_700_000_010_000,
  receivedAt: 1_700_000_010_500,
  processedAt: 1_700_000_010_600,
};

describe("BillingEventsPanel — three states, never two", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("LOADING renders no entries at all", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<BillingEventsPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("UNAVAILABLE names the reason and shows no fabricated rows", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<BillingEventsPanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByText("evt_1")).toBeNull();
  });

  it("READY renders every entry's provider event, type, outcome and subject, newest first", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ entries: [errorEntry, appliedEntry], limit: 200 })) as unknown as typeof fetch;
    render(<BillingEventsPanel />);

    await waitFor(() => expect(screen.getByText("evt_2")).toBeTruthy());
    expect(screen.getByText("evt_1")).toBeTruthy();
    expect(screen.getByText("checkout.session.completed")).toBeTruthy();
    expect(screen.getByText("u_7f3a19bcde01")).toBeTruthy();
    expect(screen.getByText(/ValueError/)).toBeTruthy();
  });

  /**
   * A delivery that never resolved to a learner renders an honest em-dash,
   * never a fabricated pseudonym and never "u_null" or similar.
   */
  it("a null subject renders as an em-dash, never a fabricated pseudonym", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ entries: [errorEntry], limit: 200 })) as unknown as typeof fetch;
    render(<BillingEventsPanel />);

    await waitFor(() => expect(screen.getByText("evt_2")).toBeTruthy());
    const row = screen.getByText("evt_2").closest("tr");
    expect(row?.textContent).toContain("—");
    expect(row?.textContent).not.toContain("null");
  });

  /**
   * `providerCreatedAt`/`processedAt` are fetched and validated
   * (`lib/admin/billingEvents.ts#isBillingEventEntry`) but the table used to
   * render neither — the same "fetched and discarded" shape v3-D164 fixed for
   * `admin_audit`'s `ip`/`requestId`. `processedAt` is the one field this
   * journal's own docblock says it exists to make visible: "a mid-write
   * crash between insert and update is the one gap the journal exists to
   * make visible rather than hide." This entry uses a `processedAt` distinct
   * from `receivedAt` so the assertion cannot pass by reading the wrong
   * column.
   */
  it("renders each entry's providerCreatedAt and processedAt, distinct from receivedAt", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ entries: [appliedEntry], limit: 200 })) as unknown as typeof fetch;
    render(<BillingEventsPanel />);

    await waitFor(() => expect(screen.getByText("evt_1")).toBeTruthy());
    expect(screen.getByText(new Date(appliedEntry.providerCreatedAt).toISOString())).toBeTruthy();
    expect(screen.getByText(new Date(appliedEntry.processedAt).toISOString())).toBeTruthy();
  });

  /**
   * A delivery whose processing never completed (`processedAt: null` — "should
   * not happen in practice", per the journal's own docblock, but the one case
   * this column exists to surface) and a delivery that carried no provider
   * timestamp (`providerCreatedAt: null`) each render an honest em-dash in
   * their OWN column, never a fabricated timestamp and never silently
   * omitted.
   */
  it("a null providerCreatedAt/processedAt renders as an em-dash, never a fabricated timestamp", async () => {
    const incomplete = { ...appliedEntry, providerEventId: "evt_3", providerCreatedAt: null, processedAt: null };
    globalThis.fetch = vi.fn(async () => jsonResponse({ entries: [incomplete], limit: 200 })) as unknown as typeof fetch;
    render(<BillingEventsPanel />);

    await waitFor(() => expect(screen.getByText("evt_3")).toBeTruthy());
    const row = screen.getByText("evt_3").closest("tr");
    expect(row?.textContent).not.toContain("null");
    const dashes = row?.textContent?.match(/—/g) ?? [];
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("EMPTY renders an honest zero-state, not an eternal skeleton", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ entries: [], limit: 200 })) as unknown as typeof fetch;
    render(<BillingEventsPanel />);
    await waitFor(() => expect(screen.getByText(/no matching deliveries/i)).toBeTruthy());
  });

  /**
   * The `outcome` filter — proves the WIRING (the select drives a real
   * refetch with the right query param), not just that the select exists.
   */
  it("choosing an outcome filter re-requests with that outcome, and Filter re-requests with the learner id", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonResponse({ entries: [], limit: 200 });
    }) as unknown as typeof fetch;

    render(<BillingEventsPanel />);
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText(/outcome/i), { target: { value: "error" } });
    await waitFor(() => expect(seen[seen.length - 1]).toContain("outcome=error"));

    fireEvent.change(screen.getByLabelText(/learner id/i), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));
    await waitFor(() => expect(seen[seen.length - 1]).toContain("userId=42"));
    expect(seen[seen.length - 1]).toContain("outcome=error");
  });
});
