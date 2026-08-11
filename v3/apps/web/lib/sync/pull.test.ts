// The pull: cursored on the SERVER INGEST SEQUENCE, paginated, transactional,
// and reset on an identity change.
//
// THE SERVER IS STUBBED, AND SAID SO PLAINLY. The stub honours the real
// contract in `v3/api/app/Http/Controllers/EventsController.php::index`:
//
//   - `GET /api/events?since=&limit=` returns `{events, nextCursor, hasMore}`
//     (lines 128-132);
//   - the cursor is the SERVER AUTOINCREMENT `id` — `where('id', '>', $since)
//     ->orderBy('id')` — NEVER `ts`;
//   - `nextCursor` is `$rows->last()->id`, and `hasMore` is
//     `$rows->count() === $limit`.
//
// THE DECISIVE CASE, mirroring `EventsPullTest.php` on the client side: an
// event with an OLD `ts` ingested SECOND still arrives, because it gets a
// BRAND-NEW (larger) ingest id. This is the client-side twin of the mutation
// v3-D31 already ran server-side.
//
// NO ARABIC LITERALS. Events reference fixture COORDINATES only.

import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { DrillEvent } from "@engine/types.ts";
import { openDb, resetDbForTests } from "@/lib/idb/db";
import { getAllEvents } from "@/lib/idb/read";
import { writeLock } from "@/lib/idb/writeLock";
import { pullFromServer } from "./sync.ts";
import { readPullCursor } from "./cursor.ts";
import { resetApiFetchForTests } from "./apiFetch.ts";
import { resetTokenForTests, setIdentity, setToken } from "./token.ts";

const NOW = 1_700_000_000_000;

function ev(over: Partial<DrillEvent> & { id: string; ts: number }): DrillEvent {
  return { type: "rung_complete", surah: 12, ayah: 1, rung: "S1", deviceId: "srv", deviceSeq: 1, ...over };
}

/** One server-side row: the wire payload plus its INGEST id. */
interface ServerRow {
  ingestId: number;
  event: DrillEvent;
}

/** A stub honouring EventsController::index's cursor semantics. */
function installPullServer(rows: ServerRow[], pageLimit = 500) {
  const requests: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    const path = String(url);
    requests.push(path);
    if (path.includes("/api/auth/anonymous")) {
      return new Response(JSON.stringify({ token: "minted", isAnonymous: true }), { status: 201 });
    }
    const since = Number(new URL(path, "http://x").searchParams.get("since") ?? 0);
    // where('id','>',$since)->orderBy('id')->limit($limit)
    const page = rows
      .filter((r) => r.ingestId > since)
      .sort((a, b) => a.ingestId - b.ingestId)
      .slice(0, pageLimit);
    return new Response(
      JSON.stringify({
        events: page.map((r) => r.event),
        nextCursor: page.length > 0 ? page[page.length - 1]!.ingestId : since,
        hasMore: page.length === pageLimit,
      }),
      { status: 200 },
    );
  });
  return requests;
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  resetApiFetchForTests();
  resetTokenForTests();
  writeLock.forceForTests({ role: "writer" });
  setToken("tok-1", "tok-1");
  vi.unstubAllGlobals();
});

