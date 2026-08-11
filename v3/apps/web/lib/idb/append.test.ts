// NO ARABIC LITERALS. Events reference fixture COORDINATES (surah/ayah/
// position) only — never Quranic text. `choice` is a coordinate-shaped stub.

import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { DrillEvent } from "@engine/types.ts";
import { append, currentTz, getDeviceId, retryAppend, RetryableAppendError } from "./append.ts";
import { openDb, resetDbForTests } from "./db.ts";
import {
  countEvents,
  currentDeviceSeq,
  getAllEvents,
  getEventsForSurah,
  iterateEvents,
  nextVisitOrdinalForSite,
} from "./read.ts";
import { writeLock } from "./writeLock.ts";
import { compareCanonical, toWire } from "./schema.ts";

const CTX = { now: 1_700_000_000_000, tz: "UTC" };

/** A minimal valid event at fixture coordinates. */
function ev(over: Partial<DrillEvent> = {}): DrillEvent {
  return {
    type: "tap",
    ts: CTX.now,
    surah: 112,
    ayah: 1,
    rung: "S1",
    ...over,
  };
}

beforeEach(async () => {
  // A brand-new IndexedDB per test: shared state between tests is how an
  // ordering suite accidentally passes.
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  writeLock.forceForTests({ role: "writer" });
});

describe("append → read back", () => {
  it("commits and reads the event back", async () => {
    const { event, inserted } = await append(ev({ position: 1 }), CTX);
    expect(inserted).toBe(true);

    const all = await getAllEvents();
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(event.id);
    expect(all[0]!.surah).toBe(112);
    expect(all[0]!.position).toBe(1);
  });

  it("stamps id, deviceId, tz and deviceSeq", async () => {
    const { event } = await append(ev(), CTX);
    expect(event.id).toBeTypeOf("string");
    expect(event.deviceId).toBeTypeOf("string");
    expect(event.tz).toBe("UTC");
    expect(event.deviceSeq).toBe(1);
  });

  it("awaits tx.done — the row is durable the instant append resolves", async () => {
    // Read through a SEPARATE connection opened after append returned. If
    // append resolved before tx.done, this read could miss the row.
    await append(ev(), CTX);
    resetDbForTests();
    const db = await openDb();
    expect(await db.count("events")).toBe(1);
  });

  it("assigns a monotonic deviceSeq across appends", async () => {
    const a = await append(ev(), CTX);
    const b = await append(ev(), CTX);
    const c = await append(ev(), CTX);
    expect([a.event.deviceSeq, b.event.deviceSeq, c.event.deviceSeq]).toEqual([1, 2, 3]);
    expect(await currentDeviceSeq()).toBe(3);
  });

  it("never collides deviceSeq under concurrent appends", async () => {
    // The read-increment-write lives in ONE transaction, so 25 concurrent
    // appends must yield 25 DISTINCT sequence numbers. Two transactions would
    // interleave here and duplicate.
    const results = await Promise.all(
      Array.from({ length: 25 }, () => append(ev(), CTX)),
    );
    const seqs = results.map((r) => r.event.deviceSeq!).sort((x, y) => x - y);
    expect(new Set(seqs).size).toBe(25);
    expect(seqs).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(await countEvents()).toBe(25);
  });

  it("keeps one deviceId forever — regenerating forks the ordinal namespace", async () => {
    const first = await getDeviceId();
    resetDbForTests();
    const second = await getDeviceId();
    expect(second).toBe(first);
  });
});

describe("idempotent re-append", () => {
  it("re-appending the same id is a no-op, not a duplicate row", async () => {
    const { event } = await append(ev({ position: 3 }), CTX);
    const again = await append(toWire(event), CTX);

    expect(again.inserted).toBe(false);
    expect(again.event.id).toBe(event.id);
    expect(await countEvents()).toBe(1);
  });

  it("re-append does NOT burn a second sequence number", async () => {
    const { event } = await append(ev(), CTX);
    expect(await currentDeviceSeq()).toBe(1);

    await append(toWire(event), CTX);
    expect(await currentDeviceSeq()).toBe(1);

    // A genuinely new event still gets the next one, not a skipped one.
    const next = await append(ev(), CTX);
    expect(next.event.deviceSeq).toBe(2);
  });
});

