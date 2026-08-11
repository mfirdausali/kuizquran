import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { append } from "./append.ts";
import { openDb, resetDbForTests } from "./db.ts";
import { countEvents } from "./read.ts";
import { assertWriter, NotWriterError, writeLock } from "./writeLock.ts";

const CTX = { now: 1_700_000_000_000, tz: "UTC" };
const EV = { type: "tap", ts: CTX.now, surah: 112, ayah: 1, rung: "S1" } as const;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
});

describe("single-writer (edge case #75)", () => {
  it("a non-writer tab CANNOT append", async () => {
    writeLock.forceForTests({ role: "reader", reason: "another-tab" });
    await expect(append({ ...EV }, CTX)).rejects.toBeInstanceOf(NotWriterError);
    // Nothing was written: a second deviceSeq stream from one deviceId would
    // fork the per-device ordinal namespace, which is B5 reborn on one device.
    expect(await countEvents()).toBe(0);
  });

  it("a tab still acquiring the lock cannot append either", async () => {
    writeLock.forceForTests({ role: "pending" });
    await expect(append({ ...EV }, CTX)).rejects.toBeInstanceOf(NotWriterError);
    expect(await countEvents()).toBe(0);
  });

  it("the writer tab can append", async () => {
    writeLock.forceForTests({ role: "writer" });
    await expect(append({ ...EV }, CTX)).resolves.toMatchObject({ inserted: true });
    expect(await countEvents()).toBe(1);
  });

  it("a lock lost between render and commit fails the commit loudly", async () => {
    writeLock.forceForTests({ role: "writer" });
    await append({ ...EV }, CTX);
    // Takeover by another tab happens here.
    writeLock.forceForTests({ role: "reader", reason: "another-tab" });
    await expect(append({ ...EV }, CTX)).rejects.toBeInstanceOf(NotWriterError);
    expect(await countEvents()).toBe(1);
  });

  it("NotWriterError is retryable — the tap is held, not dropped", () => {
    writeLock.forceForTests({ role: "reader", reason: "another-tab" });
    try {
      assertWriter();
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NotWriterError);
      expect((err as NotWriterError).retryable).toBe(true);
    }
  });

  it("subscribers observe status transitions", () => {
    const seen: string[] = [];
    const unsubscribe = writeLock.subscribe((s) => seen.push(s.role));
    writeLock.forceForTests({ role: "writer" });
    writeLock.forceForTests({ role: "reader", reason: "another-tab" });
    unsubscribe();
    writeLock.forceForTests({ role: "writer" });
    // The initial value plus two transitions; nothing after unsubscribe.
    expect(seen).toEqual([seen[0], "writer", "reader"]);
  });
});

describe("graceful degradation where navigator.locks is absent", () => {
  // Node has no navigator.locks — which is exactly the old-Safari / WebView
  // case the heartbeat fallback exists for, so this environment tests the
  // real degraded path rather than a simulation of it.
  it("this environment genuinely lacks navigator.locks", () => {
    expect(typeof navigator?.locks?.request).not.toBe("function");
  });

  it("falls back to the meta heartbeat, elects a writer, and can append", async () => {
    // resetForTests is required: the earlier forceForTests calls leave the
    // lock `started`, and acquire() would return early without ever taking
    // the fallback path — the test would then pass while testing nothing.
    writeLock.resetForTests();

    const status = await writeLock.acquire();
    expect(status.role).toBe("writer");
    expect(writeLock.usingFallback).toBe(true);
    await expect(append({ ...EV }, CTX)).resolves.toMatchObject({ inserted: true });

    await writeLock.release();
    expect(writeLock.isWriter).toBe(false);
  });

  it("defers to a live heartbeat from another tab", async () => {
    // Simulate another tab holding the writer row with a FRESH heartbeat.
    writeLock.resetForTests();
    const db = await openDb();
    await db.put("meta", { key: "writerId", value: "some-other-tab" });
    await db.put("meta", { key: "writerHeartbeatAt", value: Date.now() });

    const status = await writeLock.acquire();
    expect(status.role).toBe("reader");
    await expect(append({ ...EV }, CTX)).rejects.toBeInstanceOf(NotWriterError);
  });

  it("takes over from a STALE heartbeat (the other tab died)", async () => {
    writeLock.resetForTests();
    const db = await openDb();
    await db.put("meta", { key: "writerId", value: "dead-tab" });
    // Older than the 6s staleness threshold.
    await db.put("meta", { key: "writerHeartbeatAt", value: Date.now() - 60_000 });

    const status = await writeLock.acquire();
    expect(status.role).toBe("writer");
    await writeLock.release();
  });
});

describe("acquire() against a real Web Locks implementation (v3-D70)", () => {
  // WHY THESE TESTS EXIST.
  //
  // Every other test in this file uses `forceForTests`, which sets the status
  // directly and never runs `acquire()`. That gap hid a defect that made
  // writing STRUCTURALLY IMPOSSIBLE: the fallback branch was a
  // `queueMicrotask`, and `navigator.locks.request` grants in a LATER TASK, so
  // the fallback always won. Every tab settled as `reader`, `isWriter` was
  // never true, and `assertWriter()` threw on every append — a single tab with
  // no contention was told "the session is open in another tab".
  //
  // It went unnoticed for eight build-plan steps because nothing in the app
  // called `acquire()` or `append()` at all (v3-D67), so a permanently-reader
  // lock had no observable consequence. It surfaced in a real browser the day
  // the session loop landed.
  //
  // These drive the REAL code path against a Web Locks stub that grants in a
  // later task, exactly as a browser does.
  function installLocks(opts: { heldByOther?: boolean } = {}) {
    const held = opts.heldByOther === true;
    // jsdom defines `navigator` as a getter-only property, so a plain
    // assignment throws. Redefine it for the duration of the test.
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: {
      locks: {
        request(_name: string, _o: unknown, cb: () => Promise<void>) {
          if (held) {
            // Contended: the callback never runs, mirroring a browser holding
            // the lock for another tab. The grace timer must resolve this.
            return new Promise<void>(() => {});
          }
          // Uncontended: granted in a LATER TASK, never synchronously and
          // never within the current microtask checkpoint.
          return new Promise<void>((resolve) => {
            setTimeout(() => void cb().then(resolve), 0);
          });
        },
      },
      },
    });
  }

  beforeEach(() => {
    writeLock.resetForTests?.();
  });

  it("a single uncontended tab becomes the WRITER", async () => {
    // MUTATION: change the grace `setTimeout` back to `queueMicrotask` and this
    // fails — which is precisely the defect that shipped.
    installLocks();
    const status = await writeLock.acquire();
    expect(status.role).toBe("writer");
    expect(writeLock.isWriter).toBe(true);
  });

  it("a writer that acquired the lock can actually append", async () => {
    // The end-to-end consequence, asserted rather than inferred: the whole
    // point of holding the lock is that the commit path opens.
    installLocks();
    await writeLock.acquire();
    await append({ ...EV }, CTX);
    expect(await countEvents()).toBe(1);
  });

  it("a tab that cannot get the lock settles as reader instead of hanging", async () => {
    // The original intent of the fallback, preserved: contention must not block
    // the UI forever. This is why the fix is a short timer and not its removal.
    installLocks({ heldByOther: true });
    const status = await writeLock.acquire();
    expect(status.role).toBe("reader");
  });
});