describe("the cursor is the SERVER INGEST SEQUENCE, never `ts`", () => {
  it("merges a LATE-ARRIVING event with an OLD ts but a HIGH ingest id", async () => {
    // Device B was offline three days. Its events carry THREE-DAY-OLD ts
    // values but are ingested LAST, so they get the LARGEST ingest ids.
    const fresh = ev({ id: "fresh", ts: 9_000, deviceId: "a", deviceSeq: 2 });
    const late = ev({ id: "late", ts: 1_000, deviceId: "b", deviceSeq: 1 });

    const server = [
      { ingestId: 1, event: fresh },
      { ingestId: 2, event: late }, // OLD ts, NEW ingest id
    ];
    installPullServer(server);

    const result = await pullFromServer({ now: NOW });
    expect(result.merged).toBe(2);

    // It landed, AND it landed in the correct CANONICAL position — ts 1000
    // sorts FIRST, not at the end and not skipped.
    const ids = (await getAllEvents()).map((r) => r.id);
    expect(ids).toEqual(["late", "fresh"]);
    // The cursor is the INGEST id, not the max ts (which would be 9000).
    expect(result.cursor).toBe(2);
  });

  it("a second pull past the cursor still picks up a later-ingested OLD-ts event", async () => {
    const rows: ServerRow[] = [{ ingestId: 1, event: ev({ id: "e1", ts: 5_000 }) }];
    installPullServer(rows);
    const first = await pullFromServer({ now: NOW });
    expect(first.cursor).toBe(1);

    // Now the offline device uploads: an OLD ts, a NEW ingest id. A client
    // holding a `ts` cursor at 5000 would ask since=5000 and be told
    // "nothing" — those days skipped FOREVER.
    rows.push({ ingestId: 2, event: ev({ id: "late", ts: 100, deviceId: "b" }) });

    const second = await pullFromServer({ now: NOW });
    expect(second.merged).toBe(1);
    expect((await getAllEvents()).map((r) => r.id)).toContain("late");
  });

  it("persists the cursor so the next pull does not re-request everything", async () => {
    const requests = installPullServer([
      { ingestId: 7, event: ev({ id: "e1", ts: 1 }) },
    ]);
    await pullFromServer({ now: NOW });
    expect(await readPullCursor("tok-1")).toBe(7);

    requests.length = 0;
    await pullFromServer({ now: NOW });
    // The second pull asks from 7, not from 0.
    expect(requests[0]).toContain("since=7");
  });
});

describe("pagination", () => {
  it("follows `hasMore` across pages", async () => {
    const rows: ServerRow[] = [];
    for (let i = 1; i <= 7; i++) {
      rows.push({ ingestId: i, event: ev({ id: `e${i}`, ts: i * 100, deviceSeq: i }) });
    }
    const requests = installPullServer(rows, 3); // 3 per page → 3 pages

    const result = await pullFromServer({ now: NOW });
    expect(result.pages).toBe(3);
    expect(result.merged).toBe(7);
    expect((await getAllEvents())).toHaveLength(7);

    const pulls = requests.filter((r) => r.includes("/api/events"));
    expect(pulls).toHaveLength(3);
    expect(pulls[0]).toContain("since=0");
    expect(pulls[1]).toContain("since=3");
    expect(pulls[2]).toContain("since=6");
  });

  it("does not loop forever when the server claims hasMore but sends nothing", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ events: [], nextCursor: 0, hasMore: true }), { status: 200 }),
    );
    const result = await pullFromServer({ now: NOW });
    expect(result.pages).toBe(1);
  });
});

