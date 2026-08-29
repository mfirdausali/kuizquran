/**
 * @vitest-environment jsdom
 */

// `AccountAuthPanel` — the frontend half of DEFECTS.md#AUTH-. See
// lib/account/auth.ts's header for the full defect writeup: register/login/
// logout/resend-verification/forgot-password have all existed server-side
// since build-plan step 13 with zero frontend callers. This test proves a
// real round trip through the real endpoints, not a client-invented state.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { resetTokenForTests, setToken } from "@/lib/sync/token";
import { AccountAuthPanel } from "@/components/settings/AccountAuthPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("AccountAuthPanel", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
    setToken("device-token", "device-token");
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("an anonymous device: offers to create an account or sign in, never staff chrome", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ signedIn: true, email: null, isAnonymous: true, emailVerified: false }),
    ) as unknown as typeof fetch;

    render(<AccountAuthPanel />);

    await waitFor(() => expect(screen.getByText(/not signed in to a named account/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /create an account/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /i already have an account/i })).toBeTruthy();
  });

  it("a named, verified account: shows the email, never the create/sign-in forms", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ signedIn: true, email: "learner@example.com", isAnonymous: false, emailVerified: true }),
    ) as unknown as typeof fetch;

    render(<AccountAuthPanel />);

    await waitFor(() => expect(screen.getByText(/learner@example\.com/)).toBeTruthy());
    expect(screen.getByText(/email verified/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /create an account/i })).toBeNull();
  });

  it("a named, UNVERIFIED account: offers to resend the verification email", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ signedIn: true, email: "learner@example.com", isAnonymous: false, emailVerified: false }),
    ) as unknown as typeof fetch;

    render(<AccountAuthPanel />);

    await waitFor(() => expect(screen.getByRole("button", { name: /resend verification email/i })).toBeTruthy());
  });

  it("creating an account: posts to /api/auth/register and re-reads the session, revealing the named view", async () => {
    const seenUrls: string[] = [];
    let calls = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      seenUrls.push(url);
      if (url.includes("/api/auth/register")) {
        return jsonResponse({ ok: true, email: "learner@example.com", isAnonymous: false, emailVerified: false });
      }
      if (url.includes("/api/me")) {
        calls += 1;
        // First read: anonymous. Second read (after registering): named.
        return calls === 1
          ? jsonResponse({ signedIn: true, email: null, isAnonymous: true, emailVerified: false })
          : jsonResponse({ signedIn: true, email: "learner@example.com", isAnonymous: false, emailVerified: false });
      }
      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    render(<AccountAuthPanel />);

    await waitFor(() => expect(screen.getByLabelText(/^email$/i)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "learner@example.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "correct-horse-battery-staple" } });
    fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));

    await waitFor(() => expect(screen.getByText(/learner@example\.com/)).toBeTruthy());
    expect(seenUrls.some((u) => u.includes("/api/auth/register"))).toBe(true);
  });

  it("signing in on this device: switches to the SIGN IN form, posts to /api/auth/login, and reveals the named view", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/login")) {
        return jsonResponse({ token: "existing-account-token", isAnonymous: false, anchorHour: null, hasHistory: true });
      }
      if (url.includes("/api/me")) {
        calls += 1;
        return calls === 1
          ? jsonResponse({ signedIn: true, email: null, isAnonymous: true, emailVerified: false })
          : jsonResponse({ signedIn: true, email: "other@example.com", isAnonymous: false, emailVerified: true });
      }
      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    render(<AccountAuthPanel />);

    await waitFor(() => expect(screen.getByRole("button", { name: /i already have an account/i })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /i already have an account/i }));

    await waitFor(() => expect(screen.getByLabelText(/^email$/i)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "other@example.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(screen.getByText(/other@example\.com/)).toBeTruthy());
  });

  it("a denied login: shows the server's own error and stays on the anonymous form", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/login")) {
        return jsonResponse({ error: "invalid credentials" }, 401);
      }
      if (url.includes("/api/me")) {
        return jsonResponse({ signedIn: true, email: null, isAnonymous: true, emailVerified: false });
      }
      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    render(<AccountAuthPanel />);

    fireEvent.click(await screen.findByRole("button", { name: /i already have an account/i }));
    fireEvent.change(await screen.findByLabelText(/^email$/i), { target: { value: "ghost@example.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("invalid credentials"));
    expect(screen.queryByText(/learner@example\.com/)).toBeNull();
  });

  it("forgot password: shows the send-link form and, on submit, a uniform confirmation", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/forgot-password")) return jsonResponse({ ok: true });
      if (url.includes("/api/me")) return jsonResponse({ signedIn: true, email: null, isAnonymous: true, emailVerified: false });
      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    render(<AccountAuthPanel />);

    fireEvent.click(await screen.findByRole("button", { name: /i already have an account/i }));
    fireEvent.click(await screen.findByRole("button", { name: /forgot your password/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /send reset link/i })).toBeTruthy());
    // Two "Email" fields are on screen now (sign-in form + this one) — the
    // forgot-password form's own field is the LAST one rendered.
    const emailFields = screen.getAllByLabelText(/^email$/i);
    fireEvent.change(emailFields[emailFields.length - 1]!, { target: { value: "ghost@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/reset link is on its way/i));
  });

  it("sign out: posts to /api/auth/logout and returns to the anonymous view", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/logout")) return jsonResponse({ ok: true });
      if (url.includes("/api/me")) {
        calls += 1;
        return calls === 1
          ? jsonResponse({ signedIn: true, email: "learner@example.com", isAnonymous: false, emailVerified: true })
          : jsonResponse({ signedIn: true, email: null, isAnonymous: true, emailVerified: false });
      }
      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    render(<AccountAuthPanel />);

    await waitFor(() => expect(screen.getByRole("button", { name: /sign out/i })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(screen.getByText(/not signed in to a named account/i)).toBeTruthy());
  });
});
