"use client";

// LEARNER ACCOUNT AUTH — DEFECTS.md#B7/#B8's `AUTH-` gap, CLAUDE.md's own
// corruption-risk ordering ("AUTH- closes before any PAY- task... an RM500
// lifetime buyer who forgets their password loses everything"). AuthController
// (register/login/logout/me), PasswordResetController and
// EmailVerificationController have existed since build-plan step 13, fully
// tested server-side (AnonymousAndAdoptionTest, PasswordResetTest,
// EmailVerificationTest) — with ZERO frontend callers anywhere:
// `grep -rln "auth/register\|auth/login\|auth/logout\|forgot-password\|
// email/verify" apps/web/lib apps/web/app apps/web/components` returned
// nothing before this file. A learner could never turn their anonymous
// device into a named account, sign in on a second device, recover a
// forgotten password, or sign out — while the PAY- work AUTH- is supposed to
// precede (PaywallGate, TrialAttribution) is already under construction.
//
// Mirrors lib/admin/session.ts's login/logout shape and lib/account/api.ts's
// never-throws discipline — an identity screen must not throw into a render.
//
// EGRESS: through apiFetch only (check-boundaries.mjs clause 6 / DEFECTS.md#B8).
//
// IDENTITY, NOT A SEPARATE TOKEN SLOT. Every device already carries an
// anonymous bearer token (apiFetch mints one transparently on first use).
// register() ADOPTS that same user row in place — same id, same event
// history — so it needs no identity swap. login() authenticates a DIFFERENT
// account (e.g. a second device, or this device signing into an account
// created elsewhere) and issues a fresh token, adopted via
// setAuthenticatedIdentity — the exact mechanism
// lib/admin/session.ts#adminLogin already uses for the same reason.
//
// SCOPE, DELIBERATE (v3-D153): that run wired register/login/logout/resend-
// verification/request-password-reset, but not the reset-password
// CONFIRMATION screen that consumes the emailed link/token. `confirmPasswordReset`
// below closes that — see `lib/account/resetLink.ts` (the query-string
// contract) and `components/account/ResetPasswordForm.tsx` (the new public
// `/reset-password` route it powers).

import { apiFetch, setAuthenticatedIdentity } from "@/lib/sync/apiFetch.ts";
import { clearToken } from "@/lib/sync/token.ts";

export interface AccountIdentity {
  email: string | null;
  isAnonymous: boolean;
  emailVerified: boolean;
}

export type AccountSession =
  | { state: "checking" }
  | { state: "ready"; identity: AccountIdentity }
  | { state: "unavailable"; reason: string };

function requestFailed(err: unknown): { reason: string } {
  return { reason: err instanceof Error ? `request failed: ${err.message}` : "request failed" };
}

/**
 * `GET /api/me`. Never throws.
 *
 * Every device has a live token by construction (apiFetch mints one
 * transparently), so there is no "signed-out" state here the way
 * lib/admin/session.ts has one — an anonymous learner is a real, valid
 * identity, just not a named one.
 */
export async function checkAccountSession(): Promise<AccountSession> {
  let response: Response;
  try {
    response = await apiFetch("/api/me");
  } catch (err) {
    return { state: "unavailable", reason: requestFailed(err).reason };
  }
  if (!response.ok) return { state: "unavailable", reason: `the API answered ${response.status}` };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { state: "unavailable", reason: "the API's answer was not JSON" };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.isAnonymous !== "boolean") {
    return { state: "unavailable", reason: "the API's answer carried no identity" };
  }
  return {
    state: "ready",
    identity: {
      email: typeof b.email === "string" ? b.email : null,
      isAnonymous: b.isAnonymous,
      emailVerified: b.emailVerified === true,
    },
  };
}

export interface AuthOutcome {
  ok: boolean;
  /** Present only when `ok` is false — the server's own error, echoed
   *  verbatim where one exists. */
  error?: string;
}