describe("the cursor advance is TRANSACTIONAL with the event writes", () => {
  it("commits the cursor and the events together", async () => {
    installPullServer([{ ingestId: 42, event: ev({ id: "e1", ts: 1 }) }]);
    await pullFromServer({ now: NOW });

    const db = await openDb();
    const cursor = await db.get("meta", "pullCursor");
    expect(cursor?.value).toBe(42);
    expect(await db.count("events")).toBe(1);
  });

  it("a merge that ABORTS mid-page leaves the cursor UNADVANCED", async () => {
    // THE WINDOW THAT MATTERS, and the one a mere HTTP-failure test does not
    // reach: the response arrived, and the write is what fails. If the cursor
    // lived in its own transaction, it would already be committed while the
    // events were rolled back — the cursor claims to have consumed a page
    // that was never written, and those events are SKIPPED FOREVER.
    //
    // (This test exists because mutation M20 — moving the cursor advance into
    // a separate transaction — SURVIVED the original suite. See the mutation
    // report.)
    //
    // ONE SUPPRESSION, SCOPED TO THIS TEST AND EXPLAINED. Aborting an
    // IndexedDB transaction rejects every in-flight request, and `idb`
    // attaches its OWN listener to `tx.done` inside the library (build/
    // index.js:65) — a promise no caller can reach. Under fake-indexeddb that
    // rejection surfaces as an unhandled rejection which vitest attributes to
    // whichever test runs next, so it must be absorbed here rather than left
    // to poison an unrelated file. Verified by deletion: removing this single
    // test makes the suite's error count zero, so the suppression covers
    // exactly this abort and nothing else. It absorbs ONLY AbortError; any
    // other unhandled rejection still fails the run.
    const onUnhandled = (reason: unknown) => {
      const name = (reason as { name?: string } | null)?.name;
      if (name !== "AbortError") throw reason;
    };
    process.on("unhandledRejection", onUnhandled);
    onTestFinished(() => {
      process.off("unhandledRejection", onUnhandled);
    });

    const db = await openDb();

    // The failure is injected AT THE STORE, which is where a real write
    // failure (quota, corruption, an aborted transaction) actually occurs.
    // The second `put` of the page throws, so the transaction aborts and
    // EVERYTHING in it rolls back — including the cursor, if and only if the
    // cursor is in the same transaction.
    const realTransaction = db.transaction.bind(db);
    let puts = 0;
    vi.spyOn(db, "transaction").mockImplementation(((...args: unknown[]) => {
      const tx = (realTransaction as (...a: unknown[]) => ReturnType<typeof realTransaction>)(...args);
      const names = args[0] as unknown;
      // Only the merge's own ["events","meta"] transaction is instrumented.
      if (!Array.isArray(names) || !names.includes("events")) return tx;
      const store = tx.objectStore("events" as never) as {
        put: (v: unknown) => unknown;
        get: (k: unknown) => unknown;
      };
      // `idb` rejects EVERY in-flight request when the transaction aborts,
      // not merely `tx.done`. Production awaits each request in turn, so on
      // the real path each rejection has a handler; but the failure injected
      // here unwinds the loop while sibling requests from the same tick are
      // still settling, and those land as handler-less rejections that vitest
      // attributes to whatever test runs next. Wrapping BOTH accessors keeps
      // the assertions honest (the calls really happen, the values really
      // come back) while ensuring no rejected promise is ever left bare.
      const guard = (p: unknown) =>
        p && typeof (p as Promise<unknown>).then === "function"
          ? (p as Promise<unknown>).catch(() => undefined)
          : p;

      const realPut = store.put.bind(store);
      store.put = (value: unknown) => {
        puts += 1;
        if (puts === 2) throw new Error("simulated write failure mid-page");
        return guard(realPut(value));
      };
      const realGet = store.get.bind(store);
      store.get = (key: unknown) => guard(realGet(key));
      return tx;
    }) as never);

    installPullServer([
      { ingestId: 11, event: ev({ id: "ok", ts: 1 }) },
      { ingestId: 12, event: ev({ id: "second", ts: 2, deviceSeq: 2 }) },
    ]);

    const result = await pullFromServer({ now: NOW });
    // The pull did not succeed…
    expect(result.merged).toBe(0);
    // …and CRUCIALLY the cursor did not move. Both stores rolled back
    // together, because they were one transaction.
    expect(await readPullCursor("tok-1")).toBe(0);
    expect(await db.count("events")).toBe(0);
  });

  it("STRUCTURAL: the cursor is written by the merge's OWN transaction, not a second one", async () => {
    // AN HONEST GAP, STATED RATHER THAN HIDDEN.
    //
    // Mutation M20a — moving the cursor advance into its own transaction that
    // runs AFTER the event loop — SURVIVES every behavioural test above, and
    // it survives for a real reason: the two orderings differ only in a CRASH
    // WINDOW between two commits, and no in-process harness can kill the
    // process between them. fake-indexeddb cannot simulate a power loss.
    // (M20b, advancing the cursor BEFORE the loop, IS caught behaviourally —
    // it is the strictly worse variant, and it is the one that loses data
    // aggressively rather than only under a crash.)
    //
    // So the property is pinned STRUCTURALLY instead: exactly one readwrite
    // transaction is opened per merged page, and it spans BOTH stores. A
    // second transaction appearing here is the mutation, and this assertion
    // sees it. This is weaker than a behavioural proof and is labelled as
    // such — it is a guard against the refactor, not a proof of crash safety.
    const db = await openDb();
    const opened: { names: unknown; mode: unknown }[] = [];
    const realTransaction = db.transaction.bind(db);
    vi.spyOn(db, "transaction").mockImplementation(((...args: unknown[]) => {
      opened.push({ names: args[0], mode: args[1] });
      return (realTransaction as (...a: unknown[]) => ReturnType<typeof realTransaction>)(...args);
    }) as never);

    installPullServer([{ ingestId: 4, event: ev({ id: "e1", ts: 1 }) }]);
    await pullFromServer({ now: NOW });

    const writeTx = opened.filter(
      (t) => t.mode === "readwrite" && Array.isArray(t.names) && t.names.includes("events"),
    );
    expect(writeTx).toHaveLength(1);
    // …and it covers meta too, so the cursor rides in it.
    expect(writeTx[0]!.names).toEqual(["events", "meta"]);

    // No meta-only READWRITE transaction: that would be the separate cursor
    // write. (A meta-only READ is fine and expected — `readPullCursor` does
    // exactly that before the first page.)
    const metaOnlyWrites = opened.filter(
      (t) =>
        t.mode === "readwrite" &&
        (t.names === "meta" || (Array.isArray(t.names) && t.names.length === 1 && t.names[0] === "meta")),
    );
    expect(metaOnlyWrites).toHaveLength(0);
  });

  it("a failed page advances NOTHING — every server event is still pullable", async () => {
    // The page write fails (the merge throws). Neither the events nor the
    // cursor may be committed, or the events are lost while the cursor
    // claims to have consumed them.
    const rows: ServerRow[] = [{ ingestId: 5, event: ev({ id: "e1", ts: 1 }) }];
    let calls = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      calls += 1;
      if (calls === 1) return new Response("{}", { status: 500 });
      const since = Number(new URL(String(url), "http://x").searchParams.get("since") ?? 0);
      const page = rows.filter((r) => r.ingestId > since);
      return new Response(
        JSON.stringify({
          events: page.map((r) => r.event),
          nextCursor: page.length ? page[page.length - 1]!.ingestId : since,
          hasMore: false,
        }),
        { status: 200 },
      );
    });

    const failed = await pullFromServer({ now: NOW });
    expect(failed.degraded).toBe("server");
    expect(await readPullCursor("tok-1")).toBe(0);

    // The retry gets everything.
    const ok = await pullFromServer({ now: NOW });
    expect(ok.merged).toBe(1);
    expect(await readPullCursor("tok-1")).toBe(5);
  });
});

