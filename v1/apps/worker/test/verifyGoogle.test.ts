/// <reference types="@cloudflare/vitest-pool-workers" />
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { verifyGoogle } from "../src/verifyGoogle.ts";

// Verify the REAL JWKS path (not the mock): forge an RS256 token with a locally
// generated key, serve the matching JWKS via a mocked fetch, and assert claim +
// signature checks. This exercises the code that runs in staging (GOOGLE_MOCK=0).

const CLIENT_ID = "test-aud.apps.googleusercontent.com";
const NOW = 1_800_000_000_000; // fixed ms
const KID = "test-kid-1";

let privateKey: CryptoKey;
let jwksBody: { keys: unknown[] };

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlStr(str: string): string {
  return b64url(new TextEncoder().encode(str));
}

async function forgeToken(claims: Record<string, unknown>): Promise<string> {
  const header = { alg: "RS256", kid: KID, typ: "JWT" };
  const headerB64 = b64urlStr(JSON.stringify(header));
  const payloadB64 = b64urlStr(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    exp: Math.floor(NOW / 1000) + 3600,
    sub: "google-sub-123",
    email: "person@example.com",
    ...overrides,
  };
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  privateKey = pair.privateKey;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  jwksBody = { keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }] };
});

afterEach(() => vi.restoreAllMocks());

function stubJwks() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(jwksBody), { status: 200 })),
  );
}

describe("verifyGoogle — real JWKS path (staging)", () => {
  it("accepts a valid RS256 token and returns {sub,email}", async () => {
    stubJwks();
    const token = await forgeToken(validClaims());
    const id = await verifyGoogle(token, { mock: false, clientId: CLIENT_ID, nowMs: NOW });
    expect(id).toEqual({ sub: "google-sub-123", email: "person@example.com" });
  });

  it("rejects a wrong audience", async () => {
    stubJwks();
    const token = await forgeToken(validClaims({ aud: "someone-else" }));
    await expect(verifyGoogle(token, { mock: false, clientId: CLIENT_ID, nowMs: NOW })).rejects.toThrow(/aud/);
  });

  it("rejects a bad issuer", async () => {
    stubJwks();
    const token = await forgeToken(validClaims({ iss: "https://evil.example" }));
    await expect(verifyGoogle(token, { mock: false, clientId: CLIENT_ID, nowMs: NOW })).rejects.toThrow(/iss/);
  });

  it("rejects an expired token", async () => {
    stubJwks();
    const token = await forgeToken(validClaims({ exp: Math.floor(NOW / 1000) - 10 }));
    await expect(verifyGoogle(token, { mock: false, clientId: CLIENT_ID, nowMs: NOW })).rejects.toThrow(/expired/);
  });

  it("rejects a tampered signature", async () => {
    stubJwks();
    const token = await forgeToken(validClaims());
    const tampered = token.slice(0, -4) + (token.endsWith("AAAA") ? "BBBB" : "AAAA");
    await expect(verifyGoogle(tampered, { mock: false, clientId: CLIENT_ID, nowMs: NOW })).rejects.toThrow();
  });
});
