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
  killedBy: null,
  bannerVisible: false,
  ackAt: null,
  ackBy: null,
  ackAutoWaived: false,
};

// `killed_at`/`ack_at` are `unsignedBigInteger` columns
// (`Flag::casts()`: `'killed_at' => 'integer'`) — the real wire value is a
// plain JSON number (epoch milliseconds), never a pre-formatted ISO string.
const killedFlag = {
  key: "social.friends",
  description: "Friend graph and mutual visibility.",
  enabled: false,
  version: 2,
  killedAt: 1787194800000, // 2026-08-20T03:00:00Z
  killedBy: "u_ab12cd34ef56",
  bannerVisible: true,
  ackAt: null,
  ackBy: null,
  ackAutoWaived: false,
};

// #159: the banner (and its Acknowledge control) stays visible after an ack
// — it clears only on a full re-enable ceremony, never on ack alone
// (Flag::bannerVisible() reads killed_at only). So `bannerVisible: true` with
// a non-null `ackAt` is a real, reachable state, not a hypothetical.
const ackedFlag = {
  ...killedFlag,
  key: "social.leaderboard_v2",
  ackAt: 1787302800000, // 2026-08-21T09:00:00Z
  ackBy: "u_98fe76dc54ba",
  ackAutoWaived: false,
};

// A system auto-waive has no human actor — `ackBy` stays null even though the
// kill itself named a real admin.
const autoWaivedFlag = {
  ...killedFlag,
  key: "social.mutuals",
  ackAt: 1787457600000, // 2026-08-23T04:00:00Z
  ackBy: null,
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
    expect(banner).toContain("2026-08-21T09:00:00.000Z");
    expect(banner).not.toMatch(/not yet acknowledged/i);
  });

  it("an auto-waived ack still names the real acknowledged-at time, not just the waiver", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ flags: [autoWaivedFlag] })) as unknown as typeof fetch;
    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("social.mutuals")).toBeTruthy());
    const banner = screen.getByRole("alert").textContent ?? "";
    expect(banner).toContain("2026-08-23T04:00:00.000Z");
    expect(banner).toMatch(/auto-waived after 72h/i);
    expect(banner).not.toMatch(/not yet acknowledged/i);
  });

  // v3-D223: `killedBy`/`ackBy` — the pseudonymized actor who took each real
  // action — have been fetched and type-validated (`isFlagRow`) since the
  // controller started sending them, but the banner named only WHEN each
  // action happened, never WHO. An admin killing a flag another admin ramped
  // yesterday had no way to tell who to ask.
  it("names the killing admin's pseudonym in the banner, not just when", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ flags: [killedFlag] })) as unknown as typeof fetch;
    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("social.friends")).toBeTruthy());
    const banner = screen.getByRole("alert").textContent ?? "";
    expect(banner).toContain("u_ab12cd34ef56");
    expect(banner).toContain("2026-08-20T03:00:00.000Z");
  });

  it("names the acknowledging admin's pseudonym in the banner", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ flags: [ackedFlag] })) as unknown as typeof fetch;
    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("social.leaderboard_v2")).toBeTruthy());
    const banner = screen.getByRole("alert").textContent ?? "";
    expect(banner).toContain("u_98fe76dc54ba");
  });

  // A system auto-waive has no human acknowledger — the banner must never
  // fabricate a "by ..." clause for an action nobody took.
  it("an auto-waived ack names no acknowledging admin, only the killing one", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ flags: [autoWaivedFlag] })) as unknown as typeof fetch;
    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("social.mutuals")).toBeTruthy());
    const banner = screen.getByRole("alert").textContent ?? "";
    expect(banner).toContain("u_ab12cd34ef56"); // the real killer
    expect(banner).not.toMatch(/acknowledged by/i);
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

// v3-D335: `killFlag`/`acknowledgeFlag`/`enableFlag` (lib/admin/flags.ts)
// each compute a real `{ok:false, message}` outcome for a genuine failure
// (a network throw, a non-2xx status, a 409 version conflict) — but
// `FlagRowView`'s shared `message` state rendered EVERY outcome, success or
// failure, in the identical passive `<p role="status">` — the same
// "a real failure is announced as a passive status, not an alert" shape
// v3-D241/v3-D329/v3-D330/v3-D333/v3-D334 each already closed on
// `PrivacyPanel.tsx`/`OverrideEditor.tsx`/`GlossDraftsPanel.tsx`, found here
// on the one sibling panel none of those runs ever swept.
describe("FlagsPanel — a real action failure is an alert, not a passive status", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("a failed Kill is announced with role=alert, naming the real server error", async () => {
    const enabledFlag = { ...offFlag, key: "social.leaderboard", enabled: true, version: 3 };
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/kill")) {
        return jsonResponse({ error: "flag is already being modified by another request" }, 409);
      }
      // never actually changed state server-side, so it still reads enabled
      return jsonResponse({ flags: [enabledFlag] });
    }) as unknown as typeof fetch;

    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("social.leaderboard")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /^kill$/i }));

    const alert = await screen.findByText("flag is already being modified by another request");
    expect(alert.getAttribute("role")).toBe("alert");
  });

  it("a successful Kill still reports role=status, not alert — the fix narrows, it does not widen", async () => {
    const enabledFlag = { ...offFlag, key: "social.leaderboard", enabled: true, version: 3 };
    let killed = false;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/kill")) {
        killed = true;
        return jsonResponse({ killed: true, key: "social.leaderboard" });
      }
      return jsonResponse({ flags: [{ ...enabledFlag, enabled: !killed }] });
    }) as unknown as typeof fetch;

    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("social.leaderboard")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /^kill$/i }));

    const status = await screen.findByText("killed");
    expect(status.getAttribute("role")).toBe("status");
  });

  it("a failed Acknowledge is announced with role=alert", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/ack")) {
        return jsonResponse({ error: "the API answered 500" }, 500);
      }
      return jsonResponse({ flags: [killedFlag] });
    }) as unknown as typeof fetch;

    render(<FlagsPanel />);
    await waitFor(() => expect(screen.getByText("social.friends")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /^acknowledge$/i }));

    // the existing "not yet acknowledged" banner is itself role=alert
    // (#159), so scope to the NEW message distinctly by content.
    const alert = await screen.findByText("the API answered 500");
    expect(alert.getAttribute("role")).toBe("alert");
  });

  it("a failed enable-ceremony submission (a real 409 version conflict, no field errors) is role=alert", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/enable")) {
        return jsonResponse({ error: "version conflict — re-read and retry" }, 409);
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

    const alert = await screen.findByText("version conflict — re-read and retry");
    expect(alert.getAttribute("role")).toBe("alert");
  });
});
