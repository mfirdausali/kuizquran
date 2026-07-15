// Session cookie: signed, HttpOnly, SameSite=Lax, ~30 days. No JWT in
// localStorage — the cookie is the only credential (FR7). HMAC-SHA256 over the
// payload with SESSION_SECRET; tamper-evident.

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;
export const COOKIE_NAME = "iman_session";

interface SessionPayload {
  uid: number;
  exp: number; // epoch seconds
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

/** Constant-time compare. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Create a signed session token for a user. */
export async function signSession(uid: number, secret: string, nowS: number): Promise<string> {
  const payload: SessionPayload = { uid, exp: nowS + THIRTY_DAYS_S };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = b64urlEncode(await hmac(secret, body));
  return `${body}.${sig}`;
}

/** Verify a session token; returns uid or null. */
export async function verifySession(
  token: string,
  secret: string,
  nowS: number,
): Promise<number | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64urlEncode(await hmac(secret, body));
  if (!timingSafeEqual(new TextEncoder().encode(sig), new TextEncoder().encode(expected))) {
    return null;
  }
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionPayload;
    if (typeof payload.uid !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp < nowS) return null; // expired
    return payload.uid;
  } catch {
    return null;
  }
}

/** Serialize the Set-Cookie header value. `secure` off only for local http. */
export function sessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${THIRTY_DAYS_S}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
