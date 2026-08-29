"use client";

// THE SOLE EGRESS to /api/*. DEFECTS.md#B8's frontend half.
//
// Every sync call goes through `apiFetch` — the outbox POST, the pull GET, and
// anything added later. check-boundaries.mjs clause 6 enforces this by grep:
// a second, un-wrapped `fetch("/api/...")` anywhere else is exactly how B8
// comes back, so the gate makes it unwritable rather than merely discouraged.
//
// The 401 flow (B8's closing criterion: "a 401 interceptor clears the token and
// re-mints"):
//
//   1. attach Bearer <token> when a LIVE token exists (token.ts#hasLiveToken —
//      liveness, not mere existence, is B8's first half);
//   2. non-401 → return the response untouched;
//   3. 401 →
//      a. clearToken() FIRST, synchronously, before any await;
//      b. POST /api/auth/anonymous (201, {token, ...});
//      c. store the new token;
//      d. retry the original request EXACTLY ONCE with the new token;
//      e. if the retry also 401s → degraded, and do NOT mint again.
//
// THREE INDEPENDENT BRAKES stop a permanently-401ing server spinning forever.
// They are deliberately redundant: any one of them can be broken by a later
// edit, and a mint loop is not a slow bug, it is an outage that mints users.
//
//   BRAKE 1 — retry-once carried IN THE CALL. `isRetry` is a parameter, not a
//     module-scope counter, so the recursive path is structurally reachable
//     once per original request and cannot leak across calls.
//   BRAKE 2 — SINGLE-FLIGHT MINT. The outbox POST and the pull GET race
//     constantly; without this, N concurrent 401s mint N anonymous users and
//     N-1 of them silently orphan their events under abandoned accounts. That
//     is a data-loss bug wearing an auth costume.
//   BRAKE 3 — COOLDOWN after a failed mint. If the mint fails or the post-mint
//     retry 401s, no further mint is attempted for a backoff window; sync goes
//     degraded and the SESSION IS UNTOUCHED (#103: never blocks).
//
// THE EXEMPT ROUTE: POST /api/auth/anonymous is never routed through the
// interceptor. A 401 from the mint endpoint triggering a mint IS the loop,
// directly.
//
// v3-D153: POST /api/auth/login carries the SAME shape of problem, found
// while wiring lib/account/auth.ts#loginAccount. It sits OUTSIDE
// `auth:sanctum` — no token is required to call it at all — and its OWN 401
// (AuthController::login()) means "wrong email or password", never "the
// bearer token this device happens to be carrying is dead." Routing it
// through the generic interceptor made a wrong password indistinguishable
// from a revoked device token: the device's live token was cleared and a
// re-mint was attempted for a failure that had nothing to do with it, and
// the caller saw a mint-related error instead of the real "invalid
// credentials" answer. NO_REMINT_PATHS is exactly ANONYMOUS_PATH's own
// exemption, generalized to any endpoint whose 401 is a domain-specific
// denial rather than a token-liveness signal.

import { clearToken, getToken, hasLiveToken, setToken } from "./token.ts";

/** The mint endpoint. Exempt from the interceptor by construction — see above. */
export const ANONYMOUS_PATH = "/api/auth/anonymous";

/** Public, unauthenticated endpoints whose own 401 is a domain-specific
 *  denial, never a signal that the CALLER'S attached bearer token is dead —
 *  see v3-D153 above. Adding a path here is a reviewable act, same
 *  discipline as check-boundaries.mjs's own allowlists. */
const NO_REMINT_PATHS = new Set<string>(["/api/auth/login"]);

/** BRAKE 3's window. After a failed mint, refuse to mint again for this long. */
export const MINT_COOLDOWN_MS = 60_000;

/** Base URL for the API. Empty string = same origin (the dev proxy and the
 *  deployed app both serve /api from the same host). */
function apiBase(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE : undefined;
  return fromEnv ?? "";
}

/** What the mint endpoint returns (AuthController::anonymous, 201). */
export interface AnonymousIdentity {
  token: string;
  isAnonymous: boolean;
  anchorHour?: number;
  hasHistory?: boolean;
}

/** Raised when sync cannot proceed because auth is wedged. NEVER thrown into a
 *  render and never blocking: callers count it and carry on. */
export class SyncAuthError extends Error {
  constructor(readonly stage: "mint-failed" | "still-401" | "cooldown") {
    super(`sync auth unavailable (${stage})`);
    this.name = "SyncAuthError";
  }
}

