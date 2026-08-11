// The outbox: chunking (#110), crash-mid-flight (#108), the pending predicate,
// and the oversize quarantine.
//
// THE SERVER IS STUBBED, AND SAID SO PLAINLY. There is no live Laravel in this
// suite. The stub honours the REAL contract in
// `v3/api/app/Http/Controllers/EventsController.php`:
//
//   - POST /api/events takes `{events: DrillEvent[]}` and returns
//     `{accepted, ignored}` (lines 98-101);
//   - it is IDEMPOTENT BY UUID — `Event::insertOrIgnore($rows)` over
//     `unique(user_id, uuid)`, so a re-POST of a uuid the server already holds
//     increments `ignored`, not `accepted`;
//   - `user_id` comes from the authenticated caller, never the body (line 47),
//     so the stub keys its store per token.
//
// The idempotency is modelled rather than asserted-away, because #108's whole
// claim ("ignored-with-matching-digest = success") depends on it.
//
// NO ARABIC LITERALS. Events reference fixture COORDINATES only.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { DrillEvent } from "@engine/types.ts";
import { append } from "@/lib/idb/append";
import { openDb, resetDbForTests } from "@/lib/idb/db";
import { writeLock } from "@/lib/idb/writeLock";
import { countPending, EVENT_BYTE_MAX, OUTBOX_BATCH_MAX, selectPending, wireBytes } from "./outbox.ts";
import { pushOutbox } from "./sync.ts";
import { resetApiFetchForTests } from "./apiFetch.ts";
import { resetTokenForTests, setToken } from "./token.ts";

const CTX = { now: 1_700_000_000_000, tz: "UTC" };

function ev(over: Partial<DrillEvent> = {}): DrillEvent {
  return { type: "tap", ts: CTX.now, surah: 112, ayah: 1, rung: "S1", ...over };
}

/** A FAKE server honouring EventsController's real contract. Stated plainly:
 *  this is a stub, not a live API. */
interface FakeServer {
  /** uuid -> stored wire payload, per token (user scoping, line 47). */
  store: Map<string, Map<string, DrillEvent>>;
  posts: DrillEvent[][];
  /** Force the next N POSTs to behave a particular way. */
  failNext: number;
  status: number;
  /** Swallow the RESPONSE after storing — models a crash/lost response where
   *  the server committed but the client never learned. */
  loseResponse: boolean;
}

function makeServer(): FakeServer {
  return { store: new Map(), posts: [], failNext: 0, status: 200, loseResponse: false };
}

function installFetch(server: FakeServer): void {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const token = new Headers(init?.headers).get("Authorization") ?? "anon";
    const path = String(url);

    if (path.includes("/api/auth/anonymous")) {
      return new Response(JSON.stringify({ token: "minted", isAnonymous: true }), { status: 201 });
    }

    if (path.includes("/api/events") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { events: DrillEvent[] };
      server.posts.push(body.events);

      if (server.failNext > 0) {
        server.failNext -= 1;
        return new Response("{}", { status: server.status });
      }

      // insertOrIgnore over unique(user_id, uuid): already-present uuids are
      // IGNORED, not duplicated and not errored.
      const forUser = server.store.get(token) ?? new Map<string, DrillEvent>();
      let accepted = 0;
      let ignored = 0;
      for (const e of body.events) {
        if (forUser.has(e.id!)) ignored += 1;
        else {
          forUser.set(e.id!, e);
          accepted += 1;
        }
      }
      server.store.set(token, forUser);

      if (server.loseResponse) {
        // The server COMMITTED, but the client never learns. This is the exact
        // #108 window: the marking transaction never runs.
        throw new TypeError("network error after commit");
      }
      return new Response(JSON.stringify({ accepted, ignored }), { status: 200 });
    }

    // Pull: not exercised here.
    return new Response(JSON.stringify({ events: [], nextCursor: 0, hasMore: false }), {
      status: 200,
    });
  });
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  resetApiFetchForTests();
  resetTokenForTests();
  writeLock.forceForTests({ role: "writer" });
  setToken("tok-1");
  vi.unstubAllGlobals();
});

/** Append N events through the REAL append path, so deviceSeq/syncedAt are
 *  stamped exactly as production stamps them. */
