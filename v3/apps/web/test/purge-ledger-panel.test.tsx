/**
 * @vitest-environment jsdom
 */

// `PurgeLedgerPanel` — the missing UI half of `Admin\PurgeLedgerController`,
// the PDPA purge-ledger viewer, never built until now. Mirrors
// `test/billing-audit-panel.test.tsx`'s three-state discipline.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { PurgeLedgerPanel } from "@/components/admin/PurgeLedgerPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const secondPurge = {
  subjectPseudonym: "u_7f3a19bcde01",
  purgedAtMs: 1_700_000_005_000,
  reason: "pdpa_delete",
};

const firstPurge = {
  subjectPseudonym: "u_a1b2c3d4e5f6",
  purgedAtMs: 1_700_000_000_000,
  reason: "pdpa_delete",
};

describe("PurgeLedgerPanel — three states, never two", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("LOADING renders no entries at all", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<PurgeLedgerPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("UNAVAILABLE names the reason and shows no fabricated rows", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<PurgeLedgerPanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByText("pdpa_delete")).toBeNull();
  });

  it("READY renders every entry's subject, purge time and reason, newest first", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ entries: [secondPurge, firstPurge], limit: 200 }),
    ) as unknown as typeof fetch;
    render(<PurgeLedgerPanel />);

    await waitFor(() => expect(screen.getAllByText("pdpa_delete").length).toBe(2));
    expect(screen.getByText("u_7f3a19bcde01")).toBeTruthy();
    expect(screen.getByText("u_a1b2c3d4e5f6")).toBeTruthy();
    expect(screen.getByText(new Date(1_700_000_005_000).toISOString())).toBeTruthy();

    // Newest first: the second purge's row must precede the first's.
    const cells = screen.getAllByRole("cell").map((c) => c.textContent);
    const secondIdx = cells.indexOf("u_7f3a19bcde01");
    const firstIdx = cells.indexOf("u_a1b2c3d4e5f6");
    expect(secondIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeLessThan(firstIdx);
  });

  it("a genuinely empty ledger says so, and never fabricates a row", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ entries: [], limit: 200 })) as unknown as typeof fetch;
    render(<PurgeLedgerPanel />);
    await waitFor(() => expect(screen.getByText(/no accounts have been purged yet/i)).toBeTruthy());
  });
});

describe("PurgeLedgerPanel — the learner-id filter", () => {
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
        entries: url.includes("userId=") ? [secondPurge] : [secondPurge, firstPurge],
        limit: 200,
      });
    }) as unknown as typeof fetch;

    render(<PurgeLedgerPanel />);
    await waitFor(() => expect(screen.getByText("u_a1b2c3d4e5f6")).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/learner id/i), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));

    await waitFor(() => expect(seen.some((u) => u.includes("userId=42"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("u_a1b2c3d4e5f6")).toBeNull());
  });

  it("a non-numeric typed value is ignored rather than sent as a broken filter", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonResponse({ entries: [secondPurge, firstPurge], limit: 200 });
    }) as unknown as typeof fetch;

    render(<PurgeLedgerPanel />);
    await waitFor(() => expect(screen.getByText("u_a1b2c3d4e5f6")).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/learner id/i), { target: { value: "not-a-number" } });
    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));

    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen.every((u) => !u.includes("userId="))).toBe(true);
  });
});
