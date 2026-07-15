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
  await env.DB.exec("DELETE FROM events;");
  await env.DB.exec("DELETE FROM users;");
});

// ADMIN_EMAILS is set in vitest.config.ts to "admin@example.com".
async function signIn(sub: string, email: string): Promise<string> {
  const res = await SELF.fetch("https://iman.test/auth/google", {
    method: "POST",
    headers: { "content-type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ credential: JSON.stringify({ sub, email }) }),
  });
  expect(res.status).toBe(200);
  return res.headers.get("Set-Cookie")!.split(";")[0]!;
}

describe("/admin gating (FR8)", () => {
  it("401 without a session", async () => {
    const res = await SELF.fetch("https://iman.test/admin");
    expect(res.status).toBe(401);
  });

  it("403 for a signed-in NON-admin", async () => {
    const cookie = await signIn("sub-normal", "normal@example.com");
    const res = await SELF.fetch("https://iman.test/admin", { headers: { Cookie: cookie } });
    expect(res.status).toBe(403);
  });

  it("200 + HTML for an ADMIN_EMAILS session, showing the §3 table", async () => {
    const cookie = await signIn("sub-admin", "admin@example.com");
    const res = await SELF.fetch("https://iman.test/admin", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    // all 7 §3 metric labels present
    for (const label of [
      "Day-1 gate pass rate",
      "Anchor adherence",
      "Cycles-to-clean-pass",
      "Look-alike slip rate",
      "D30 retention",
      "Interruption → completion",
      "Time-per-word",
    ]) {
      expect(html).toContain(label);
    }
    // links the design system
    expect(html).toContain("/iman-ui.css");
  });

  it("admin drill-down renders for a user", async () => {
    const cookie = await signIn("sub-admin", "admin@example.com");
    // create a target user + an encode event
    await env.DB.prepare("INSERT INTO users (id, google_sub, email, created_at) VALUES (2,'s2','person@x.com',0)").run();
    await env.DB.prepare(
      "INSERT INTO events (id,user_id,type,ts,ayah,rung,received_at) VALUES ('x',2,'rung_complete',1000,4,'S3',0)",
    ).run();
    const res = await SELF.fetch("https://iman.test/admin/user/2", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("person@x.com");
    expect(html).toContain("Ayat encoded");
  });

  it("is read-only: POST /admin is not a route (404/405, never mutates)", async () => {
    const cookie = await signIn("sub-admin", "admin@example.com");
    const res = await SELF.fetch("https://iman.test/admin", {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN },
    });
    expect([404, 405]).toContain(res.status);
  });
});
