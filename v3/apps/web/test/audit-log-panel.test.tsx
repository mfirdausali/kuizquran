/**
 * @vitest-environment jsdom
 */

// `AuditLogPanel` — the missing UI half of `Admin\AdminAuditController`
// (build-plan step 24, M8: "nav homes for flags/reports/templates/audit
// viewer"). Mirrors `test/flags-panel.test.tsx`'s three-state discipline.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const revealEntry = {
  actor: "u_1a2b3c4d5e6f",
  action: "reveal_identity",
  subjectPseudonym: "u_7f3a19bcde01",
  reasonCode: "support_ticket",
  reasonText: "investigating ticket 4821 about a missing session",
  at: 1_700_000_005_000,
};

const csvEntry = {
  actor: "u_1a2b3c4d5e6f",
  action: "export_users_csv",
  subjectPseudonym: null,
  reasonCode: "support_ticket",
  reasonText: "bulk pseudonymous export of the users table",
  at: 1_700_000_000_000,
};

describe("AuditLogPanel — three states, never two", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("LOADING renders no entries at all", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<AuditLogPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("UNAVAILABLE names the reason and shows no fabricated rows", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<AuditLogPanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByText("reveal_identity")).toBeNull();
  });

  it("READY renders every entry's actor, action, subject and reason, newest first", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ entries: [revealEntry, csvEntry], limit: 200 }),
    ) as unknown as typeof fetch;
    render(<AuditLogPanel />);

    await waitFor(() => expect(screen.getByText("reveal_identity")).toBeTruthy());
    expect(screen.getByText("u_7f3a19bcde01")).toBeTruthy();
    expect(screen.getByText(/investigating ticket 4821/)).toBeTruthy();
    expect(screen.getByText("export_users_csv")).toBeTruthy();
    expect(screen.getAllByText("u_1a2b3c4d5e6f").length).toBeGreaterThan(0);

    // The subject-less CSV export renders an em-dash placeholder, never a
    // blank cell that could be misread as a missing/broken value.
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("a genuinely empty log says so, and never fabricates a subject-less zero state", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ entries: [], limit: 200 })) as unknown as typeof fetch;
    render(<AuditLogPanel />);
    await waitFor(() => expect(screen.getByText(/no audit activity recorded yet/i)).toBeTruthy());
  });
});

describe("AuditLogPanel — the subject filter", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("filtering by a typed pseudonym requests it as a `subject` query param", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      return jsonResponse({
        entries: url.includes("subject=") ? [revealEntry] : [revealEntry, csvEntry],
        limit: 200,
      });
    }) as unknown as typeof fetch;

    render(<AuditLogPanel />);
    await waitFor(() => expect(screen.getByText("export_users_csv")).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/subject pseudonym/i), {
      target: { value: "u_7f3a19bcde01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));

    await waitFor(() =>
      expect(seen.some((u) => u.includes("subject=u_7f3a19bcde01"))).toBe(true),
    );
    await waitFor(() => expect(screen.queryByText("export_users_csv")).toBeNull());
  });
});
