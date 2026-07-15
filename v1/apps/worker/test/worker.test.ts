/// <reference types="@cloudflare/vitest-pool-workers" />
import { env, SELF } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const ORIGIN = "http://localhost:5173";

// Apply the schema into the test D1 before anything (pool doesn't auto-migrate).
beforeAll(async () => {
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, google_sub TEXT UNIQUE NOT NULL, email TEXT NOT NULL, created_at INTEGER NOT NULL, anchor_hour REAL NOT NULL DEFAULT 4.5);",
  );
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, type TEXT NOT NULL, ts INTEGER NOT NULL, surah INTEGER, ayah INTEGER, rung TEXT, position INTEGER, choice TEXT, correct INTEGER, pretest INTEGER, to_ayah INTEGER, step_kind TEXT, structured INTEGER, latency INTEGER, resume TEXT, received_at INTEGER NOT NULL);",
  );
});

beforeEach(async () => {
  await env.DB.exec("DELETE FROM events;");
  await env.DB.exec("DELETE FROM users;");
});

/** Sign in via the mock verifier; returns the session cookie string. */
async function signIn(sub: string, email: string): Promise<string> {
  const res = await SELF.fetch("https://iman.test/auth/google", {
    method: "POST",
    headers: { "content-type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ credential: JSON.stringify({ sub, email }) }),
  });
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("Set-Cookie");
  expect(setCookie).toBeTruthy();
  return setCookie!.split(";")[0]!; // "iman_session=..."
}

function ev(id: string, ayah = 4) {
  return { id, type: "rung_complete", ts: 1000, surah: 12, ayah, rung: "S3" };
}

describe("auth", () => {
  it("mock sign-in mints a session and upserts the user (idempotent)", async () => {
    await signIn("sub-1", "a@example.com");
    await signIn("sub-1", "a@example.com"); // same sub again
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    expect(row!.n).toBe(1); // upsert, not duplicated
  });

  it("rejects a missing credential", async () => {
    const res = await SELF.fetch("https://iman.test/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("origin check (FR7)", () => {
  it("rejects a POST from a disallowed origin with 403", async () => {
    const res = await SELF.fetch("https://iman.test/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ credential: JSON.stringify({ sub: "x", email: "x@x.com" }) }),
    });
    expect(res.status).toBe(403);
  });
});

describe("events sync (routed through UserDO)", () => {
  it("requires a session (401 without cookie)", async () => {
    const res = await SELF.fetch("https://iman.test/events", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ events: [ev("e1")] }),
    });
    expect(res.status).toBe(401);
  });

  it("accepts a batch and lands it in D1", async () => {
    const cookie = await signIn("sub-e", "e@example.com");
    const res = await SELF.fetch("https://iman.test/events", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: ORIGIN, Cookie: cookie },
      body: JSON.stringify({ events: [ev("e1"), ev("e2")] }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 2, ignored: 0 });
  });

  it("is idempotent — resending the same ids is a no-op (INSERT OR IGNORE)", async () => {
    const cookie = await signIn("sub-i", "i@example.com");
    const post = (ids: string[]) =>
      SELF.fetch("https://iman.test/events", {
        method: "POST",
        headers: { "content-type": "application/json", Origin: ORIGIN, Cookie: cookie },
        body: JSON.stringify({ events: ids.map((id) => ev(id)) }),
      });
    expect(await (await post(["a", "b"])).json()).toEqual({ accepted: 2, ignored: 0 });
    expect(await (await post(["a", "b", "c"])).json()).toEqual({ accepted: 1, ignored: 2 });
    const count = await SELF.fetch("https://iman.test/events/count", { headers: { Cookie: cookie } });
    expect(await count.json()).toEqual({ count: 3 });
  });

  it("user_id comes from the session, NEVER the body", async () => {
    const cookie = await signIn("sub-legit", "legit@example.com");
    await SELF.fetch("https://iman.test/events", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: ORIGIN, Cookie: cookie },
      // attacker tries to spoof user_id in the body — must be ignored
      body: JSON.stringify({ user_id: 9999, events: [ev("spoof")] }),
    });
    const legit = await env.DB.prepare("SELECT id FROM users WHERE google_sub='sub-legit'").first<{ id: number }>();
    const row = await env.DB.prepare("SELECT user_id FROM events WHERE id='spoof'").first<{ user_id: number }>();
    expect(row!.user_id).toBe(legit!.id); // stamped with the session uid, not 9999
  });

  it("two users' events land under separate user_ids", async () => {
    const cookieA = await signIn("sub-a", "a@x.com");
    const cookieB = await signIn("sub-b", "b@x.com");
    const send = (cookie: string, id: string) =>
      SELF.fetch("https://iman.test/events", {
        method: "POST",
        headers: { "content-type": "application/json", Origin: ORIGIN, Cookie: cookie },
        body: JSON.stringify({ events: [ev(id)] }),
      });
    await send(cookieA, "ua");
    await send(cookieB, "ub");
    const rows = await env.DB.prepare("SELECT id, user_id FROM events ORDER BY id").all<{ id: string; user_id: number }>();
    const byId = Object.fromEntries(rows.results.map((r: { id: string; user_id: number }) => [r.id, r.user_id]));
    expect(byId["ua"]).not.toBe(byId["ub"]);
  });

  it("adoption: a full local-log flush after sign-in stamps every event with the uid", async () => {
    const cookie = await signIn("sub-adopt", "adopt@example.com");
    // simulate the client flushing its entire anonymous log at once
    const localLog = ["l1", "l2", "l3", "l4", "l5"].map((id) => ev(id));
    const res = await SELF.fetch("https://iman.test/events", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: ORIGIN, Cookie: cookie },
      body: JSON.stringify({ events: localLog }),
    });
    expect(await res.json()).toEqual({ accepted: 5, ignored: 0 });
    const uid = await env.DB.prepare("SELECT id FROM users WHERE google_sub='sub-adopt'").first<{ id: number }>();
    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE user_id=?").bind(uid!.id).first<{ n: number }>();
    expect(rows!.n).toBe(5); // whole history adopted under the account
  });

  it("GET /events requires a session (401 without cookie)", async () => {
    const res = await SELF.fetch("https://iman.test/events");
    expect(res.status).toBe(401);
  });

  it("GET /events hydrate returns the user's events, structured flag round-tripped", async () => {
    const cookie = await signIn("sub-hy", "hy@example.com");
    // one structured session event + one free-play (structured:false) event
    const structured = { ...ev("h-structured"), structured: true };
    const freePlay = { ...ev("h-free"), type: "tap", structured: false, correct: true };
    await SELF.fetch("https://iman.test/events", {
      method: "POST",
      headers: { "content-type": "application/json", Origin: ORIGIN, Cookie: cookie },
      body: JSON.stringify({ events: [structured, freePlay] }),
    });
    const res = await SELF.fetch("https://iman.test/events", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const { events } = (await res.json()) as { events: Array<{ id: string; structured?: boolean }> };
    const byId = Object.fromEntries(events.map((e) => [e.id, e]));
    // The free-play event MUST come back structured:false (else it would wrongly
    // move strength on a hydrated device — invariant #4/#5).
    expect(byId["h-free"]!.structured).toBe(false);
    expect(byId["h-structured"]!.structured).toBe(true);
  });

  it("GET /events only returns the caller's own events", async () => {
    const cookieA = await signIn("sub-hya", "hya@x.com");
    const cookieB = await signIn("sub-hyb", "hyb@x.com");
    const send = (cookie: string, id: string) =>
      SELF.fetch("https://iman.test/events", {
        method: "POST",
        headers: { "content-type": "application/json", Origin: ORIGIN, Cookie: cookie },
        body: JSON.stringify({ events: [ev(id)] }),
      });
    await send(cookieA, "own-a");
    await send(cookieB, "own-b");
    const res = await SELF.fetch("https://iman.test/events", { headers: { Cookie: cookieA } });
    const { events } = (await res.json()) as { events: Array<{ id: string }> };
    const ids = events.map((e) => e.id);
    expect(ids).toContain("own-a");
    expect(ids).not.toContain("own-b"); // never leak another user's history
  });
});
