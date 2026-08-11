import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { append } from "./append.ts";
import { resetDbForTests } from "./db.ts";
import { loadLogState, loadSurahLogState } from "./read.ts";
import {
  classifyIdbError,
  IdbTimeoutError,
  READ_TIMEOUT_MS,
  readIntoState,
  withTimeout,
  type LogState,
} from "./state.ts";
import { writeLock } from "./writeLock.ts";

const CTX = { now: 1_700_000_000_000, tz: "UTC" };

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  writeLock.forceForTests({ role: "writer" });
});

describe("the three states are genuinely distinct (edge case #73)", () => {
  it("a clean open on an EMPTY store yields `empty`, not `ready: []`", async () => {
    const state = await loadLogState();
    expect(state.status).toBe("empty");
    // The distinction that matters: `ready` with an empty array invites
    // `data.length && ...`, which renders identically to pending and puts a
    // new learner back under an eternal skeleton.
    expect(state).not.toHaveProperty("data");
  });

  it("a populated store yields `ready` with the rows", async () => {
    await append(
      { type: "tap", ts: CTX.now, surah: 112, ayah: 1, rung: "S1" },
      CTX,
    );
    const state = await loadLogState();
    expect(state.status).toBe("ready");
    if (state.status !== "ready") throw new Error("unreachable");
    expect(state.data).toHaveLength(1);
  });

  it("a surah with no events is `empty` even when the log is non-empty", async () => {
    await append({ type: "tap", ts: CTX.now, surah: 112, ayah: 1, rung: "S1" }, CTX);
    expect((await loadSurahLogState(103)).status).toBe("empty");
    expect((await loadSurahLogState(112)).status).toBe("ready");
  });

  it("exhaustive switching is enforced by the type system", () => {
    // If a status is ever added to the union without a case here, this
    // function stops compiling — which is the whole reason LogState is a
    // discriminated union rather than three booleans.
    function render(s: LogState<number[]>): string {
      switch (s.status) {
        case "pending":
          return "skeleton";
        case "empty":
          return "zero-state";
        case "ready":
          return `rows:${s.data.length}`;
        case "broken":
          return `broken:${s.reason}`;
        default: {
          const never: never = s;
          return never;
        }
      }
    }
    expect(render({ status: "pending" })).toBe("skeleton");
    expect(render({ status: "empty" })).toBe("zero-state");
    expect(render({ status: "ready", data: [1, 2] })).toBe("rows:2");
    expect(render({ status: "broken", reason: "read-timeout" })).toBe("broken:read-timeout");
  });
});

describe("the wedge timeout — `pending` must be unreachable permanently", () => {
  it("a read that never settles becomes broken:read-timeout", async () => {
    vi.useFakeTimers();
    try {
      const hang = new Promise<number[]>(() => {
        /* never settles — a wedged IndexedDB */
      });
      const state = readIntoState(() => hang, (r) => r.length === 0, "hang");
      await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS + 1);
      expect((await state).status).toBe("broken");
      const settled = await state;
      if (settled.status !== "broken") throw new Error("unreachable");
      expect(settled.reason).toBe("read-timeout");
    } finally {
      vi.useRealTimers();
    }
  });

  it("withTimeout rejects with a TimeoutError past the deadline", async () => {
    vi.useFakeTimers();
    try {
      const p = withTimeout(new Promise(() => {}), "test", 100);
      const assertion = expect(p).rejects.toBeInstanceOf(IdbTimeoutError);
      await vi.advanceTimersByTimeAsync(101);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("a fast read is untouched by the timeout", async () => {
    await expect(withTimeout(Promise.resolve(7), "fast", 50)).resolves.toBe(7);
  });
});

describe("failure classification carries the right copy", () => {
  it("maps causes to distinct reasons", () => {
    expect(classifyIdbError(new DOMException("full", "QuotaExceededError"))).toBe(
      "quota-exceeded",
    );
    expect(classifyIdbError(new IdbTimeoutError("read", 5000))).toBe("read-timeout");
    expect(classifyIdbError(new DOMException("no", "InvalidStateError"))).toBe("private-mode");
    // Anything unrecognised still lands in a broken state — never swallowed.
    expect(classifyIdbError(new Error("something odd"))).toBe("open-failed");
  });
});
