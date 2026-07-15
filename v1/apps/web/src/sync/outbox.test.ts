import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { append, getUnsynced, markSynced, _closeForTest } from "../db/eventLog.ts";
import { flush } from "./outbox.ts";
import { makeEvent } from "engine";

beforeEach(async () => {
  await _closeForTest();
  globalThis.indexedDB = new IDBFactory();
  vi.restoreAllMocks();
});

function ev(ayah = 4) {
  return makeEvent({ type: "rung_complete", ts: 1000, surah: 12, ayah, rung: "S3" });
}

describe("eventLog sync bookkeeping", () => {
  it("appended events start unsynced and carry a stable id", async () => {
    await append(ev());
    await append(ev(5));
    const un = await getUnsynced();
    expect(un).toHaveLength(2);
    expect(un.every((e) => typeof e.id === "string" && e.id.length > 0)).toBe(true);
    expect(un.every((e) => e.synced === 0)).toBe(true);
  });

  it("markSynced flips only the named ids", async () => {
    await append(ev());
    await append(ev(5));
    const [a, b] = await getUnsynced();
    await markSynced([a!.id]);
    const remaining = await getUnsynced();
    expect(remaining.map((e) => e.id)).toEqual([b!.id]);
  });
});

describe("outbox.flush", () => {
  it("no-op when signed out", async () => {
    await append(ev());
    expect(await flush(false)).toBe(0);
    expect(await getUnsynced()).toHaveLength(1); // untouched
  });

  it("POSTs unsynced events and marks them synced on 2xx", async () => {
    await append(ev());
    await append(ev(5));
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ accepted: 2, ignored: 0 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const n = await flush(true);
    expect(n).toBe(2);
    expect(fetchMock).toHaveBeenCalledOnce();
    // request used credentials:include (cookie-based identity)
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.credentials).toBe("include");
    expect(await getUnsynced()).toHaveLength(0); // all marked synced
  });

  it("leaves events unsynced on a non-2xx (retry later)", async () => {
    await append(ev());
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    expect(await flush(true)).toBe(0);
    expect(await getUnsynced()).toHaveLength(1);
  });

  it("leaves events unsynced when offline (fetch throws)", async () => {
    await append(ev());
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    expect(await flush(true)).toBe(0);
    expect(await getUnsynced()).toHaveLength(1);
  });

  it("re-flush after a synced batch sends nothing (idempotent client-side)", async () => {
    await append(ev());
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ accepted: 1, ignored: 0 }), { status: 200 })));
    await flush(true);
    const fetchMock2 = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock2);
    await flush(true);
    expect(fetchMock2).not.toHaveBeenCalled(); // nothing unsynced
  });
});
