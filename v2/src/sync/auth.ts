// v2-D03: Laravel/Sanctum auth, anonymous-first with account adoption. A
// bearer token (Sanctum personal access token) is the only credential — never
// a cookie (the API and the Vite SPA are different origins in dev and can be
// in production too; see v2-D51). ensureDevice() mints one the first time this
// device needs to sync, no email/password prompt required (v2-D03's
// "anonymous-first"); register()/login() are the "account adoption" path.

const TOKEN_KEY = "iman-auth-token";

/** API base URL. Defaults to the local `php artisan serve` port; override via
 *  VITE_API_URL in production (e.g. https://api.iman.app/api). */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "http://localhost:8000/api";

export interface MeInfo {
  signedIn: boolean;
  email: string | null;
  anchorHour: number | null;
  hasHistory: boolean;
  isAnonymous: boolean;
}

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

/** Drops this device's local credential. Does NOT touch the local event log —
 *  the append-only log is never wiped by a sign-out (only resetAccount.ts's
 *  explicit "switch account" does that). The next sync attempt re-adopts a
 *  fresh anonymous identity via ensureDevice(). */
export function clearToken(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "content-type": "application/json" };
}

/** Guarantees this device has a bearer token, minting a fresh anonymous
 *  account (POST /auth/anonymous) if none is stored yet. Call once at app
 *  boot before any flush()/hydrate(). Network/API failures are swallowed —
 *  local-first (v2-D01) means the app works fully offline; sync is best-effort. */
export async function ensureDevice(): Promise<string | null> {
  const existing = getToken();
  if (existing) return existing;
  try {
    const res = await fetch(`${API_URL}/auth/anonymous`, { method: "POST" });
    if (!res.ok) return null;
    const body = (await res.json()) as { token: string };
    setToken(body.token);
    return body.token;
  } catch {
    return null; // offline at first launch — try again next call
  }
}

/** Restores signed-in state for the stored token. Returns null when there is
 *  no token yet or the API is unreachable/the token is invalid. */
export async function me(): Promise<MeInfo | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/me`, { headers: authHeaders(token) });
    if (!res.ok) return null;
    return (await res.json()) as MeInfo;
  } catch {
    return null;
  }
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

/** Claim THIS device's anonymous account in place (same user id, same event
 *  history) — the "account adoption" v2-D03 names. */
export async function register(email: string, password: string): Promise<AuthResult> {
  const token = await ensureDevice();
  if (!token) return { ok: false, error: "offline" };
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Sign into an EXISTING adopted account (e.g. restoring history on a fresh
 *  device). Swaps this device's stored token — any not-yet-synced local
 *  events will attribute to whichever account is signed in when the outbox
 *  next flushes, exactly like v1's session-derived uid never trusting the
 *  client (see v2-D03/v2-D18 in DECISIONS.md). Callers should follow a
 *  successful login with hydrate() to pull the account's history down. */
export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json()) as { token?: string; error?: string };
    if (!res.ok || !body.token) return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    setToken(body.token);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Revokes the current token server-side, then drops it locally. A fresh
 *  anonymous identity is minted on the next ensureDevice() call. */
export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: "POST", headers: authHeaders(token) });
    } catch {
      // offline — the token is still revoked locally; the server-side row
      // becomes unreachable garbage but carries no credential risk once the
      // client forgets it.
    }
  }
  clearToken();
}
