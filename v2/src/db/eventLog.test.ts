import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { append, count, getAll, _closeForTest } from "./eventLog.ts";
import type { DrillEvent } from "engine";

// Fresh IDB per test (fake-indexeddb lets us swap the whole factory).
beforeEach(async () => {
  await _closeForTest();
  globalThis.indexedDB = new IDBFactory();
});

function ev(i: number): DrillEvent {
  return { type: "tap", ts: 1000 + i, surah: 12, ayah: 4, rung: "S1", position: i, correct: true };
}

describe("eventLog durability (invariant #2)", () => {
  it("append resolves only AFTER the write is durably queryable", async () => {
    const before = await count();
    expect(before).toBe(0);
    await append(ev(1));
    // If append resolved before tx.done, this read could miss the record.
    // Because append awaits tx.done, it must be present the instant append resolves.
    const after = await count();
    expect(after).toBe(1);
  });

  it("assigns a monotonic append sequence", async () => {
    const s1 = await append(ev(1));
    const s2 = await append(ev(2));
    const s3 = await append(ev(3));
    expect(s2).toBeGreaterThan(s1);
    expect(s3).toBeGreaterThan(s2);
  });

  it("survives a simulated mid-drill crash with no loss and no dupes", async () => {
    const N = 12;
    for (let i = 1; i <= N; i++) await append(ev(i));

    // Simulate a process kill: drop the DB handle entirely.
    await _closeForTest();

    // Reopen from disk (a fresh connection to the same fake-indexeddb store).
    const survivors = await getAll();
    expect(survivors).toHaveLength(N); // no loss

    // Order preserved, seq strictly increasing, no duplicates.
    const seqs = survivors.map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(N); // no dupes
    // Payload order matches append order.
    expect(survivors.map((e) => e.position)).toEqual(
      Array.from({ length: N }, (_, i) => i + 1),
    );
  });

  it("a crash BETWEEN appends leaves exactly the committed prefix", async () => {
    await append(ev(1));
    await append(ev(2));
    // crash here — only 2 committed
    await _closeForTest();
    expect(await count()).toBe(2);
    // resume: further appends continue the sequence
    await append(ev(3));
    const all = await getAll();
    expect(all.map((e) => e.position)).toEqual([1, 2, 3]);
  });
});