async function appendMany(n: number, over: (i: number) => Partial<DrillEvent> = () => ({})) {
  for (let i = 0; i < n; i++) {
    await append(ev({ id: `e-${String(i).padStart(4, "0")}`, ayah: 1, ...over(i) }), CTX);
  }
}

describe("the pending predicate", () => {
  it("counts appended rows as pending (`syncedAt == null`)", async () => {
    await appendMany(3);
    expect(await countPending()).toBe(3);
  });

  it("does NOT count rows already marked synced", async () => {
    await appendMany(3);
    const db = await openDb();
    const row = await db.get("events", "e-0001");
    await db.put("events", { ...row!, syncedAt: CTX.now });
    expect(await countPending()).toBe(2);
  });

  it("treats `undefined` syncedAt as pending, exactly like `null`", async () => {
    // append() writes `null`; a row arriving by another path could carry
    // `undefined`. A predicate of `!== undefined` would call every appended
    // row synced; `!== null` would call every undefined row pending. Only
    // `== null` is right for both, and this test is what pins it.
    const db = await openDb();
    await db.put("events", {
      ...ev({ id: "undef", deviceId: "d", deviceSeq: 1 }),
    } as never);
    expect(await countPending()).toBe(1);
  });
});

describe("#110 — chunking ships FIRST", () => {
  // 20s, not the default 5s. This test appends 450 events through the REAL
  // append path (one transaction each, deviceSeq allocated per row), which is
  // genuinely slow and got slower under parallel suite load — it went red once
  // in a full `make test` run and passed three times in isolation. An
  // intermittently-red test is worse than a slow one: it trains everyone to
  // re-run rather than read, which is how a real failure gets dismissed. The
  // budget is raised; not one assertion is weakened.
  it("splits 450 pending events into 200 / 200 / 50, in deviceSeq order", async () => {
    const server = makeServer();
    installFetch(server);
    await appendMany(450);

    const result = await pushOutbox({ now: CTX.now });

    // BATCH SIZES AND THEIR ORDER, not merely the request count — a test
    // asserting only "3 requests" passes with 150/150/150.
    expect(server.posts.map((p) => p.length)).toEqual([200, 200, 50]);
    expect(result.batches).toBe(3);
    expect(result.accepted).toBe(450);

    // Drained in (deviceId, deviceSeq) order: the first batch holds the
    // OLDEST events, so a partial success leaves a contiguous synced prefix.
    const firstIds = server.posts[0]!.map((e) => e.id);
    expect(firstIds[0]).toBe("e-0000");
    expect(firstIds[199]).toBe("e-0199");
    expect(server.posts[2]![0]!.id).toBe("e-0400");

    expect(await countPending()).toBe(0);
  }, 20_000);

  it("never sends more than OUTBOX_BATCH_MAX in one request", async () => {
    const server = makeServer();
    installFetch(server);
    await appendMany(201);
    await pushOutbox({ now: CTX.now });
    for (const post of server.posts) expect(post.length).toBeLessThanOrEqual(OUTBOX_BATCH_MAX);
  });
});

describe("#108 — partial batch retry, and the crash mid-flight", () => {
  it("a LOST RESPONSE leaves rows pending, and the re-send is IGNORED, not duplicated", async () => {
    const server = makeServer();
    installFetch(server);
    await appendMany(5);

    // The server commits but the response never arrives: the marking
    // transaction never runs.
    server.loseResponse = true;
    const first = await pushOutbox({ now: CTX.now });
    expect(first.degraded).toBe("network");
    // NOTHING was marked — this is the property that makes the flag safe.
    expect(await countPending()).toBe(5);

    // The next flush re-sends. The server already holds every uuid.
    server.loseResponse = false;
    const second = await pushOutbox({ now: CTX.now });
    expect(second.accepted).toBe(0);
    expect(second.ignored).toBe(5);
    // `ignored` is SUCCESS (#108): the rows get marked.
    expect(await countPending()).toBe(0);

    // And the server holds each uuid EXACTLY ONCE.
    const stored = server.store.get("Bearer tok-1")!;
    expect(stored.size).toBe(5);
  });

  it("marks rows synced only AFTER a 2xx that included them", async () => {
    const server = makeServer();
    installFetch(server);
    await appendMany(3);
    server.failNext = 1;
    server.status = 500;

    const result = await pushOutbox({ now: CTX.now });
    expect(result.degraded).toBe("server");
    // A 5xx marks nothing — nothing is lost, the next flush re-sends.
    expect(await countPending()).toBe(3);
  });

  it("a 400 (malformed batch) does NOT spin — it stops the cycle", async () => {
    const server = makeServer();
    installFetch(server);
    await appendMany(3);
    server.failNext = 1;
    server.status = 400;

    const result = await pushOutbox({ now: CTX.now });
    expect(result.degraded).toBe("malformed");
    // Exactly ONE attempt. Retrying a 400 identically reproduces it forever.
    expect(server.posts).toHaveLength(1);
  });

  it("never re-sends an already-synced row", async () => {
    const server = makeServer();
    installFetch(server);
    await appendMany(3);
    await pushOutbox({ now: CTX.now });
    const before = server.posts.length;
    const again = await pushOutbox({ now: CTX.now });
    expect(server.posts.length).toBe(before);
    expect(again.batches).toBe(0);
  });
});

