// `lib/account/auth.ts` — the missing frontend half of the learner account
// flow. `AuthController` (register/login/logout/me) and
// PasswordResetController/EmailVerificationController have existed since
// build-plan step 13 with zero frontend callers — see auth.ts's own header.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { getIdentity, getToken, hasLiveToken, resetTokenForTests, setToken } from "@/lib/sync/token";
import {
  checkAccountSession,
  confirmEmailVerification,
  confirmPasswordReset,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestPasswordReset,
  resendVerificationEmail,
} from "./auth";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("checkAccountSession", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/me through the single egress", async () => {
    setToken("some-token", "some-token");
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonResponse({ signedIn: true, email: null, isAnonymous: true, emailVerified: false });
    }) as unknown as typeof fetch;

    await checkAccountSession();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/me");
  });

  it("returns `ready` with an anonymous identity for a fresh device", async () => {
    setToken("some-token", "some-token");
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ signedIn: true, email: null, isAnonymous: true, emailVerified: false }),
    ) as unknown as typeof fetch;

    const result = await checkAccountSession();
    expect(result).toEqual({
      state: "ready",
      identity: { email: null, isAnonymous: true, emailVerified: false },
    });
  });

  it("returns `ready` with a named, verified identity", async () => {
    setToken("some-token", "some-token");
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ signedIn: true, email: "learner@example.com", isAnonymous: false, emailVerified: true }),
    ) as unknown as typeof fetch;

    const result = await checkAccountSession();
    expect(result).toEqual({
      state: "ready",
      identity: { email: "learner@example.com", isAnonymous: false, emailVerified: true },
    });
  });

  it("returns `unavailable` on a malformed answer — never mistaken for anonymous", async () => {
    setToken("some-token", "some-token");
    globalThis.fetch = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;

    const result = await checkAccountSession();
    expect(result.state).toBe("unavailable");
  });
});

describe("registerAccount", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
    setToken("anon-token", "anon-token");
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts to /api/auth/register through the single egress, with the anonymous token attached", async () => {
    const seen: Array<{ url: string; auth: string | null; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seen.push({
        url: String(input),
        auth: headers.get("Authorization"),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return jsonResponse({ ok: true, email: "learner@example.com", isAnonymous: false, emailVerified: false });
    }) as unknown as typeof fetch;

    const outcome = await registerAccount("learner@example.com", "correct-horse-battery-staple");

    expect(outcome).toEqual({ ok: true });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("/api/auth/register");
    expect(seen[0]!.auth).toBe("Bearer anon-token");
    expect(seen[0]!.body).toEqual({
      email: "learner@example.com",
      password: "correct-horse-battery-staple",
    });
  });

  it("does NOT adopt a new token — registration claims the SAME identity in place", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ ok: true, email: "learner@example.com", isAnonymous: false, emailVerified: false }),
    ) as unknown as typeof fetch;

    await registerAccount("learner@example.com", "pw12345678");
    expect(getToken()).toBe("anon-token");
  });

  it("on a validation error (422), echoes the server's own message verbatim", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: "The email has already been taken." }, 422),
    ) as unknown as typeof fetch;

    const outcome = await registerAccount("taken@example.com", "pw12345678");
    expect(outcome).toEqual({ ok: false, error: "The email has already been taken." });
  });
});

describe("loginAccount", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts credentials to /api/auth/login through the single egress", async () => {
    const seen: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
      return jsonResponse({ token: "existing-account-token", isAnonymous: false, anchorHour: 21, hasHistory: false });
    }) as unknown as typeof fetch;

    await loginAccount("learner@example.com", "correct-horse-battery-staple");

    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("/api/auth/login");
    expect(seen[0]!.body).toEqual({ email: "learner@example.com", password: "correct-horse-battery-staple" });
  });

  it("on success, ADOPTS the returned token — the same slot apiFetch attaches to every request", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ token: "existing-account-token", isAnonymous: false, anchorHour: null, hasHistory: false }),
    ) as unknown as typeof fetch;

    const outcome = await loginAccount("learner@example.com", "pw");

    expect(outcome).toEqual({ ok: true });
    expect(getToken()).toBe("existing-account-token");
    expect(getIdentity()).toBe("existing-account-token");
  });

  it("on invalid credentials (401), echoes the server's own error, never invents one, and leaves the token slot untouched", async () => {
    setToken("prior-token", "prior-token");
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: "invalid credentials" }, 401)) as unknown as typeof fetch;

    const outcome = await loginAccount("ghost@example.com", "wrong");

    expect(outcome).toEqual({ ok: false, error: "invalid credentials" });
    expect(getToken()).toBe("prior-token");
  });
});

