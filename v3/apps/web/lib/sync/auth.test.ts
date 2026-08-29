// DEFECTS.md#B8's CLOSING TEST — the frontend half.
//
// B8, verbatim:
//
//     `auth.ts:51-52` — `ensureDevice()` returns early if *any* token exists,
//     and `clearToken()` is never called on a 401 anywhere in `src/`. A revoked
//     token permanently disables sync; the only recovery is hand-clearing
//     localStorage.
//
//     Closes when: a 401 interceptor clears the token and re-mints, proven by a
//     test that revokes server-side and asserts recovery.
//
// THE SERVER IS STUBBED, AND SAID SO PLAINLY. The client-side layer below uses
// a stub honouring the real contract: `POST /api/auth/anonymous` is
// UNAUTHENTICATED and returns 201 with `{token, isAnonymous, anchorHour,
// hasHistory}` (AuthController::anonymous, lines 38-43); a revoked token gets
// Sanctum's standard 401 on `POST /api/events`. The SERVER-SIDE half — proving
// the revocation is real, so this stub's 401 is a faithful model rather than a
// fiction — lives in `v3/api/tests/Feature/Auth/TokenRevocationTest.php`.
//
// THE ASSERTION THAT MATTERS is not "recovery happened". It is WHICH TOKEN the
// retry carried and THAT THE STORED TOKEN CHANGED. Asserting only "the request
// eventually succeeded" leaves B8's actual defect alive under a green test —
// the closest analogue to the four vacuous verifications this build already
// shipped (v3-D38/D45/D49/D50).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { resetDbForTests } from "@/lib/idb/db";
import {
  apiFetch,
  mintCalls,
  resetApiFetchForTests,
  SyncAuthError,
} from "./apiFetch.ts";
import {
  clearToken,
  getToken,
  hasLiveToken,
  isTokenDead,
  markTokenDead,
  resetTokenForTests,
  setToken,
} from "./token.ts";

interface Recorded {
  path: string;
  authorization: string | null;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  resetApiFetchForTests();
  resetTokenForTests();
  vi.unstubAllGlobals();
});

/**
 * A stub server whose token is REVOKED: the old token 401s, a mint issues a
 * fresh one, and the new token works.
 */
function installRevokedTokenServer(opts: { mintToken?: string } = {}) {
  const calls: Recorded[] = [];
  const mintToken = opts.mintToken ?? "fresh-token";
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const authorization = new Headers(init?.headers).get("Authorization");
    const path = String(url);
    calls.push({ path, authorization });

    if (path.includes("/api/auth/anonymous")) {
      // Unauthenticated route, 201.
      return new Response(
        JSON.stringify({ token: mintToken, isAnonymous: true, anchorHour: 5, hasHistory: false }),
        { status: 201 },
      );
    }
    // The revoked token is refused; the freshly minted one is accepted.
    if (authorization === `Bearer ${mintToken}`) {
      return new Response(JSON.stringify({ accepted: 1, ignored: 0 }), { status: 200 });
    }
    return new Response(JSON.stringify({ message: "Unauthenticated." }), { status: 401 });
  });
  return calls;
}

