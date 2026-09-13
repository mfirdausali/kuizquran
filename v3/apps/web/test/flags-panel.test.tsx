/**
 * @vitest-environment jsdom
 */

// `FlagsPanel` — the missing UI half of `Admin\FlagController` (build-plan
// step 26, M8). The backend and its own suite (`FlagPlaneTest.php`, 13 tests)
// have existed since the flag plane shipped, but nothing under `apps/web`
// ever rendered it — the same shape as v3-D100/D124. Mirrors
// `test/system-health-panel.test.tsx`/`test/content-freeze-panel.test.tsx`'s
// three-state discipline, plus the ceremony's own server-enforced rules
// (>=20-char reason, verbatim flag name, both ethics booleans) carried
// through — never re-validated client-side only, since BUILD-PLAN requires
// the ceremony SERVER-ENFORCED and a client-only check would just be theatre
// on top of it.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { FlagsPanel } from "@/components/admin/FlagsPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const offFlag = {
  key: "experiments.scheduler_v2",
  description: "Alternate scheduling parameters.",
  enabled: false,
  version: 0,
  killedAt: null,
  bannerVisible: false,
  ackAt: null,
  ackAutoWaived: false,
};

const killedFlag = {
  key: "social.friends",
  description: "Friend graph and mutual visibility.",
  enabled: false,
  version: 2,
  killedAt: "2026-08-20T03:00:00Z",
  bannerVisible: true,
  ackAt: null,
  ackAutoWaived: false,
};

// #159: the banner (and its Acknowledge control) stays visible after an ack
// — it clears only on a full re-enable ceremony, never on ack alone
// (Flag::bannerVisible() reads killed_at only). So `bannerVisible: true` with
// a non-null `ackAt` is a real, reachable state, not a hypothetical.
const ackedFlag = {
  ...killedFlag,
  key: "social.leaderboard_v2",
  ackAt: "2026-08-21T09:00:00Z",
  ackAutoWaived: false,
};

const autoWaivedFlag = {
  ...killedFlag,
  key: "social.mutuals",
  ackAt: "2026-08-23T04:00:00Z",
  ackAutoWaived: true,
};

describe("FlagsPanel — three states, never two", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("LOADING renders no flag rows at all", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<FlagsPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("UNAVAILABLE names the reason and shows no fabricated rows", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByRole("row", { name: /experiments/ })).toBeNull();
  });

  it("READY renders every flag's key, description and on/off state", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ flags: [offFlag] })) as unknown as typeof fetch;
    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("experiments.scheduler_v2")).toBeTruthy());
    expect(screen.getByText(/Alternate scheduling parameters/)).toBeTruthy();
  });

  it("a killed, unacknowledged flag shows its banner and an Acknowledge control", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ flags: [killedFlag] })) as unknown as typeof fetch;
    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("social.friends")).toBeTruthy());
    expect(screen.getByRole("button", { name: /acknowledge/i })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/not yet acknowledged/i);
  });

  // #159: acking a kill never clears `bannerVisible` — it stays up until a
  // full re-enable. So the banner must stop CLAIMING "not yet acknowledged"
  // once it genuinely has been, or the console is showing false information
  // about its own audit trail. `ackAt` has been fetched and type-validated
  // (`isFlagRow`) since the panel shipped but was never rendered anywhere —
  // grep confirms the only prior hit was the type guard itself.
  it("an ACKNOWLEDGED kill's banner says so, with when — never 'not yet acknowledged'", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ flags: [ackedFlag] })) as unknown as typeof fetch;
    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("social.leaderboard_v2")).toBeTruthy());
    const banner = screen.getByRole("alert").textContent ?? "";
    expect(banner).toContain("2026-08-21T09:00:00Z");
    expect(banner).not.toMatch(/not yet acknowledged/i);
  });

  it("an auto-waived ack still names the real acknowledged-at time, not just the waiver", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ flags: [autoWaivedFlag] })) as unknown as typeof fetch;
    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("social.mutuals")).toBeTruthy());
    const banner = screen.getByRole("alert").textContent ?? "";
    expect(banner).toContain("2026-08-23T04:00:00Z");
    expect(banner).toMatch(/auto-waived after 72h/i);
    expect(banner).not.toMatch(/not yet acknowledged/i);
  });
});

describe("FlagsPanel — kill is one click, no ceremony", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("clicking Kill on an enabled flag posts the kill and refreshes", async () => {
    const enabledFlag = { ...offFlag, key: "social.leaderboard", enabled: true, version: 3 };
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/kill")) return jsonResponse({ killed: true, key: "social.leaderboard" });
      return jsonResponse({ flags: [{ ...enabledFlag, enabled: calls.some((c) => c.includes("/kill")) ? false : true }] });
    }) as unknown as typeof fetch;

    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("social.leaderboard")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /^kill$/i }));

    await waitFor(() => expect(calls.some((c) => c.includes("POST") && c.includes("/kill"))).toBe(true));
  });
});

describe("FlagsPanel — enable is the full ceremony, every field required", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("submitting a real ceremony posts every field and reflects the outcome", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/enable")) {
        calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
        return jsonResponse({ enabled: true, key: "experiments.scheduler_v2" });
      }
      return jsonResponse({ flags: [offFlag] });
    }) as unknown as typeof fetch;

    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("experiments.scheduler_v2")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /enable/i }));

    const row = screen.getByTestId("flag-ceremony-experiments.scheduler_v2");
    fireEvent.change(within(row).getByLabelText(/reason/i), {
      target: { value: "ramping to 5% to measure retention effect over 28 days" },
    });
    fireEvent.change(within(row).getByLabelText(/type the flag name/i), {
      target: { value: "experiments.scheduler_v2" },
    });
    fireEvent.click(within(row).getByLabelText(/retention/i));
    fireEvent.click(within(row).getByLabelText(/dark pattern/i));
    fireEvent.click(within(row).getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.body).toMatchObject({
      typed_flag_name: "experiments.scheduler_v2",
      acknowledges_retention_risk: true,
      acknowledges_no_dark_pattern: true,
      version: 0,
    });
  });

  it("a 422 from an incomplete ceremony surfaces the server's own field error", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/enable")) {
        return jsonResponse(
          { error: "ceremony incomplete", errors: { reason: "reason must be at least 20 characters" } },
          422,
        );
      }
      return jsonResponse({ flags: [offFlag] });
    }) as unknown as typeof fetch;

    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("experiments.scheduler_v2")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /enable/i }));
    const row = screen.getByTestId("flag-ceremony-experiments.scheduler_v2");
    fireEvent.change(within(row).getByLabelText(/reason/i), { target: { value: "short" } });
    fireEvent.change(within(row).getByLabelText(/type the flag name/i), {
      target: { value: "experiments.scheduler_v2" },
    });
    fireEvent.click(within(row).getByLabelText(/retention/i));
    fireEvent.click(within(row).getByLabelText(/dark pattern/i));
    fireEvent.click(within(row).getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(screen.getByText(/at least 20 characters/)).toBeTruthy());
  });
});
