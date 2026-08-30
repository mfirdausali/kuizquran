/**
 * @vitest-environment jsdom
 */

// `VerifyEmailScreen` — closes the gap `lib/account/auth.ts` named
// "not addressed" in DECISIONS.md v3-D154: `EmailVerificationController
// ::verify()`'s own signed-link route had no in-app landing page. This
// proves the real round trip through `confirmEmailVerification`, firing
// automatically on mount — unlike `ResetPasswordForm`, there is no form
// here, since the link itself is the credential.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { resetTokenForTests, setToken } from "@/lib/sync/token";
import { VerifyEmailScreen } from "@/components/account/VerifyEmailScreen";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("VerifyEmailScreen", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
    setToken("this-devices-token", "this-devices-token");
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("a link missing any of the four pieces: explains the link is broken, calls nothing", () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("must not be called");
    }) as unknown as typeof fetch;

    render(<VerifyEmailScreen link={null} />);

    expect(screen.getByRole("alert").textContent).toMatch(/missing|invalid|broken/i);
  });

  it("a real link: verifies automatically on mount and reports success", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonResponse({ ok: true, alreadyVerified: false });
    }) as unknown as typeof fetch;

    render(<VerifyEmailScreen link={{ id: "42", hash: "the-hash", expires: "1780000000", signature: "the-sig" }} />);

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/verified/i));

    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/email/verify/42/the-hash");
    expect(seen[0]).toContain("expires=1780000000");
    expect(seen[0]).toContain("signature=the-sig");
  });

  it("an already-verified email: reports that distinctly, not as a fresh success", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ ok: true, alreadyVerified: true }),
    ) as unknown as typeof fetch;

    render(<VerifyEmailScreen link={{ id: "42", hash: "the-hash", expires: "1780000000", signature: "the-sig" }} />);

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/already/i));
  });

  it("a signature/device mismatch (403): shows the server's own error and the device-mismatch hint", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: "This action is unauthorized." }, 403),
    ) as unknown as typeof fetch;

    render(<VerifyEmailScreen link={{ id: "42", hash: "the-hash", expires: "1780000000", signature: "the-sig" }} />);

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("This action is unauthorized."),
    );
    expect(screen.getByRole("alert").textContent).toMatch(/different device/i);
  });
});