describe("B8 — a 401 clears the dead token and re-mints", () => {
  it("clears the DEAD token, mints, and retries with the NEW token", async () => {
    setToken("revoked-token");
    const calls = installRevokedTokenServer();

    const response = await apiFetch("/api/events", { method: "POST", body: "{}" });
    expect(response.status).toBe(200);

    // 1. THE STORED TOKEN CHANGED. This is the assertion M7 exists to force:
    //    without it, removing clearToken() leaves the test green.
    expect(getToken()).toBe("fresh-token");
    expect(getToken()).not.toBe("revoked-token");

    // 2. The mint was called, exactly once.
    expect(mintCalls()).toBe(1);

    // 3. THE RETRY CARRIED THE NEW TOKEN — not merely "a request succeeded".
    //    (D49's lesson: a guard whose test never distinguished the two states
    //    it guarded.)
    const eventCalls = calls.filter((c) => c.path.includes("/api/events"));
    expect(eventCalls).toHaveLength(2);
    expect(eventCalls[0]!.authorization).toBe("Bearer revoked-token");
    expect(eventCalls[1]!.authorization).toBe("Bearer fresh-token");

    // 4. Order: the mint happened BETWEEN the two attempts, not before the
    //    first — a client that minted eagerly would not be exercising the
    //    interceptor at all.
    const mintIndex = calls.findIndex((c) => c.path.includes("/api/auth/anonymous"));
    expect(mintIndex).toBe(1);
  });

  it("when the MINT FAILS, the dead token is gone and is never reattached", async () => {
    // The state M7 (remove clearToken, keep the re-mint) actually corrupts. On
    // the happy path a successful mint overwrites the token anyway, so "the
    // stored token changed" cannot see M7. The FAILED-mint path can: without
    // clearToken(), the revoked token survives in storage and every later
    // request re-attaches it — B8's wedge exactly, a device that 401s forever.
    setToken("revoked-token");
    const seen: (string | null)[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/auth/anonymous")) {
        return new Response("{}", { status: 500 }); // the mint fails
      }
      seen.push(new Headers(init?.headers).get("Authorization"));
      return new Response("{}", { status: 401 });
    });

    await expect(apiFetch("/api/events", { method: "POST" })).rejects.toBeInstanceOf(SyncAuthError);

    // The revoked token is GONE, not merely superseded.
    expect(getToken()).toBeNull();
    expect(isTokenDead()).toBe(true);

    // A later request carries NO Authorization header rather than re-offering
    // the revoked one.
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get("Authorization"));
      return new Response("{}", { status: 200 });
    });
    await apiFetch("/api/events", { method: "GET" });
    expect(seen[seen.length - 1]).toBeNull();
  });

  it("the token is cleared BEFORE the mint, so nothing can return early on it", async () => {
    setToken("revoked-token");
    let tokenDuringMint: string | null = "not-observed";
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.includes("/api/auth/anonymous")) {
        // Observed at the moment the mint is in flight: the dead token must
        // already be gone.
        tokenDuringMint = getToken();
        return new Response(JSON.stringify({ token: "fresh-token", isAnonymous: true }), {
          status: 201,
        });
      }
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === "Bearer fresh-token") return new Response("{}", { status: 200 });
      return new Response("{}", { status: 401 });
    });

    await apiFetch("/api/events", { method: "POST" });
    expect(tokenDuringMint).toBeNull();
  });
});

describe("B8's first half — liveness, not mere existence", () => {
  it("hasLiveToken() is FALSE for a token that is PRESENT but marked dead", () => {
    setToken("some-token");
    expect(hasLiveToken()).toBe(true);

    // Mark WITHOUT removing. This is the state the v2 predicate could not
    // see: `getToken()` still returns a string, and v2's "does a token string
    // exist" would happily return early on it forever.
    markTokenDead();
    expect(getToken()).toBe("some-token"); // still present…
    expect(isTokenDead()).toBe(true);
    expect(hasLiveToken()).toBe(false); // …but NOT live.
  });

  it("a PRESENT-but-dead token is never ATTACHED to a request", async () => {
    // The behavioural consequence of the predicate, not merely its return
    // value. This is the assertion that kills the "restore v2's early-return"
    // mutation: with `getToken() !== null`, the dead token IS attached here.
    setToken("marked-dead");
    markTokenDead();

    const calls: Recorded[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({
        path: String(url),
        authorization: new Headers(init?.headers).get("Authorization"),
      });
      if (String(url).includes("/api/auth/anonymous")) {
        return new Response(JSON.stringify({ token: "t2", isAnonymous: true }), { status: 201 });
      }
      return new Response("{}", { status: 200 });
    });

    await apiFetch("/api/events", { method: "GET" });
    expect(calls[0]!.authorization).toBeNull();
  });

  it("hasLiveToken() is FALSE after clearToken()", () => {
    setToken("some-token");
    clearToken();
    expect(isTokenDead()).toBe(true);
    expect(getToken()).toBeNull();
    expect(hasLiveToken()).toBe(false);
  });

  it("a successful mint marks the token live again", async () => {
    setToken("revoked-token");
    installRevokedTokenServer();
    await apiFetch("/api/events", { method: "POST" });
    expect(isTokenDead()).toBe(false);
    expect(hasLiveToken()).toBe(true);
  });

  it("does not attach an Authorization header when the token is dead", async () => {
    setToken("revoked-token");
    clearToken();
    const calls: Recorded[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ path: String(url), authorization: new Headers(init?.headers).get("Authorization") });
      if (String(url).includes("/api/auth/anonymous")) {
        return new Response(JSON.stringify({ token: "t2", isAnonymous: true }), { status: 201 });
      }
      return new Response("{}", { status: 200 });
    });
    await apiFetch("/api/events", { method: "GET" });
    expect(calls[0]!.authorization).toBeNull();
  });
});