describe("canonical order (v3-D09)", () => {
  it("iterates by (ts, deviceId, deviceSeq, id) including on ts ties", async () => {
    // All four share a ts, so the tie-breakers decide. This is the exact case
    // 'sort by ts alone' gets wrong — milliseconds tie.
    await append(ev({ ts: 200 }), CTX);
    await append(ev({ ts: 100 }), CTX);
    await append(ev({ ts: 100 }), CTX);
    await append(ev({ ts: 50 }), CTX);

    const rows = await getAllEvents();
    expect(rows.map((r) => r.ts)).toEqual([50, 100, 100, 200]);

    // And the ties themselves are ordered by deviceSeq, ascending.
    const tied = rows.filter((r) => r.ts === 100);
    expect(tied[0]!.deviceSeq!).toBeLessThan(tied[1]!.deviceSeq!);

    // The store's own order matches the comparator exactly.
    const resorted = [...rows].sort(compareCanonical);
    expect(resorted.map((r) => r.id)).toEqual(rows.map((r) => r.id));
  });

  it("compareCanonical breaks ts ties by deviceId, then deviceSeq, then id", () => {
    // Exercised DIRECTLY, not through getAllEvents — that reads the already
    // sorted by_ts index, so it would pass even if this comparator ignored the
    // tie-breakers entirely (and Array.sort's stability would hide it too).
    const row = (
      ts: number,
      deviceId: string,
      deviceSeq: number,
      id: string,
    ) => ({ type: "tap", surah: 112, ayah: 1, rung: "S1", ts, deviceId, deviceSeq, id }) as const;

    // Identical ts throughout: every ordering decision here rests on a
    // tie-breaker, which is the case `sort by ts alone` gets wrong.
    const shuffled = [
      row(100, "dev-b", 1, "id-a"),
      row(100, "dev-a", 2, "id-b"),
      row(100, "dev-a", 1, "id-z"),
      row(100, "dev-a", 1, "id-c"),
    ];
    const ordered = [...shuffled].sort(compareCanonical);
    expect(ordered.map((r) => [r.deviceId, r.deviceSeq, r.id])).toEqual([
      ["dev-a", 1, "id-c"],
      ["dev-a", 1, "id-z"],
      ["dev-a", 2, "id-b"],
      ["dev-b", 1, "id-a"],
    ]);

    // ARRIVAL-ORDER INVARIANT (v3-D09): any permutation of the same set
    // canonical-orders to the identical sequence.
    const reversed = [...shuffled].reverse().sort(compareCanonical);
    expect(reversed.map((r) => r.id)).toEqual(ordered.map((r) => r.id));
  });

  it("the cursor yields the same order as getAllEvents", async () => {
    for (const ts of [300, 100, 200]) await append(ev({ ts }), CTX);
    const viaCursor: number[] = [];
    for await (const row of iterateEvents()) viaCursor.push(row.ts);
    expect(viaCursor).toEqual([100, 200, 300]);
  });

  it("never drops an event whose index members are absent", async () => {
    await append(ev({ ts: 10 }), CTX);
    // Write a legacy-shaped row directly, with no deviceId/deviceSeq — such a
    // row is NOT in the compound index at all. getAllEvents must still see it.
    const db = await openDb();
    await db.put("events", { id: "legacy-1", type: "tap", ts: 5, surah: 112, ayah: 1, rung: "S1" });

    const rows = await getAllEvents();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toContain("legacy-1");
    expect(rows[0]!.id).toBe("legacy-1"); // ts 5 sorts first
  });
});

