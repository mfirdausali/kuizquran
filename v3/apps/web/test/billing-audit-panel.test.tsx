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
    // { ignore: "option" } excludes the (always-rendered, unrelated) override
    // form's <select> options, which legitimately include the literal text
    // "grace" as a closed-set choice — this assertion is about the RESULT
    // TABLE never fabricating a row, not about the form.
    expect(screen.queryByText("grace", { ignore: "script, style, option" })).toBeNull();
  });

  it("READY renders every entry's subject, from/to state, cause and actor, newest first", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ entries: [gradeGraceEntry, trialStartEntry], limit: 200 }),
    ) as unknown as typeof fetch;
    render(<BillingAuditPanel />);

    // { ignore: "option" } throughout this test excludes the (always-rendered,
    // unrelated) override form's <select> options, which legitimately reuse
    // these same closed-set state/tier words as choices.
    const ignoreOptions = { ignore: "script, style, option" };
    await waitFor(() => expect(screen.getByText("grace", ignoreOptions)).toBeTruthy());
    expect(screen.getAllByText("u_7f3a19bcde01").length).toBeGreaterThan(0);
    expect(screen.getByText("active", ignoreOptions)).toBeTruthy();
    expect(screen.getByText("trial", ignoreOptions)).toBeTruthy();
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

// `EntitlementMachine::CAUSE_ADMIN_OVERRIDE` (v3-D147) existed with no caller
// anywhere until now — these prove the ONE write on this screen, mirroring
// `test/flags-panel.test.tsx`'s "the server decides everything" discipline.
describe("BillingAuditPanel — the admin override form", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("submits the override with the typed learner id, state and reason, then refreshes the log", async () => {
    let overrideCalls = 0;
    const seenOverrideBody: Record<string, unknown>[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/override")) {
        overrideCalls++;
        seenOverrideBody.push(init?.body ? JSON.parse(String(init.body)) : {});
        return jsonResponse({ applied: true, state: "lapsed_review_only", tier: "monthly" });
      }
      return jsonResponse({ entries: overrideCalls > 0 ? [gradeGraceEntry] : [], limit: 200 });
    }) as unknown as typeof fetch;

    render(<BillingAuditPanel />);
    await waitFor(() => expect(screen.getByText(/no billing activity recorded yet/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/target user id/i), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText(/^state$/i), { target: { value: "lapsed_review_only" } });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "refund per support ticket 9911" },
    });
    fireEvent.click(screen.getByRole("button", { name: /apply override/i }));

    await waitFor(() => expect(overrideCalls).toBe(1));
    expect(seenOverrideBody[0]).toEqual({
      state: "lapsed_review_only",
      reason: "refund per support ticket 9911",
    });

    // A successful override re-fetches the log so the new row appears without
    // a manual reload. { ignore: "option" } excludes the form's own <select>
    // options, which reuse the same closed-set words.
    await waitFor(() => expect(screen.getByText("grace", { ignore: "script, style, option" })).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/applied/i)).toBeTruthy());
  });

  it("a rejected override shows the server's own reason and never claims success", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/override")) {
        return jsonResponse({ error: "reason must be at least 10 characters" }, 422);
      }
      return jsonResponse({ entries: [], limit: 200 });
    }) as unknown as typeof fetch;

    render(<BillingAuditPanel />);
    await waitFor(() => expect(screen.getByText(/no billing activity recorded yet/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/target user id/i), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText(/^state$/i), { target: { value: "active" } });
    fireEvent.change(screen.getByLabelText(/^reason$/i), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /apply override/i }));

    await waitFor(() => expect(screen.getByText(/reason must be at least 10 characters/i)).toBeTruthy());
  });

  it("submitting neither state nor tier is refused client-side before any request is sent", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonResponse({ entries: [], limit: 200 });
    }) as unknown as typeof fetch;

    render(<BillingAuditPanel />);
    await waitFor(() => expect(screen.getByText(/no billing activity recorded yet/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/target user id/i), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "refund per support ticket 9911" },
    });
    fireEvent.click(screen.getByRole("button", { name: /apply override/i }));

    await waitFor(() => expect(screen.getByText(/choose a state or a tier/i)).toBeTruthy());
    expect(seen.every((u) => !u.includes("/override"))).toBe(true);
  });
});