async function readErrorBody(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body?.error === "string" ? body.error : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `POST /api/auth/register`. Adopts the CURRENTLY authenticated (anonymous)
 * user in place — same id, same event history — never a new identity.
 * Never throws.
 */
export async function registerAccount(
  email: string,
  password: string,
  name?: string,
): Promise<AuthOutcome> {
  let response: Response;
  try {
    response = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
  } catch (err) {
    return { ok: false, error: requestFailed(err).reason };
  }

  if (!response.ok) {
    return { ok: false, error: (await readErrorBody(response)) ?? `the API answered ${response.status}` };
  }
  return { ok: true };
}

/**
 * `POST /api/auth/login`. Signs into an EXISTING adopted account — a
 * DIFFERENT identity than whatever token this device carried before, so the
 * returned token is ADOPTED via `setAuthenticatedIdentity`, the same
 * mechanism `lib/admin/session.ts#adminLogin` already uses. Never throws.
 */
export async function loginAccount(email: string, password: string): Promise<AuthOutcome> {
  let response: Response;
  try {
    response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    return { ok: false, error: requestFailed(err).reason };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const serverError =
      body !== null && typeof body === "object" && typeof (body as Record<string, unknown>).error === "string"
        ? ((body as Record<string, unknown>).error as string)
        : `the API answered ${response.status}`;
    return { ok: false, error: serverError };
  }

  const token = body !== null && typeof body === "object" ? (body as Record<string, unknown>).token : undefined;
  if (typeof token !== "string" || token === "") {
    return { ok: false, error: "the server's answer carried no token" };
  }

  await setAuthenticatedIdentity(token);
  return { ok: true };
}

/**
 * `POST /api/auth/logout` (best-effort, revokes the token server-side) then
 * clears the local slot. The NEXT `apiFetch` call re-mints an ordinary
 * anonymous identity on its own 401 — the same recovery every other 401
 * uses — so there is no separate "signed out" state to hold in the
 * meantime.
 */
export async function logoutAccount(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // best-effort — the local token is cleared regardless, below.
  }
  clearToken();
}

/** `POST /api/email/verification-notification`. Never throws. */
export async function resendVerificationEmail(): Promise<AuthOutcome> {
  let response: Response;
  try {
    response = await apiFetch("/api/email/verification-notification", { method: "POST" });
  } catch (err) {
    return { ok: false, error: requestFailed(err).reason };
  }
  if (!response.ok) return { ok: false, error: `the API answered ${response.status}` };
  return { ok: true };
}

/**
 * `POST /api/forgot-password`. `PasswordResetController::sendResetLink`'s
 * own comment: the response is deliberately uniform regardless of whether
 * the email exists (enumeration would map addresses to accounts) — this
 * client relays that uniformity rather than inventing a distinction. Never
 * throws.
 */
export async function requestPasswordReset(email: string): Promise<AuthOutcome> {
  let response: Response;
  try {
    response = await apiFetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch (err) {
    return { ok: false, error: requestFailed(err).reason };
  }
  if (!response.ok) {
    return { ok: false, error: (await readErrorBody(response)) ?? `the API answered ${response.status}` };
  }
  return { ok: true };
}

/** The fields `ResetPasswordForm` collects to confirm a reset. */
export interface ResetPasswordParams {
  token: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

/**
 * `POST /api/reset-password`. Consumes the token+email pair the emailed link
 * carries (`lib/account/resetLink.ts#parseResetLinkParams` reads the same
 * shape `PasswordResetController::reset()`'s own request validation expects).
 *
 * On success the server revokes every existing bearer token and mints a
 * fresh one (`PasswordResetController::reset()`'s own comment: this is
 * DEFECTS.md#B8's exact recovery — a reset proves control of the mailbox, so
 * every wedged device recovers here too). The fresh token is ADOPTED via
 * `setAuthenticatedIdentity`, the same mechanism `loginAccount` above uses —
 * completing a reset signs THIS device into the account. Never throws.
 */
export async function confirmPasswordReset(params: ResetPasswordParams): Promise<AuthOutcome> {
  let response: Response;
  try {
    response = await apiFetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: params.token,
        email: params.email,
        password: params.password,
        password_confirmation: params.passwordConfirmation,
      }),
    });
  } catch (err) {
    return { ok: false, error: requestFailed(err).reason };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const serverError =
      body !== null && typeof body === "object" && typeof (body as Record<string, unknown>).error === "string"
        ? ((body as Record<string, unknown>).error as string)
        : `the API answered ${response.status}`;
    return { ok: false, error: serverError };
  }

  const token = body !== null && typeof body === "object" ? (body as Record<string, unknown>).token : undefined;
  if (typeof token !== "string" || token === "") {
    return { ok: false, error: "the server's answer carried no token" };
  }

  await setAuthenticatedIdentity(token);
  return { ok: true };
}