describe("indexes", () => {
  it("by_surah scopes reads per surah (E-01)", async () => {
    await append(ev({ surah: 112, ayah: 1 }), CTX);
    await append(ev({ surah: 103, ayah: 2 }), CTX);
    await append(ev({ surah: 112, ayah: 3 }), CTX);

    const rows = await getEventsForSurah(112);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.surah === 112)).toBe(true);
  });

  it("by_siteKey backs nextVisitOrdinal = max(recorded) + 1", async () => {
    const siteKey = "112:ayah:1";
    expect(await nextVisitOrdinalForSite(siteKey)).toBe(1);

    await append(ev({ siteKey, visitOrdinal: 1 }), CTX);
    await append(ev({ siteKey, visitOrdinal: 2 }), CTX);
    // A different site must not contribute.
    await append(ev({ siteKey: "112:seam:1", visitOrdinal: 9 }), CTX);

    expect(await nextVisitOrdinalForSite(siteKey)).toBe(3);
    expect(await nextVisitOrdinalForSite("112:seam:1")).toBe(10);
  });

  it("is immune to re-seeing an ordinal out of order (set-monotone)", async () => {
    const siteKey = "112:ayah:7";
    await append(ev({ siteKey, visitOrdinal: 3 }), CTX);
    await append(ev({ siteKey, visitOrdinal: 1 }), CTX);
    expect(await nextVisitOrdinalForSite(siteKey)).toBe(4);
  });
});

describe("the wire stays frozen", () => {
  it("toWire strips the local-only syncedAt field", async () => {
    const { event } = await append(ev(), CTX);
    expect(event).toHaveProperty("syncedAt");
    expect(toWire(event)).not.toHaveProperty("syncedAt");
  });
});

describe("QuotaExceeded is retryable, never swallowed (edge case #74)", () => {
  /** Make the next `events.put` fail with a real QuotaExceededError. */
  function breakNextPut(): () => void {
    const proto = IDBObjectStore.prototype;
    const original = proto.put;
    let fired = false;
    proto.put = function patched(this: IDBObjectStore, ...args: unknown[]) {
      if (!fired && this.name === "events") {
        fired = true;
        throw new DOMException("simulated disk full", "QuotaExceededError");
      }
      return (original as (...a: unknown[]) => IDBRequest).apply(this, args);
    } as typeof proto.put;
    return () => {
      proto.put = original;
    };
  }

  it("surfaces a retryable error and commits NOTHING", async () => {
    const restore = breakNextPut();
    let failure: RetryableAppendError | null = null;
    try {
      await append(ev({ position: 2 }), CTX);
    } catch (err) {
      failure = err as RetryableAppendError;
    } finally {
      restore();
    }

    expect(failure).toBeInstanceOf(RetryableAppendError);
    expect(failure!.reason).toBe("quota-exceeded");
    expect(failure!.retryable).toBe(true);
    // Commit-before-paint: the tap was NOT saved, so the UI must not advance.
    expect(await countEvents()).toBe(0);
  });

  it("retry reuses the SAME id and deviceSeq — no double-count", async () => {
    const restore = breakNextPut();
    let failure: RetryableAppendError | null = null;
    try {
      await append(ev(), CTX);
    } catch (err) {
      failure = err as RetryableAppendError;
    } finally {
      restore();
    }

    const stampedId = failure!.event.id;
    const stampedSeq = failure!.event.deviceSeq;
    expect(stampedId).toBeTypeOf("string");

    const retried = await retryAppend(failure!, CTX);
    expect(retried.event.id).toBe(stampedId);
    expect(retried.event.deviceSeq).toBe(stampedSeq);
    expect(await countEvents()).toBe(1);

    // The counter was not advanced twice by the failure + retry pair.
    const next = await append(ev(), CTX);
    expect(next.event.deviceSeq).toBe(stampedSeq! + 1);
  });
});

describe("currentTz", () => {
  it("returns an IANA-shaped string the frontend passes INTO the engine", () => {
    expect(currentTz()).toBeTypeOf("string");
    expect(currentTz().length).toBeGreaterThan(0);
  });
});
