/**
 * @vitest-environment jsdom
 */

// `AdminRolesPanel` — the missing UI half of `Admin\AdminRolesController`,
// the admin-roles viewer, never built until now. Mirrors
// `test/purge-ledger-panel.test.tsx`'s three-state discipline.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { AdminRolesPanel } from "@/components/admin/AdminRolesPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const qariGrant = {
  subjectPseudonym: "u_7f3a19bcde01",
  role: "qari",
  grantedAt: 1_700_000_005_000,
  grantedBy: "bob@example.com",
};

const operatorGrant = {
  subjectPseudonym: "u_a1b2c3d4e5f6",
  role: "operator",
  grantedAt: 1_700_000_000_000,
  grantedBy: "cli",
};

describe("AdminRolesPanel — three states, never two", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("LOADING renders no entries at all", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<AdminRolesPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("UNAVAILABLE names the reason and shows no fabricated rows", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<AdminRolesPanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByText("cli")).toBeNull();
  });

  it("READY renders every entry's subject, role, grant time and granter, newest first", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ entries: [qariGrant, operatorGrant], limit: 200 }),
    ) as unknown as typeof fetch;
    render(<AdminRolesPanel />);

    await waitFor(() => expect(screen.getByText("u_7f3a19bcde01")).toBeTruthy());
    expect(screen.getByText("u_a1b2c3d4e5f6")).toBeTruthy();
    expect(screen.getByRole("cell", { name: "qari" })).toBeTruthy();
    expect(screen.getByText("bob@example.com")).toBeTruthy();
    expect(screen.getByText("cli")).toBeTruthy();
    expect(screen.getByText(new Date(1_700_000_005_000).toISOString())).toBeTruthy();

    // Newest first: the qari grant's row must precede the operator grant's.
    const cells = screen.getAllByRole("cell").map((c) => c.textContent);
    const qariIdx = cells.indexOf("u_7f3a19bcde01");
    const operatorIdx = cells.indexOf("u_a1b2c3d4e5f6");
    expect(qariIdx).toBeGreaterThanOrEqual(0);
    expect(qariIdx).toBeLessThan(operatorIdx);
  });

  it("a genuinely empty roster says so, and never fabricates a row", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ entries: [], limit: 200 })) as unknown as typeof fetch;
    render(<AdminRolesPanel />);
    await waitFor(() => expect(screen.getByText(/no admin role grants recorded yet/i)).toBeTruthy());
  });
});

describe("AdminRolesPanel — the role and admin-id filters", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("choosing a role requests it as a `role` query param", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      return jsonResponse({
        entries: url.includes("role=qari") ? [qariGrant] : [qariGrant, operatorGrant],
        limit: 200,
      });
    }) as unknown as typeof fetch;

    render(<AdminRolesPanel />);
    await waitFor(() => expect(screen.getByText("u_a1b2c3d4e5f6")).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: "qari" } });

    await waitFor(() => expect(seen.some((u) => u.includes("role=qari"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("u_a1b2c3d4e5f6")).toBeNull());
  });

  it("filtering by a typed admin id requests it as a `userId` query param", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      return jsonResponse({
        entries: url.includes("userId=") ? [qariGrant] : [qariGrant, operatorGrant],
        limit: 200,
      });
    }) as unknown as typeof fetch;

    render(<AdminRolesPanel />);
    await waitFor(() => expect(screen.getByText("u_a1b2c3d4e5f6")).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/admin id/i), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));

    await waitFor(() => expect(seen.some((u) => u.includes("userId=42"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("u_a1b2c3d4e5f6")).toBeNull());
  });

  it("a non-numeric typed admin id is ignored rather than sent as a broken filter", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonResponse({ entries: [qariGrant, operatorGrant], limit: 200 });
    }) as unknown as typeof fetch;

    render(<AdminRolesPanel />);
    await waitFor(() => expect(screen.getByText("u_a1b2c3d4e5f6")).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/admin id/i), { target: { value: "not-a-number" } });
    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));

    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen.every((u) => !u.includes("userId="))).toBe(true);
  });
});
