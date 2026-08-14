// THE ENTITLEMENT SNAPSHOT — fetch + offline-durable cache.
//
// What this file protects:
//   1. FAILURE IS A STATE, NEVER AN EXCEPTION — network errors, non-200s,
//      malformed JSON and out-of-set field values all degrade to `null`,
//      never a thrown error. A background refresh that can crash a caller
//      violates #103's "never blocks a session" rule by a different route.
//   2. A FAILED REFRESH LEAVES THE PRIOR CACHE UNTOUCHED — `writeEntitlement
//      Snapshot` must never run on a failed fetch, or a transient network
//      blip could erase a valid grant and lock a paying learner out.
//   3. THE PERSISTED ROW IS READ BACK VERBATIM, keyed under the module's own
//      constant — the shape `lib/session/run.ts` will read at session start.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { openDb, resetDbForTests } from "@/lib/idb/db.ts";
import {
  ENTITLEMENT_SNAPSHOT_KEY,
  fetchEntitlementSnapshot,
  readEntitlementSnapshot,
  refreshEntitlementSnapshot,
} from "./sync.ts";

const NOW = 1_700_000_000_000;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  vi.stubGlobal("fetch", vi.fn());
});

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchEntitlementSnapshot", () => {
  it("builds a snapshot from a well-formed 200, stamped with the caller's now", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(200, { state: "active", tier: "lifetime", region: "MY", trialSurah: 67 }),
    );

    const snapshot = await fetchEntitlementSnapshot(NOW);

    expect(snapshot).toEqual({
      state: "active",
      tier: "lifetime",
      region: "MY",
      trialSurah: 67,
      cachedAt: NOW,
    });
  });

  it("a null trialSurah round-trips as null, not undefined or 0", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(200, { state: "trial", tier: "none", region: "INTL", trialSurah: null }),
    );

    const snapshot = await fetchEntitlementSnapshot(NOW);

    expect(snapshot?.trialSurah).toBeNull();
  });

  it("a network failure degrades to null, never throws", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("network down"));

    await expect(fetchEntitlementSnapshot(NOW)).resolves.toBeNull();
  });

  it("a non-200 response degrades to null", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respond(401, { error: "unauthenticated" }));

    await expect(fetchEntitlementSnapshot(NOW)).resolves.toBeNull();
  });

  it("a body that is not JSON degrades to null", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("not json", { status: 200 }));

    await expect(fetchEntitlementSnapshot(NOW)).resolves.toBeNull();
  });

  it("an out-of-set state value degrades to null — never trusts an unknown state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(200, { state: "premium", tier: "none", region: "INTL", trialSurah: null }),
    );

    await expect(fetchEntitlementSnapshot(NOW)).resolves.toBeNull();
  });

  it("an out-of-set region value degrades to null", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(200, { state: "trial", tier: "none", region: "SG", trialSurah: null }),
    );

    await expect(fetchEntitlementSnapshot(NOW)).resolves.toBeNull();
  });
});

describe("readEntitlementSnapshot / refreshEntitlementSnapshot", () => {
  it("reads null on a device that has never fetched", async () => {
    await expect(readEntitlementSnapshot()).resolves.toBeNull();
  });

  it("a successful refresh persists the snapshot, readable back verbatim", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(200, { state: "grace", tier: "monthly", region: "MY", trialSurah: 12 }),
    );

    const written = await refreshEntitlementSnapshot(NOW);
    const read = await readEntitlementSnapshot();

    expect(written).toEqual(read);
    expect(read).toEqual({
      state: "grace",
      tier: "monthly",
      region: "MY",
      trialSurah: 12,
      cachedAt: NOW,
    });
  });

  it("a failed refresh leaves a prior good cache untouched", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(200, { state: "active", tier: "lifetime", region: "MY", trialSurah: null }),
    );
    await refreshEntitlementSnapshot(NOW);

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("network down"));
    const result = await refreshEntitlementSnapshot(NOW + 1_000);

    expect(result).toBeNull();
    await expect(readEntitlementSnapshot()).resolves.toMatchObject({ state: "active" });
  });

  it("is stored under the module's own meta key, not a second spelling", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      respond(200, { state: "trial", tier: "none", region: "INTL", trialSurah: null }),
    );
    await refreshEntitlementSnapshot(NOW);

    const db = await openDb();
    const row = await db.get("meta", ENTITLEMENT_SNAPSHOT_KEY);
    expect(row?.value).toMatchObject({ state: "trial" });
  });
});