describe("the cursor is scoped to an IDENTITY", () => {
  it("returns 0 for a DIFFERENT identity — a new account's history is never skipped", async () => {
    installPullServer([{ ingestId: 9, event: ev({ id: "e1", ts: 1 }) }]);
    await pullFromServer({ now: NOW });
    expect(await readPullCursor("tok-1")).toBe(9);

    // A re-mint (or a login to a different account) changes the identity. The
    // new user's ingest sequence starts at 0, so a carried-over cursor of 9
    // would skip their entire history — the one genuinely unrecoverable state
    // in the pull path. When in doubt, RESET.
    expect(await readPullCursor("tok-2")).toBe(0);
  });

  it("re-pulls from 0 under a new identity", async () => {
    const rows = [{ ingestId: 3, event: ev({ id: "e1", ts: 1 }) }];
    const requests = installPullServer(rows);
    await pullFromServer({ now: NOW });
    expect(await readPullCursor("tok-1")).toBe(3);

    // Switch identity.
    setToken("tok-2", "tok-2");
    setIdentity("tok-2");
    requests.length = 0;
    await pullFromServer({ now: NOW });
    expect(requests[0]).toContain("since=0");
  });
});

describe("#50 divergences and #111 flags surface from the pull", () => {
  it("reports a divergence without wedging the page", async () => {
    const db = await openDb();
    const local = ev({ id: "dup", ts: 100, ayah: 3 });
    await db.put("events", { ...local, syncedAt: null });

    installPullServer([
      { ingestId: 1, event: { ...local, ayah: 99 } },
      { ingestId: 2, event: ev({ id: "other", ts: 200, deviceSeq: 2 }) },
    ]);

    const result = await pullFromServer({ now: NOW });
    expect(result.divergences).toHaveLength(1);
    expect(result.divergences[0]!.id).toBe("dup");
    // The rest of the page still merged.
    expect((await getAllEvents()).map((r) => r.id)).toContain("other");
    // The local row is untouched.
    const kept = await db.get("events", "dup");
    expect(kept!.ayah).toBe(3);
  });

  it("reports a far-future ts", async () => {
    installPullServer([
      { ingestId: 1, event: ev({ id: "future", ts: NOW + 5 * 365 * 24 * 3600 * 1000 }) },
    ]);
    const result = await pullFromServer({ now: NOW });
    expect(result.futureTs).toEqual(["future"]);
  });
});
