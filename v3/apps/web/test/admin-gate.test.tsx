/**
 * @vitest-environment jsdom
 */

// `AdminGate` — the client-side admin gate named unbuilt since v3-D92 and
// repeated through v3-D100/D124/D125/D126: every admin screen's docblock
// stated a redirect with no real check behind it would be "security
// theatre." This test proves the gate is backed by a REAL server verdict
// (`GET /api/admin/whoami`) rather than a client-invented flag: a
// non-admin/no-token visitor sees the login form, never the wrapped staff
// content, and a real login round-trips through the real endpoints.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { resetTokenForTests, setToken } from "@/lib/sync/token";
import { AdminGate } from "@/components/admin/AdminGate";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("AdminGate — a real verdict, never a client-invented flag", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("with no token: shows the login form, never the wrapped content", async () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error("no request should be made with no live token");
    }) as unknown as typeof fetch;

    render(
      <AdminGate>
        <div data-testid="staff-content">secret workbench</div>
      </AdminGate>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: /admin sign-in/i })).toBeTruthy());
    expect(screen.queryByTestId("staff-content")).toBeNull();
  });

  it("with a token that /whoami rejects (403): shows the login form, not the wrapped content", async () => {
    setToken("stale-learner-token", "stale-learner-token");
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: "forbidden" }, 403)) as unknown as typeof fetch;

    render(
      <AdminGate>
        <div data-testid="staff-content">secret workbench</div>
      </AdminGate>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: /admin sign-in/i })).toBeTruthy());
    expect(screen.queryByTestId("staff-content")).toBeNull();
  });

  it("with a token /whoami accepts: renders the wrapped content, never the login form", async () => {
    setToken("admin-token", "admin-token");
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ pseudonym: "u_ops", roles: ["qari"] }),
    ) as unknown as typeof fetch;

    render(
      <AdminGate>
        <div data-testid="staff-content">secret workbench</div>
      </AdminGate>,
    );

    await waitFor(() => expect(screen.getByTestId("staff-content")).toBeTruthy());
    expect(screen.queryByRole("heading", { name: /admin sign-in/i })).toBeNull();
    expect(screen.getByText(/u_ops/)).toBeTruthy();
  });

  it("a real login round-trip: submitting the form calls /api/admin/login, then re-checks and reveals the content", async () => {
    const seenUrls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seenUrls.push(url);
      if (url.includes("/api/admin/login")) {
        return jsonResponse({ token: "fresh-admin-token", pseudonym: "u_ops", roles: [] });
      }
      if (url.includes("/api/admin/whoami")) {
        return jsonResponse({ pseudonym: "u_ops", roles: [] });
      }
      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    render(
      <AdminGate>
        <div data-testid="staff-content">secret workbench</div>
      </AdminGate>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: /admin sign-in/i })).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "ops@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "correct-horse-battery-staple" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByTestId("staff-content")).toBeTruthy());
    expect(seenUrls.some((u) => u.includes("/api/admin/login"))).toBe(true);
    expect(seenUrls.some((u) => u.includes("/api/admin/whoami"))).toBe(true);
  });

  it("a denied login attempt: shows the server's OWN generic error, never invents one, and stays on the form", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/admin/login")) {
        return jsonResponse({ error: "Not authorized for operator access." }, 403);
      }
      throw new Error("unreachable");
    }) as unknown as typeof fetch;

    render(
      <AdminGate>
        <div data-testid="staff-content">secret workbench</div>
      </AdminGate>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: /admin sign-in/i })).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "ghost@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Not authorized for operator access."),
    );
    expect(screen.queryByTestId("staff-content")).toBeNull();
  });

  it("sign-out clears the session and returns to the login form", async () => {
    setToken("admin-token", "admin-token");
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ pseudonym: "u_ops", roles: [] }),
    ) as unknown as typeof fetch;

    render(
      <AdminGate>
        <div data-testid="staff-content">secret workbench</div>
      </AdminGate>,
    );

    await waitFor(() => expect(screen.getByTestId("staff-content")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: /admin sign-in/i })).toBeTruthy());
    expect(screen.queryByTestId("staff-content")).toBeNull();
  });
});