describe("the three brakes — a permanently-401ing server cannot spin forever", () => {
  /** A server that 401s EVERYTHING except the mint. The mint always succeeds,
   *  so nothing but the brakes stops an unbounded loop.
   *
   *  THE HARD CAP IS PART OF THE TEST. Without it, removing the retry-once
   *  brake makes this suite HANG rather than fail — a real RED, but an
   *  illegible one that looks like a stuck CI job rather than a broken brake.
   *  Throwing at a bound turns "spins forever" into a named failure. */
  const CALL_CAP = 25;
  function installAlways401() {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      const path = String(url);
      calls.push(path);
      if (calls.length > CALL_CAP) {
        throw new Error(
          `re-mint loop: ${calls.length} requests without terminating — a brake is missing`,
        );
      }
      if (path.includes("/api/auth/anonymous")) {
        return new Response(JSON.stringify({ token: `t-${calls.length}`, isAnonymous: true }), {
          status: 201,
        });
      }
      return new Response("{}", { status: 401 });
    });
    return calls;
  }

  it("BRAKE 1 — exactly ONE mint attempt, then a degraded state", async () => {
    setToken("dead");
    const calls = installAlways401();

    // It must reject with SyncAuthError SPECIFICALLY — not with the stub's
    // loop-cap error, which would mean the brake is gone and we merely
    // stopped it from running forever.
    await expect(apiFetch("/api/events", { method: "POST" })).rejects.toBeInstanceOf(SyncAuthError);

    // THE CALL COUNT, not merely "it terminated". A test that only checks
    // "doesn't hang" passes with a 3-deep loop.
    expect(mintCalls()).toBe(1);
    const mints = calls.filter((c) => c.includes("/api/auth/anonymous"));
    expect(mints).toHaveLength(1);
    // Two attempts at the real request: the original and the single retry.
    expect(calls.filter((c) => c.includes("/api/events"))).toHaveLength(2);
  });

  it("BRAKE 2 — two CONCURRENT 401s share ONE mint", async () => {
    setToken("dead");
    let mintCallsSeen = 0;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.includes("/api/auth/anonymous")) {
        mintCallsSeen += 1;
        // A slow mint widens the race window this brake exists to close.
        await new Promise((r) => setTimeout(r, 10));
        return new Response(JSON.stringify({ token: "shared", isAnonymous: true }), { status: 201 });
      }
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === "Bearer shared") return new Response("{}", { status: 200 });
      return new Response("{}", { status: 401 });
    });

    // The outbox POST and the pull GET race constantly in production.
    const [a, b] = await Promise.all([
      apiFetch("/api/events", { method: "POST" }),
      apiFetch("/api/events?since=0", { method: "GET" }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    // EXACTLY ONE. Without this brake, N concurrent 401s mint N anonymous
    // users and N-1 silently orphan their events under abandoned accounts —
    // a data-loss bug wearing an auth costume.
    expect(mintCallsSeen).toBe(1);
    expect(mintCalls()).toBe(1);
  });

  it("BRAKE 3 — after a failed mint, no further mint is attempted", async () => {
    setToken("dead");
    let mintAttempts = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      const path = String(url);
      if (path.includes("/api/auth/anonymous")) {
        mintAttempts += 1;
        return new Response("{}", { status: 500 });
      }
      return new Response("{}", { status: 401 });
    });

    await expect(apiFetch("/api/events", { method: "POST" })).rejects.toBeInstanceOf(SyncAuthError);
    expect(mintAttempts).toBe(1);

    // A second cycle, within the cooldown, must NOT mint again.
    await expect(apiFetch("/api/events", { method: "POST" })).rejects.toBeInstanceOf(SyncAuthError);
    expect(mintAttempts).toBe(1);
  });

  it("the MINT ENDPOINT is never routed through the interceptor", async () => {
    // A 401 from the mint endpoint triggering a mint IS the loop, directly.
    setToken("dead");
    let mintAttempts = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).includes("/api/auth/anonymous")) {
        mintAttempts += 1;
        // The mint itself 401s. If it were routed through apiFetch, this
        // would recurse.
        return new Response("{}", { status: 401 });
      }
      return new Response("{}", { status: 401 });
    });

    await expect(apiFetch("/api/events", { method: "POST" })).rejects.toBeInstanceOf(SyncAuthError);
    expect(mintAttempts).toBe(1);
  });
});