describe("confirmPasswordReset", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts token/email/password/password_confirmation to /api/reset-password through the single egress", async () => {
    const seen: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
      return jsonResponse({ ok: true, token: "fresh-post-reset-token" });
    }) as unknown as typeof fetch;

    await confirmPasswordReset({
      token: "the-emailed-reset-token",
      email: "learner@example.com",
      password: "new-password-123",
      passwordConfirmation: "new-password-123",
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("/api/reset-password");
    expect(seen[0]!.body).toEqual({
      token: "the-emailed-reset-token",
      email: "learner@example.com",
      password: "new-password-123",
      password_confirmation: "new-password-123",
    });
  });

  it("on success, ADOPTS the fresh post-reset token — completing a reset signs this device in", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ ok: true, token: "fresh-post-reset-token" }),
    ) as unknown as typeof fetch;

    const outcome = await confirmPasswordReset({
      token: "the-emailed-reset-token",
      email: "learner@example.com",
      password: "new-password-123",
      passwordConfirmation: "new-password-123",
    });

    expect(outcome).toEqual({ ok: true });
    expect(getToken()).toBe("fresh-post-reset-token");
    expect(getIdentity()).toBe("fresh-post-reset-token");
  });

  it("on an invalid/expired token (422), echoes the server's own error, never invents one, and leaves the token slot untouched", async () => {
    setToken("prior-token", "prior-token");
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: "This password reset token is invalid." }, 422),
    ) as unknown as typeof fetch;

    const outcome = await confirmPasswordReset({
      token: "stale-token",
      email: "learner@example.com",
      password: "new-password-123",
      passwordConfirmation: "new-password-123",
    });

    expect(outcome).toEqual({ ok: false, error: "This password reset token is invalid." });
    expect(getToken()).toBe("prior-token");
  });
});

describe("logoutAccount", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts to /api/auth/logout (revoking the token server-side) THEN clears the local slot", async () => {
    setToken("some-token", "some-token");
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonResponse({ ok: true });
    }) as unknown as typeof fetch;

    await logoutAccount();

    expect(seen.some((u) => u.includes("/api/auth/logout"))).toBe(true);
    expect(getToken()).toBeNull();
    expect(hasLiveToken()).toBe(false);
  });

  it("clears the local slot even when the server request fails — logout is never blocked by the network", async () => {
    setToken("some-token", "some-token");
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await logoutAccount();

    expect(getToken()).toBeNull();
    expect(hasLiveToken()).toBe(false);
  });
});

describe("resendVerificationEmail", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
    setToken("named-token", "named-token");
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts to /api/email/verification-notification", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return jsonResponse({ ok: true, alreadyVerified: false });
    }) as unknown as typeof fetch;

    const outcome = await resendVerificationEmail();

    expect(outcome).toEqual({ ok: true });
    expect(seen[0]).toContain("/api/email/verification-notification");
  });
});

describe("requestPasswordReset", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts the email to /api/forgot-password and reports the server's uniform ok", async () => {
    const seen: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
      return jsonResponse({ ok: true });
    }) as unknown as typeof fetch;

    const outcome = await requestPasswordReset("learner@example.com");

    expect(outcome).toEqual({ ok: true });
    expect(seen[0]!.url).toContain("/api/forgot-password");
    expect(seen[0]!.body).toEqual({ email: "learner@example.com" });
  });
});

describe("confirmEmailVerification", () => {
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

  it("GETs /api/email/verify/{id}/{hash}?expires=&signature=, carrying this device's Bearer token", async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), headers: Object.fromEntries(new Headers(init?.headers)) });
      return jsonResponse({ ok: true, alreadyVerified: false });
    }) as unknown as typeof fetch;

    const outcome = await confirmEmailVerification({
      id: "42",
      hash: "the-emailed-hash",
      expires: "1780000000",
      signature: "the-emailed-signature",
    });

    expect(outcome).toEqual({ ok: true, alreadyVerified: false });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("/api/email/verify/42/the-emailed-hash");
    expect(seen[0]!.url).toContain("expires=1780000000");
    expect(seen[0]!.url).toContain("signature=the-emailed-signature");
    expect(seen[0]!.headers.authorization).toBe("Bearer this-devices-token");
  });

  it("reports alreadyVerified when the server says so", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ ok: true, alreadyVerified: true }),
    ) as unknown as typeof fetch;

    const outcome = await confirmEmailVerification({
      id: "42",
      hash: "the-emailed-hash",
      expires: "1780000000",
      signature: "the-emailed-signature",
    });

    expect(outcome).toEqual({ ok: true, alreadyVerified: true });
  });

  it("on a 403 (a signature/device mismatch), echoes the server's own error, never invents one", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: "Invalid signature." }, 403),
    ) as unknown as typeof fetch;

    const outcome = await confirmEmailVerification({
      id: "42",
      hash: "the-emailed-hash",
      expires: "1780000000",
      signature: "tampered",
    });

    expect(outcome).toEqual({ ok: false, error: "Invalid signature." });
  });
});