/** BRAKE 2: the one in-flight mint every concurrent 401 shares. */
let mintInFlight: Promise<string> | null = null;
/** BRAKE 3: when the cooldown expires. */
let mintBlockedUntil = 0;
/** Observability + the mutation tests' assertion surface: how many times the
 *  mint endpoint was actually called. A test that only checks "it terminated"
 *  passes with a 3-deep loop; asserting the COUNT is what kills M9/M10. */
let mintCallCount = 0;

/** Called on every identity change so identity-scoped state (the pull cursor)
 *  can reset. Set by sync.ts; a plain callback rather than an import so this
 *  module stays free of any dependency on the store. */
let onIdentityChange: ((identity: string) => void | Promise<void>) | null = null;

export function setIdentityChangeHandler(
  fn: ((identity: string) => void | Promise<void>) | null,
): void {
  onIdentityChange = fn;
}

export function mintCalls(): number {
  return mintCallCount;
}

/**
 * Mint a fresh anonymous identity. Single-flight (BRAKE 2) and
 * cooldown-guarded (BRAKE 3).
 *
 * This function calls `fetch` DIRECTLY rather than through `apiFetch`. That is
 * not an oversight and not a bypass of clause 6 (the gate exempts this file):
 * routing the mint through the interceptor is the loop.
 */
export async function mintAnonymous(now: number = Date.now()): Promise<string> {
  if (mintInFlight) return mintInFlight;
  if (now < mintBlockedUntil) throw new SyncAuthError("cooldown");

  const attempt = (async () => {
    mintCallCount += 1;
    let response: Response;
    try {
      response = await fetch(`${apiBase()}${ANONYMOUS_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: "{}",
      });
    } catch (err) {
      mintBlockedUntil = now + MINT_COOLDOWN_MS;
      throw new SyncAuthError("mint-failed");
    }
    if (!response.ok) {
      mintBlockedUntil = now + MINT_COOLDOWN_MS;
      throw new SyncAuthError("mint-failed");
    }
    const body = (await response.json()) as AnonymousIdentity;
    if (!body || typeof body.token !== "string" || body.token === "") {
      mintBlockedUntil = now + MINT_COOLDOWN_MS;
      throw new SyncAuthError("mint-failed");
    }

    // A re-mint produces a NEW anonymous user with an EMPTY event history.
    // The pull cursor refers to the OLD user's ingest sequence and the new
    // user's sequence starts at 0, so carrying it over would skip the new
    // account's events forever. The identity string is the token itself:
    // a distinct token is a distinct server-side identity as far as the
    // cursor is concerned, and the client is never told the user id.
    setToken(body.token, body.token);
    if (onIdentityChange) await onIdentityChange(body.token);
    return body.token;
  })();

  mintInFlight = attempt;
  try {
    return await attempt;
  } finally {
    mintInFlight = null;
  }
}

/**
 * The wrapper. `path` is an /api/... path, never a full URL.
 *
 * @param isRetry BRAKE 1. Carried in the call so the recursive path is
 *                reachable exactly once per original request. Callers never
 *                pass it; only the interceptor's own retry does.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  isRetry = false,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const token = hasLiveToken() ? getToken() : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiBase()}${path}`, { ...init, headers });

  if (response.status !== 401) return response;
  // v3-D153: this endpoint's 401 is not a token-liveness signal — see above.
  if (NO_REMINT_PATHS.has(path)) return response;

  // BRAKE 1: a retry that itself 401s does not mint again. Give up for this
  // cycle and surface a degraded state — the session is untouched.
  if (isRetry) throw new SyncAuthError("still-401");

  // (a) Clear FIRST, synchronously. Nothing may await between knowing the
  //     token is dead and it being gone.
  clearToken();

  // (b)+(c) Mint and store. Single-flight and cooldown-guarded.
  await mintAnonymous();

  // (d) Retry exactly once, with the NEW token attached by the recursion's own
  //     header build. The `true` is BRAKE 1.
  return apiFetch(path, init, true);
}

/**
 * Adopt `token` as the current identity — the same mechanism
 * `mintAnonymous()` uses for a fresh anonymous mint, exposed here for a
 * caller that already HAS a token from somewhere else (today: admin login,
 * `lib/admin/session.ts#adminLogin`). Notifies the same identity-change
 * handler `mintAnonymous` does, so a pull cursor from a PRIOR identity is
 * never carried into this one (the same reasoning `setIdentityChangeHandler`'s
 * own docstring gives for the anonymous case).
 */
export async function setAuthenticatedIdentity(token: string): Promise<void> {
  setToken(token, token);
  if (onIdentityChange) await onIdentityChange(token);
}

/** Test seam: reset the brakes' state between tests. */
export function resetApiFetchForTests(): void {
  mintInFlight = null;
  mintBlockedUntil = 0;
  mintCallCount = 0;
  onIdentityChange = null;
}
