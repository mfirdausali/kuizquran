// `lib/admin/session.ts` — the missing frontend half of the admin
// client-side gate, named unbuilt since v3-D92 ("shipping a redirect with
// no real check behind it would be security theatre") and repeated through
// v3-D100/D124/D125/D126. `POST /api/admin/login` and (new, this run)
// `GET /api/admin/whoami` are the real gate; this module is a thin, honest
// client over both.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { getIdentity, getToken, resetTokenForTests, setToken } from "@/lib/sync/token";
import { adminLogin, adminLogout, checkAdminSession } from "./session";

describe("checkAdminSession — no live token", () => {
  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
  });

  it("is `signed-out` without ever making a request", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await checkAdminSession();
    expect(result).toEqual({ state: "signed-out" });
    expect(seen).toHaveLength(0);
  });
});

describe("checkAdminSession — with a live token", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
    setToken("some-token", "some-token");
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("requests /api/admin/whoami through the single egress", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ pseudonym: "u_abc123", roles: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await checkAdminSession();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/admin/whoami");
  });

  it("returns `authorized` with the real pseudonym+roles on 200", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ pseudonym: "u_abc123", roles: ["qari"] }), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await checkAdminSession();
    expect(result).toEqual({
      state: "authorized",
      identity: { pseudonym: "u_abc123", roles: ["qari"] },
    });
  });

  it("returns `signed-out` on 403 — this token is live but not admin", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: "forbidden" }), { status: 403 })) as unknown as typeof fetch;

    expect(await checkAdminSession()).toEqual({ state: "signed-out" });
  });

  it("returns `denied` on an unrelated server error — never mistaken for signed-out", async () => {
    globalThis.fetch = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;

    const result = await checkAdminSession();
    expect(result.state).toBe("denied");
  });
});

describe("adminLogin", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
    resetTokenForTests();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts credentials to /api/admin/login through the single egress", async () => {
    const seen: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify({ token: "admin-tok", pseudonym: "u_ops", roles: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await adminLogin("ops@example.com", "correct-horse-battery-staple");

    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toContain("/api/admin/login");
    expect(seen[0]!.body).toEqual({ email: "ops@example.com", password: "correct-horse-battery-staple" });
  });

  it("on success, ADOPTS the token — the same slot apiFetch attaches to every request", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ token: "admin-tok", pseudonym: "u_ops", roles: ["qari"] }), { status: 200 }),
    ) as unknown as typeof fetch;

    const outcome = await adminLogin("ops@example.com", "pw");

    expect(outcome).toEqual({ ok: true, identity: { pseudonym: "u_ops", roles: ["qari"] } });
    expect(getToken()).toBe("admin-tok");
    expect(getIdentity()).toBe("admin-tok");
  });

  it("on a 403 denial, echoes the server's OWN generic error verbatim — never invents one", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Not authorized for operator access." }), { status: 403 }),
    ) as unknown as typeof fetch;

    const outcome = await adminLogin("ghost@example.com", "wrong");

    expect(outcome).toEqual({ ok: false, error: "Not authorized for operator access." });
    // And the token slot is untouched by a failed attempt.
    expect(getToken()).toBeNull();
  });

  it("never varies its own wording across the four failure cases — it only relays", async () => {
    for (const body of [
      { error: "Not authorized for operator access." },
      {},
    ]) {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: 403 })) as unknown as typeof fetch;
      const outcome = await adminLogin("x@example.com", "y");
      expect(outcome.ok).toBe(false);
      expect(outcome.error).toBeTruthy();
    }
  });
});

describe("adminLogout", () => {
  beforeEach(() => resetTokenForTests());

  it("forgets the current identity", () => {
    setToken("admin-tok", "admin-tok");
    adminLogout();
    expect(getToken()).toBeNull();
  });
});
