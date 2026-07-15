// Verify a Google ID token (FR7: JWKS verify iss/aud/exp). Two paths:
//  - REAL: fetch Google's JWKS, verify the RS256 signature + claims.
//  - DEV MOCK (GOOGLE_MOCK=1): accept a JSON credential {sub,email}, skip the
//    signature. Local-dev only; NEVER enabled with real secrets (wrangler
//    staging/prod sets GOOGLE_MOCK=0).

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const VALID_ISS = ["accounts.google.com", "https://accounts.google.com"];

export interface GoogleIdentity {
  sub: string;
  email: string;
}

interface Jwk {
  kid: string;
  n: string;
  e: string;
  alg?: string;
  kty: string;
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function getJwks(nowMs: number): Promise<Jwk[]> {
  if (jwksCache && nowMs - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch ${res.status}`);
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys: body.keys, fetchedAt: nowMs };
  return body.keys;
}

function b64urlToBytes(s: string): Uint8Array {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function decodeJwtPart(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

/** Dev-only mock: the credential is JSON {sub,email}. */
function verifyMock(credential: string): GoogleIdentity {
  const parsed = JSON.parse(credential) as Partial<GoogleIdentity>;
  if (!parsed.sub || !parsed.email) throw new Error("mock credential needs {sub,email}");
  return { sub: parsed.sub, email: parsed.email };
}

async function verifyReal(
  credential: string,
  clientId: string,
  nowMs: number,
): Promise<GoogleIdentity> {
  const parts = credential.split(".");
  if (parts.length !== 3) throw new Error("malformed JWT");
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];
  const header = decodeJwtPart(headerB64) as { kid?: string; alg?: string };
  const payload = decodeJwtPart(payloadB64) as {
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
    email?: string;
  };

  // Claims: iss, aud, exp (FR7).
  if (!payload.iss || !VALID_ISS.includes(payload.iss)) throw new Error("bad iss");
  if (payload.aud !== clientId) throw new Error("bad aud");
  if (!payload.exp || payload.exp * 1000 < nowMs) throw new Error("expired");
  if (!payload.sub || !payload.email) throw new Error("missing sub/email");

  // Signature (RS256) against the matching JWKS key.
  const jwks = await getJwks(nowMs);
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("no matching JWKS key");
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(sigB64), signed);
  if (!ok) throw new Error("bad signature");

  return { sub: payload.sub, email: payload.email };
}

/** Verify a credential; dispatches to mock or real per `mock`. */
export async function verifyGoogle(
  credential: string,
  opts: { mock: boolean; clientId: string; nowMs: number },
): Promise<GoogleIdentity> {
  return opts.mock ? verifyMock(credential) : verifyReal(credential, opts.clientId, opts.nowMs);
}
