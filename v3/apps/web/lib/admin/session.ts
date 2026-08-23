"use client";

// THE ADMIN CLIENT-SIDE GATE'S SESSION HALF — named unbuilt in every admin
// screen's own docblock since v3-D92, repeated through v3-D100/D124/D125/
// D126: "a client-side admin gate... would be security theatre [without a
// real login/token behind it]." `POST /api/admin/login`
// (`AdminAuthController`) has existed, timing-oracle-hardened and fully
// tested, since build-plan step 24 — `grep -rln "admin/login" apps/web`
// (excluding this module) returns nothing. This is the missing frontend
// half: a real login, a real per-request check against the SAME `admin`
// middleware chain every write already sits behind, and nothing more.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).
//
// THE GENERIC ERROR IS ECHOED, NEVER ELABORATED. `AdminAuthController`'s own
// header: wrong password and not-on-the-allowlist must be byte-identical, or
// the login form becomes a free oracle for "is this address an admin?".
// `adminLogin` returns the server's own error string verbatim and invents
// nothing of its own on failure.
//
// IDENTITY, NOT A SEPARATE TOKEN SLOT. Admin auth is an ordinary Sanctum
// bearer token for the SAME `User` model a learner account is — "admin" is
// an allowlist-membership fact about a user, not a different kind of
// session. So a successful admin login adopts the token via
// `setAuthenticatedIdentity` (`lib/sync/apiFetch.ts`), the exact mechanism
// an anonymous mint already uses — one identity slot, one place that
// changes it.

import { apiFetch, setAuthenticatedIdentity } from "@/lib/sync/apiFetch.ts";
import { clearToken, hasLiveToken } from "@/lib/sync/token.ts";

const GENERIC_ERROR = "Not authorized for operator access.";

export interface AdminIdentity {
  pseudonym: string;
  roles: string[];
}

export type AdminSession =
  | { state: "checking" }
  /** No live token at all — never attempted a request, so this is not a
   *  server verdict. Distinct from `denied` for the same reason
   *  `lib/admin/health.ts#HealthLoad`'s `unavailable` is distinct from a
   *  real `ok`/`divergent` reading. */
  | { state: "signed-out" }
  | { state: "authorized"; identity: AdminIdentity }
  | { state: "denied"; reason: string };

function isAdminIdentity(v: unknown): v is AdminIdentity {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return typeof b.pseudonym === "string" && Array.isArray(b.roles) && b.roles.every((r) => typeof r === "string");
}

/**
 * Ask the REAL gate — `GET /api/admin/whoami`, behind the same
 * `auth:sanctum` + `EnsureIsAdmin` chain every admin write already sits
 * behind — whether the CURRENT token is actually admin. Never a
 * client-derived guess.
 */
export async function checkAdminSession(): Promise<AdminSession> {
  if (!hasLiveToken()) return { state: "signed-out" };

  let response: Response;
  try {
    response = await apiFetch("/api/admin/whoami");
  } catch (err) {
    return {
      state: "denied",
      reason: err instanceof Error ? `request failed: ${err.message}` : "request failed",
    };
  }

  if (response.status === 401 || response.status === 403) return { state: "signed-out" };
  if (!response.ok) return { state: "denied", reason: `the API answered ${response.status}` };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { state: "denied", reason: "the API's answer was not JSON" };
  }

  if (!isAdminIdentity(body)) return { state: "denied", reason: "the API's answer carried no admin identity" };

  return { state: "authorized", identity: body };
}

export interface AdminLoginOutcome {
  ok: boolean;
  /** Present only when `ok` is false — the server's own generic denial,
   *  echoed verbatim (see the header: never elaborated, never varied). */
  error?: string;
  identity?: AdminIdentity;
}

/**
 * `POST /api/admin/login`. On success, adopts the returned token as the
 * current identity — see the header.
 */
export async function adminLogin(email: string, password: string): Promise<AdminLoginOutcome> {
  let response: Response;
  try {
    response = await apiFetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    // A network failure is not one of the four failure cases the oracle
    // rule governs — it is honest to say so rather than echo the generic
    // denial for a request that never reached the server.
    return { ok: false, error: "could not reach the server" };
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
        : GENERIC_ERROR;

    return { ok: false, error: serverError };
  }

  const token = body !== null && typeof body === "object" ? (body as Record<string, unknown>).token : undefined;
  if (typeof token !== "string" || token === "") {
    return { ok: false, error: "the server's answer carried no token" };
  }

  await setAuthenticatedIdentity(token);

  const identity: AdminIdentity = {
    pseudonym:
      typeof (body as Record<string, unknown>).pseudonym === "string"
        ? ((body as Record<string, unknown>).pseudonym as string)
        : "",
    roles: Array.isArray((body as Record<string, unknown>).roles)
      ? ((body as Record<string, unknown>).roles as string[])
      : [],
  };

  return { ok: true, identity };
}

/** Forgets the current identity. The next `checkAdminSession()` call (or
 *  the next apiFetch) re-mints an ordinary anonymous learner identity, same
 *  as any other 401 recovery — there is no separate "admin logout" concept
 *  server-side, only "this browser stopped presenting a token." */
export function adminLogout(): void {
  clearToken();
}
