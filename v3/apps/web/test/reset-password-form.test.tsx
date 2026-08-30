/**
 * @vitest-environment jsdom
 */

// `ResetPasswordForm` — the CONFIRMATION half of DEFECTS.md#AUTH-'s
// password-reset gap, named "not addressed" in DECISIONS.md v3-D153:
// `requestPasswordReset` (the send-link half, in `AccountAuthPanel`) was
// wired, but nothing yet let a learner complete a reset from the emailed
// link. This proves the real round trip through `confirmPasswordReset`,
// not a client-invented state.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { resetTokenForTests } from "@/lib/sync/token";
import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ResetPasswordForm", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("a link with no token/email: explains the link is broken, renders no form", () => {
    render(<ResetPasswordForm link={null} />);

    expect(screen.getByRole("alert").textContent).toMatch(/missing|invalid|broken/i);
    expect(screen.queryByLabelText(/new password/i)).toBeNull();
  });

  it("a valid link, matching passwords: posts to /api/reset-password and shows success", async () => {
    const seen: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
      return jsonResponse({ ok: true, token: "fresh-post-reset-token" });
    }) as unknown as typeof fetch;

    render(<ResetPasswordForm link={{ token: "the-emailed-token", email: "learner@example.com" }} />);

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "new-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/password has been reset/i));

    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("/api/reset-password");
    expect(seen[0]!.body).toEqual({
      token: "the-emailed-token",
      email: "learner@example.com",
      password: "new-password-123",
      password_confirmation: "new-password-123",
    });
  });

  it("mismatched passwords: shows an error and never calls the API at all", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("must not be called");
    }) as unknown as typeof fetch;

    render(<ResetPasswordForm link={{ token: "the-emailed-token", email: "learner@example.com" }} />);

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "does-not-match" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/match/i));
  });

  it("an invalid/expired token: shows the server's own error verbatim", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: "This password reset token is invalid." }, 422),
    ) as unknown as typeof fetch;

    render(<ResetPasswordForm link={{ token: "stale-token", email: "learner@example.com" }} />);

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "new-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("This password reset token is invalid."),
    );
  });
});
