/// <reference types="@cloudflare/vitest-pool-workers" />
import { env, SELF } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const ORIGIN = "http://localhost:5173";

beforeAll(async () => {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, google_sub TEXT UNIQUE NOT NULL, email TEXT NOT NULL, created_at INTEGER NOT NULL, anchor_hour REAL NOT NULL DEFAULT 4.5);",
  );
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, type TEXT NOT NULL, ts INTEGER NOT NULL, surah INTEGER, ayah INTEGER, rung TEXT, position INTEGER, choice TEXT, correct INTEGER, pretest INTEGER, to_ayah INTEGER, step_kind TEXT, structured INTEGER, latency INTEGER, resume TEXT, received_at INTEGER NOT NULL);",
  );
});
beforeEach(async () => {
  await env.DB.exec("DELETE FROM users;");
});

async function signIn(sub: string, email: string): Promise<string> {
  const res = await SELF.fetch("https://iman.test/auth/google", {
    method: "POST",
    headers: { "content-type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ credential: JSON.stringify({ sub, email }) }),
  });
  return res.headers.get("Set-Cookie")!.split(";")[0]!;
}

describe("/settings (FR9 anchor)", () => {
  it("401 without a session", async () => {
    expect((await SELF.fetch("https://iman.test/settings")).status).toBe(401);
  });

  it("GET returns the default anchor (4.5) for a fresh user", async () => {
    const cookie = await signIn("s1", "a@x.com");
    const res = await SELF.fetch("https://iman.test/settings", { headers: { Cookie: cookie } });
    expect(await res.json()).toEqual({ anchorHour: 4.5 });
  });

  it("/me restores session on reload (signedIn=false without cookie, true with)", async () => {
    // No cookie → signedIn:false (not 401 — /me is public and just reports state).
    const anon = await SELF.fetch("https://iman.test/me");
    expect(await anon.json()).toMatchObject({ signedIn: false });
    // With a valid session cookie → signedIn:true + the email.
    const cookie = await signIn("me1", "me@example.com");
    const me = await SELF.fetch("https://iman.test/me", { headers: { Cookie: cookie } });
    const body = (await me.json()) as { signedIn: boolean; email: string; hasHistory: boolean };
    expect(body.signedIn).toBe(true);
    expect(body.email).toBe("me@example.com");
    expect(body.hasHistory).toBe(false); // no events yet
  });

  it("POST sets the anchor; GET reflects it; user_id from session", async () => {
    const cookie = await signIn("s2", "b@x.com");
    const set = await SELF.fetch("https://iman.test/settings", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: ORIGIN, Cookie: cookie },
      body: JSON.stringify({ anchorHour: 6.5 }),
    });
    expect(await set.json()).toEqual({ ok: true, anchorHour: 6.5 });
    const get = await SELF.fetch("https://iman.test/settings", { headers: { Cookie: cookie } });
    expect(await get.json()).toEqual({ anchorHour: 6.5 });
  });

  it("rejects an out-of-range anchor and a bad origin", async () => {
    const cookie = await signIn("s3", "c@x.com");
    const bad = await SELF.fetch("https://iman.test/settings", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: ORIGIN, Cookie: cookie },
      body: JSON.stringify({ anchorHour: 99 }),
    });
    expect(bad.status).toBe(400);
    const evil = await SELF.fetch("https://iman.test/settings", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: "https://evil.example", Cookie: cookie },
      body: JSON.stringify({ anchorHour: 6 }),
    });
    expect(evil.status).toBe(403);
  });
});