describe("#110 — oversize quarantine", () => {
  /** A payload comfortably over the 8KB wire budget. Built from a repeated
   *  ASCII coordinate string — never Arabic. */
  const bigSnapshot = { blob: "x".repeat(EVENT_BYTE_MAX + 2048) };

  it("computes wire bytes over the WIRE shape", async () => {
    await appendMany(1);
    const db = await openDb();
    const row = await db.get("events", "e-0000");
    expect(wireBytes(row!)).toBeLessThan(EVENT_BYTE_MAX);
  });

  it("excludes an oversize event from the batch and NEVER blocks the ones behind it", async () => {
    const server = makeServer();
    installFetch(server);

    // The poison event is appended FIRST, so it sits at the HEAD of the
    // queue — which is exactly the wedge #110 names.
    await append(ev({ id: "poison", specSnapshot: bigSnapshot }), CTX);
    await append(ev({ id: "after-1" }), CTX);
    await append(ev({ id: "after-2" }), CTX);

    const result = await pushOutbox({ now: CTX.now });

    // Quarantined, and reported as a DISTINCT fact.
    expect(result.quarantined.map((q) => q.id)).toEqual(["poison"]);

    // The events BEHIND it were delivered. This is the assertion that matters:
    // a poison event at the head must not stall the queue.
    const sentIds = server.posts.flat().map((e) => e.id);
    expect(sentIds).toContain("after-1");
    expect(sentIds).toContain("after-2");
    expect(sentIds).not.toContain("poison");

    // The poison row stays pending forever (it can never be sent), and the
    // others are synced.
    expect(await countPending()).toBe(1);
  });

  it("does not loop forever when EVERYTHING pending is quarantined", async () => {
    const server = makeServer();
    installFetch(server);
    await append(ev({ id: "p1", specSnapshot: bigSnapshot }), CTX);
    await append(ev({ id: "p2", specSnapshot: bigSnapshot }), CTX);

    const result = await pushOutbox({ now: CTX.now });
    expect(result.batches).toBe(0);
    expect(result.quarantined).toHaveLength(2);
    expect(server.posts).toHaveLength(0);
  });
});

describe("selectPending", () => {
  it("returns at most `limit` rows", async () => {
    await appendMany(10);
    const { rows } = await selectPending(4);
    expect(rows).toHaveLength(4);
  });

  it("returns rows in ascending deviceSeq order", async () => {
    await appendMany(6);
    const { rows } = await selectPending();
    const seqs = rows.map((r) => r.deviceSeq!);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  });

  it("does not return rows belonging to ANOTHER device", async () => {
    await appendMany(2);
    // A row that arrived by merge from another device is already synced and
    // is not this device's to push.
    const db = await openDb();
    await db.put("events", {
      ...ev({ id: "foreign", deviceId: "other-device", deviceSeq: 1 }),
      syncedAt: CTX.now,
    });
    const { rows } = await selectPending();
    expect(rows.map((r) => r.id)).not.toContain("foreign");
  });
});

describe("#103 — the outbox never blocks", () => {
  it("a totally failed flush still resolves, and never throws", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    await appendMany(2);
    const result = await pushOutbox({ now: CTX.now });
    expect(result.degraded).toBe("network");
    // The events are still there, still pending, still readable. A session
    // continues untouched.
    expect(await countPending()).toBe(2);
  });
});
