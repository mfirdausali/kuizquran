import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearToken, ensureDevice, getToken, login, logout, me, register } from "./auth.ts";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ensureDevice (v2-D03 anonymous-first)", () => {
  it("mints and stores a token on first call", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ token: "tok-1", isAnonymous: true }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const token = await ensureDevice();
    expect(token).toBe("tok-1");
    expect(getToken()).toBe("tok-1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reuses an existing token without a network call", async () => {
    localStorage.setItem("iman-auth-token", "already-have-one");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await ensureDevice()).toBe("already-have-one");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null and stores nothing when offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await ensureDevice()).toBeNull();
    expect(getToken()).toBeNull();
  });
});

describe("me", () => {
  it("returns null with no local token (never calls the network)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await me()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the parsed body on a 200", async () => {
    localStorage.setItem("iman-auth-token", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ signedIn: true, email: null, anchorHour: 4.5, hasHistory: false, isAnonymous: true }),
          { status: 200 },
        ),
      ),
    );
    const info = await me();
    expect(info?.signedIn).toBe(true);
    expect(info?.isAnonymous).toBe(true);
  });

  it("returns null on a 401 (revoked/invalid token)", async () => {
    localStorage.setItem("iman-auth-token", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    expect(await me()).toBeNull();
  });
});

describe("register (account adoption, claims the anonymous device in place)", () => {
  it("mints a device token first if none exists, then claims it", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/auth/anonymous")) {
        return new Response(JSON.stringify({ token: "dev-tok" }), { status: 201 });
      }
      return new Response(JSON.stringify({ ok: true, email: "a@b.com", isAnonymous: false }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await register("a@b.com", "password123");
    expect(res.ok).toBe(true);
    expect(getToken()).toBe("dev-tok"); // register keeps the SAME device token
  });

  it("surfaces a server validation error", async () => {
    localStorage.setItem("iman-auth-token", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "email already taken" }), { status: 422 })),
    );
    const res = await register("taken@b.com", "password123");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("email already taken");
  });
});

describe("login (adopt an existing account onto this device)", () => {
  it("swaps the local token on success", async () => {
    localStorage.setItem("iman-auth-token", "old-anon-tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ token: "existing-account-tok" }), { status: 200 })),
    );
    const res = await login("a@b.com", "password123");
    expect(res.ok).toBe(true);
    expect(getToken()).toBe("existing-account-tok");
  });

  it("leaves the token untouched on invalid credentials", async () => {
    localStorage.setItem("iman-auth-token", "old-anon-tok");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "invalid credentials" }), { status: 401 })));
    const res = await login("a@b.com", "wrong");
    expect(res.ok).toBe(false);
    expect(getToken()).toBe("old-anon-tok");
  });
});

describe("logout", () => {
  it("revokes server-side then clears the local token", async () => {
    localStorage.setItem("iman-auth-token", "tok");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await logout();
    expect(getToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("still clears the local token when offline", async () => {
    localStorage.setItem("iman-auth-token", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await logout();
    expect(getToken()).toBeNull();
  });

  it("clearToken is a no-op safe to call directly", () => {
    clearToken();
    expect(getToken()).toBeNull();
  });
});
