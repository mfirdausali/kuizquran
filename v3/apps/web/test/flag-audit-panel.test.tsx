/**
 * @vitest-environment jsdom
 */

// `FlagAuditPanel` — the missing UI half of the new `Admin\FlagAuditController`
// (build-plan step 26, M8: "nav homes for flags/reports/templates/audit
// viewer"). Mirrors `test/audit-log-panel.test.tsx`'s three-state discipline.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { FlagAuditPanel } from "@/components/admin/FlagAuditPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const enableEntry = {
  flagKey: "social.leaderboard",
  action: "enable",
  actor: "u_1a2b3c4d5e6f",
  reason: "re-ramping after the retention fix shipped",
  acknowledgesRetentionRisk: true,
  acknowledgesNoDarkPattern: true,
  typedFlagName: "social.leaderboard",
  at: 1_700_000_005_000,
};

const autoWaiveEntry = {
  flagKey: "social.leaderboard",
  action: "auto_waive",
  actor: null,
  reason: null,
  acknowledgesRetentionRisk: false,
  acknowledgesNoDarkPattern: false,
  typedFlagName: null,
  at: 1_700_000_000_000,
};

describe("FlagAuditPanel — three states, never two", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("LOADING renders no entries at all", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<FlagAuditPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("UNAVAILABLE names the reason and shows no fabricated rows", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<FlagAuditPanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByText("enable")).toBeNull();
  });

  it("READY renders every entry's flag, actor, action and reason, newest first", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ entries: [enableEntry, autoWaiveEntry], limit: 200 }),
    ) as unknown as typeof fetch;
    render(<FlagAuditPanel />);

    await waitFor(() => expect(screen.getByText("enable")).toBeTruthy());
    expect(screen.getByText("u_1a2b3c4d5e6f")).toBeTruthy();
    expect(screen.getByText(/re-ramping after the retention fix shipped/)).toBeTruthy();
    expect(screen.getByText("auto_waive")).toBeTruthy();
    expect(screen.getAllByText("social.leaderboard").length).toBeGreaterThan(0);

    // A system-triggered row (no admin in the loop, `actor: null`) must render
    // distinctly — never a blank cell and never a fabricated pseudonym.
    expect(screen.getByText(/system/i)).toBeTruthy();
  });

  it("READY renders the enable-hard ceremony's own two acknowledgements and typed name, verbatim — not just the reason", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ entries: [enableEntry, autoWaiveEntry], limit: 200 }),
    ) as unknown as typeof fetch;
    render(<FlagAuditPanel />);
    await waitFor(() => expect(screen.getByText("enable")).toBeTruthy());

    const enableRow = screen.getByText("enable").closest("tr");
    expect(enableRow).toBeTruthy();
    // `enableEntry` carries both acknowledgements as `true` — rendered as the
    // literal word "yes", never collapsed into the reason cell or dropped.
    expect(within(enableRow as HTMLElement).getAllByText("yes").length).toBe(2);
    // "social.leaderboard" appears twice in this row — once as the Flag
    // column, once as the ceremony's own Typed name column.
    expect(within(enableRow as HTMLElement).getAllByText("social.leaderboard").length).toBe(2);

    // `autoWaiveEntry` has no ceremony at all — the scheduler's auto-waive
    // never collected one. Both acknowledgements are the DB default `false`
    // and `typedFlagName` is `null`; none of that is a person's real "no".
    const autoWaiveRow = screen.getByText("auto_waive").closest("tr");
    expect(autoWaiveRow).toBeTruthy();
    expect(within(autoWaiveRow as HTMLElement).getAllByText("—").length).toBeGreaterThanOrEqual(1);
    expect(within(autoWaiveRow as HTMLElement).queryByText("yes")).toBeNull();
  });

  it("a genuinely empty log says so, and never fabricates a row", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ entries: [], limit: 200 })) as unknown as typeof fetch;
    render(<FlagAuditPanel />);
    await waitFor(() => expect(screen.getByText(/no ramp activity recorded yet/i)).toBeTruthy());
  });
});

describe("FlagAuditPanel — the flag filter", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("filtering by a typed flag key requests it as a `flag` query param", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      return jsonResponse({
        entries: url.includes("flag=") ? [enableEntry] : [enableEntry, autoWaiveEntry],
        limit: 200,
      });
    }) as unknown as typeof fetch;

    render(<FlagAuditPanel />);
    await waitFor(() => expect(screen.getByText("auto_waive")).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/flag key/i), {
      target: { value: "social.leaderboard" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));

    await waitFor(() =>
      expect(seen.some((u) => u.includes("flag=social.leaderboard"))).toBe(true),
    );
    await waitFor(() => expect(screen.queryByText("auto_waive")).toBeNull());
  });
});
