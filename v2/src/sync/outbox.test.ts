import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { append, getUnsynced, _closeForTest } from "../db/eventLog.ts";
import { flush, hydrate } from "./outbox.ts";
import { makeEvent } from "engine";

beforeEach(async () => {
  await _closeForTest();
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
  vi.restoreAllMocks();
});

function ev(ayah = 4) {
  return makeEvent({ type: "reconstruct_tap", ts: 1000, surah: 12, ayah, rung: "RC" });
}

describe("outbox.flush (v2-D18/ROADMAP Phase 5)", () => {
  it("no-op with no local device token yet", async () => {
    await append(ev());
    expect(await flush()).toBe(0);
    expect(await getUnsynced()).toHaveLength(1); // untouched
  });

  it("POSTs unsynced events with the bearer token and marks them synced on 2xx", async () => {
    localStorage.setItem("iman-auth-token", "tok-123");
    await append(ev());
    await append(ev(5));
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ accepted: 2, ignored: 0 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const n = await flush();
    expect(n).toBe(2);
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
    expect(await getUnsynced()).toHaveLength(0); // all marked synced
  });

  it("leaves events unsynced on a non-2xx (retry later)", async () => {
    localStorage.setItem("iman-auth-token", "tok");
    await append(ev());
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    expect(await flush()).toBe(0);
    expect(await getUnsynced()).toHaveLength(1);
  });

  it("leaves events unsynced when offline (fetch throws) — created-offline-syncs-on-reconnect", async () => {
    localStorage.setItem("iman-auth-token", "tok");
    await append(ev());
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await flush()).toBe(0);
    expect(await getUnsynced()).toHaveLength(1);

    // Reconnect: the exact same outbox call now succeeds and is not duplicated
    // client-side (still just the one row, now synced).
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ accepted: 1, ignored: 0 }), { status: 200 })),
    );
    expect(await flush()).toBe(1);
    expect(await getUnsynced()).toHaveLength(0);
  });

  it("re-flush after a synced batch sends nothing (idempotent client-side)", async () => {
    localStorage.setItem("iman-auth-token", "tok");
    await append(ev());
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ accepted: 1, ignored: 0 }), { status: 200 })));
    await flush();
    const fetchMock2 = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock2);
    await flush();
    expect(fetchMock2).not.toHaveBeenCalled(); // nothing unsynced
  });
});

describe("outbox.hydrate — second-device restore", () => {
  it("no-op with no local device token yet", async () => {
    expect(await hydrate()).toBe(0);
  });

  it("merges server events into the local log, idempotent by id", async () => {
    localStorage.setItem("iman-auth-token", "device-2-tok");
    const serverEvents = [
      { id: "e1", type: "reconstruct_tap", ts: 1000, surah: 12, ayah: 4, rung: "RC" },
      { id: "e2", type: "ayah_produced", ts: 1001, surah: 12, ayah: 4, rung: "S3" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ events: serverEvents }), { status: 200 })),
    );

    const added = await hydrate();
    expect(added).toBe(2);

    // A second hydrate (e.g. app regains focus again) adds nothing new.
    const addedAgain = await hydrate();
    expect(addedAgain).toBe(0);
  });
});