describe("v3-D153 — /api/auth/login's OWN 401 is a credential denial, never a dead-token signal", () => {
  // Found while wiring lib/account/auth.ts#loginAccount (DEFECTS.md#AUTH-,
  // zero frontend callers until now). `AuthController::login()` returns 401
  // for wrong credentials on a route that sits OUTSIDE `auth:sanctum` — it
  // needs no token at all. Routing it through the generic interceptor made a
  // wrong password look identical to a dead device token: clearToken() fired,
  // a re-mint was attempted, and the caller saw a mint-related error instead
  // of "invalid credentials". Mirrors ANONYMOUS_PATH's own reasoning (a 401
  // from the mint endpoint triggering a mint IS the loop) for the sibling
  // case: a credential check whose 401 triggers a re-mint silently discards
  // the real answer.
  it("does not clear the token or attempt a mint on a 401 from /api/auth/login", async () => {
    setToken("still-good-token");
    let mintAttempts = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      const path = String(url);
      if (path.includes("/api/auth/anonymous")) {
        mintAttempts += 1;
        return new Response(JSON.stringify({ token: "should-never-be-minted" }), { status: 201 });
      }
      if (path.includes("/api/auth/login")) {
        return new Response(JSON.stringify({ error: "invalid credentials" }), { status: 401 });
      }
      throw new Error(`unexpected request: ${path}`);
    });

    const response = await apiFetch("/api/auth/login", { method: "POST" });

    expect(response.status).toBe(401);
    expect(mintAttempts).toBe(0);
    // The device's own token — unrelated to the login attempt's outcome —
    // must survive a failed login untouched.
    expect(getToken()).toBe("still-good-token");
    expect(hasLiveToken()).toBe(true);
  });
});

describe("a non-401 response is returned untouched", () => {
  it("does not mint on a 500", async () => {
    setToken("good");
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }));
    const r = await apiFetch("/api/events", { method: "POST" });
    expect(r.status).toBe(500);
    expect(mintCalls()).toBe(0);
    expect(getToken()).toBe("good");
  });

  it("does not mint on a 200", async () => {
    setToken("good");
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 200 }));
    await apiFetch("/api/events", { method: "GET" });
    expect(mintCalls()).toBe(0);
  });
});
