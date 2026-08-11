// DEFECTS.md#B5's CLOSING TEST, plus edge case #50 and #111.
//
// B5's closing criterion, verbatim: "merge preserves `deviceSeq` and a
// two-device test yields identical folds regardless of arrival order."
//
// THE FIXTURE IS THE TEST. Every mutation in the merge is only caught if the
// fixture is adversarial, and a weak fixture makes the whole B5 closure
// decorative while showing green. This one deliberately carries THREE
// properties, each earning its place by killing a specific mutation:
//
//   (a) ts COLLISIONS ACROSS DEVICES — several events share an identical
//       millisecond. Without these, `ts` alone is a total order and EVERY
//       mutation to the tiebreakers survives. This is the single most
//       important property of the fixture.
//   (b) deviceSeq CONTRADICTING ts ORDER within a device — a retried append
//       carrying an OLD deviceSeq with a NEWER ts (append.ts:148-150
//       deliberately reuses the allocated seq). Without this, deviceSeq is
//       redundant with ts and dropping it survives.
//   (c) OVERLAPPING deviceSeq RANGES across devices (#49: a cold second
//       device starts at 1 while device A is at 5000). Without this, a merge
//       that reordered the canonical tuple's middle two members survives.
//   (d) SLIPS INTERLEAVED WITH SUCCESSES on the SAME ayah at COLLIDING ts.
//       This one was added because the mutation table caught the suite lying:
//       with an all-correct fixture, the AtomsMap assertion SURVIVED the
//       deviceSeq-dropping mutation. `update()` is order-INSENSITIVE for a run
//       of correct retrievals sharing a millisecond, so the fold could not see
//       an ordering bug that the log order plainly showed. A slip is what makes
//       order matter: `update()` branches on the band the atom is IN when the
//       error arrives (a lapse from `reinforce`/`carry` damps stability x0.4
//       and drops strength by 45; an error in Learn subtracts 15 and no lapse),
//       and difficulty compounds multiplicatively thereafter. So "slip then
//       successes" and "successes then slip" produce genuinely different atoms.
//
// Property (d) is why assertion (2) is not decorative. Both assertions are
// kept: (1) pins log order directly, (2) proves the order actually reaches the
// fold. See the mutation report — M6 is the reason (d) exists.
//
// THE FOLD IS THE REAL ONE. The test imports the fold-runner's own
// `canonicalOrder` and the engine's own `rebuild` — never a reimplementation.
// A test that re-derives the ordering rule proves only that the test agrees
// with itself.
//
// NO ARABIC LITERALS. Events reference fixture COORDINATES only.

import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { DrillEvent } from "@engine/types.ts";
import { rebuild, type AtomsMap } from "@engine/rebuild.ts";
import { canonicalOrder } from "../../../../worker/fold-runner/src/canonicalOrder.ts";
import { compareAtomCaches } from "../../../../worker/fold-runner/src/determinism.ts";
import { openDb, resetDbForTests } from "@/lib/idb/db";
import { getAllEvents } from "@/lib/idb/read";
import { mergeFromServer } from "./merge.ts";
import { eventDigest } from "./digest.ts";

const NOW = 1_700_000_000_000;

beforeEach(async () => {
  // A brand-new IndexedDB per test: shared state between tests is how an
  // ordering suite accidentally passes.
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
});

/** A graded event at fixture coordinates. `rung_complete` is chosen because
 *  rebuild.ts FOLDS it (S1/S2/S3 → a retrieval outcome), so the AtomsMap
 *  genuinely depends on the order these are applied in. An unfolded event type
 *  would make assertion (2) vacuous. */
function ev(over: Partial<DrillEvent> & { id: string; ts: number }): DrillEvent {
  return {
    type: "rung_complete",
    surah: 12,
    ayah: 1,
    rung: "S1",
    ...over,
  };
}

/**
 * The adversarial two-device fixture.
 *
 * Device A ("dev-a") is an established device deep into its sequence.
 * Device B ("dev-b") is a cold second device (#49) starting at 1 — so the two
 * deviceSeq ranges OVERLAP, which is property (c).
 */
function twoDeviceFixture(): DrillEvent[] {
  const A = "dev-a";
  const B = "dev-b";
  return [
    // --- property (a): ts COLLISIONS ACROSS DEVICES at t=1000 and t=3000 ---
    // At t=1000 three events from two devices share the millisecond. Only
    // (deviceId, deviceSeq) can order them.
    ev({ id: "a-1", ts: 1000, deviceId: A, deviceSeq: 5000, ayah: 1, rung: "S1" }),
    ev({ id: "b-1", ts: 1000, deviceId: B, deviceSeq: 1, ayah: 1, rung: "S2" }),
    ev({ id: "a-2", ts: 1000, deviceId: A, deviceSeq: 5001, ayah: 1, rung: "S2" }),

    ev({ id: "b-2", ts: 2000, deviceId: B, deviceSeq: 2, ayah: 2, rung: "S1" }),

    // At t=3000, a full (ts, deviceId, deviceSeq) TIE between two device-A
    // rows is impossible (deviceSeq is unique per device), so this collision
    // is across devices AND has overlapping seq values: A is at 5002, B at 3.
    // A merge that reordered the tuple to (ts, deviceSeq, deviceId) would put
    // b-3 (seq 3) before a-3 (seq 5002) — visibly wrong. Property (c) is what
    // makes that mutation detectable.
    ev({ id: "a-3", ts: 3000, deviceId: A, deviceSeq: 5002, ayah: 2, rung: "S2" }),
    ev({ id: "b-3", ts: 3000, deviceId: B, deviceSeq: 3, ayah: 2, rung: "S2" }),

    // --- property (b): deviceSeq CONTRADICTS ts order within device A ---
    // a-retry carries an OLD deviceSeq (5003) with a NEWER ts (5000) than
    // a-4, which carries a LATER deviceSeq (5004) with an EARLIER ts (4000).
    // ts orders them a-4 then a-retry; deviceSeq agrees here — but the pair
    // below inverts it.
    ev({ id: "a-4", ts: 4000, deviceId: A, deviceSeq: 5004, ayah: 3, rung: "S1" }),
    ev({ id: "a-retry", ts: 4000, deviceId: A, deviceSeq: 5003, ayah: 3, rung: "S2" }),

    // A full four-way tie broken ONLY by uuid: same ts, same device, and
    // deliberately the same deviceSeq (which cannot happen in life, but is
    // exactly what proves the uuid tiebreaker is reached and is total).
    ev({ id: "zzz-tie", ts: 6000, deviceId: A, deviceSeq: 6000, ayah: 4, rung: "S1" }),
    ev({ id: "aaa-tie", ts: 6000, deviceId: A, deviceSeq: 6000, ayah: 4, rung: "S2" }),

    ev({ id: "b-4", ts: 7000, deviceId: B, deviceSeq: 4, ayah: 5, rung: "S3" }),
    ev({ id: "a-5", ts: 7000, deviceId: A, deviceSeq: 5005, ayah: 5, rung: "S3" }),

    // --- property (d): SLIPS INTERLEAVED WITH SUCCESSES, same ayah, COLLIDING ts ---
    // Ayah 8 is built up by successes and then slipped, all inside two
    // colliding milliseconds and ACROSS both devices. Whether the slip lands
    // before or after the successes changes which band `update()` sees, and
    // therefore changes stability/strength/difficulty/lapses in the folded
    // atom. This is what makes the AtomsMap assertion genuinely order-
    // sensitive — without it, that assertion survives the deviceSeq mutation.
    ev({ id: "a-6", ts: 8000, deviceId: A, deviceSeq: 5006, ayah: 8, rung: "S3" }),
    ev({ id: "b-5", ts: 8000, deviceId: B, deviceSeq: 5, ayah: 8, rung: "S3" }),
    // A slip: `tap` with correct:false → a NEGATIVE retrieval of this rung.
    ev({ id: "a-7", ts: 8000, deviceId: A, deviceSeq: 5007, ayah: 8, rung: "S3", type: "tap", correct: false }),
    ev({ id: "b-6", ts: 8000, deviceId: B, deviceSeq: 6, ayah: 8, rung: "S2" }),
    ev({ id: "a-8", ts: 9000, deviceId: A, deviceSeq: 5008, ayah: 8, rung: "S2", type: "tap", correct: false }),
    ev({ id: "b-7", ts: 9000, deviceId: B, deviceSeq: 7, ayah: 8, rung: "S3" }),
  ];
}

/** Deterministic (seeded) Fisher-Yates — no Math.random, matching the
 *  fold-runner's own standard ("across 15 seeds"). */
function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr];
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Merge an arrival order into a FRESH database and read the log back. */
async function mergeAndReadBack(arrival: readonly DrillEvent[]): Promise<string[]> {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  await openDb();
  // Merge in pages, so the test exercises the same multi-transaction path a
  // real paginated pull takes rather than one giant merge.
  const page = 4;
  for (let i = 0; i < arrival.length; i += page) {
    await mergeFromServer(arrival.slice(i, i + page), { now: NOW });
  }
  const rows = await getAllEvents();
  return rows.map((r) => r.id ?? "");
}

/** Fold the read-back log with the ENGINE's own rebuild, after the
 *  FOLD-RUNNER's own canonicalOrder — the real ordering rule, not a local
 *  reimplementation of it. */
async function foldReadBack(): Promise<AtomsMap> {
  const rows = await getAllEvents();
  return rebuild(canonicalOrder(rows as DrillEvent[]));
}

describe("B5 — two devices, byte-identical event sets, DIFFERENT arrival orders", () => {
  const SEEDS = [1, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];

  it("yields a byte-identical log ORDER across every arrival order", async () => {
    const fixture = twoDeviceFixture();

    // The reference: canonical order computed by the FOLD-RUNNER's own
    // function. If the merge preserves everything, the store's `by_ts` index
    // must reproduce exactly this.
    const expected = canonicalOrder(fixture).map((e) => e.id ?? "");

    const orders: string[][] = [];
    for (const seed of SEEDS) {
      orders.push(await mergeAndReadBack(seededShuffle(fixture, seed)));
    }

    // ASSERTION (1) — the one that actually pins B5. A fold can accidentally
    // be order-insensitive for a weak fixture, and then assertion (2) passes
    // while the log order is genuinely wrong.
    for (let i = 0; i < orders.length; i++) {
      expect(orders[i], `arrival order seed ${SEEDS[i]}`).toEqual(expected);
    }
    // And every interleaving agrees with every other.
    for (const order of orders) expect(order).toEqual(orders[0]);
  });

  it("yields an IDENTICAL AtomsMap across every arrival order", async () => {
    const fixture = twoDeviceFixture();

    const folds: AtomsMap[] = [];
    for (const seed of SEEDS) {
      await mergeAndReadBack(seededShuffle(fixture, seed));
      folds.push(await foldReadBack());
    }

    // ASSERTION (2) — DEEP, key-by-key, via the fold-runner's OWN
    // `compareAtomCaches` ("ANY divergence reported, never silently
    // ignored"). Never a length or key-count check: the D45 lesson ("a test
    // asserting link counts but never link text") is precisely that failure.
    //
    // THE ORACLE IS INDEPENDENT OF THE MERGE. It is the fold of the ORIGINAL
    // fixture in the fold-runner's own canonical order — computed without
    // touching IndexedDB at all. Comparing the interleavings only against EACH
    // OTHER is not enough and the mutation table proved it: a merge that drops
    // deviceSeq from EVERY row damages all interleavings IDENTICALLY, so a
    // self-consistency check stays green while the fold is genuinely wrong.
    // An external oracle is what turns this assertion from decorative into
    // load-bearing. (See M6 in the mutation report.)
    const oracle = rebuild(canonicalOrder(fixture));
    expect(oracle.size).toBeGreaterThan(0);
    for (let i = 0; i < folds.length; i++) {
      const result = compareAtomCaches(oracle, folds[i]!);
      expect(result.divergentKeys, `seed ${SEEDS[i]} diverged from the oracle`).toEqual([]);
      expect(result.matches).toBe(true);
    }
  });

  it("the fixture is genuinely order-SENSITIVE — a ts-only sort is NOT enough", () => {
    // This test guards THE FIXTURE, not the merge. If a ts-only sort happened
    // to reproduce canonical order, then mutation M4 (replace canonical order
    // with a ts-only sort) would SURVIVE and the whole suite would be
    // decorative. Making that a test means the fixture cannot silently rot.
    const fixture = twoDeviceFixture();
    const canonical = canonicalOrder(fixture).map((e) => e.id);
    // A stable ts-only sort over a DIFFERENT input permutation.
    const tsOnly = [...seededShuffle(fixture, 99)]
      .sort((a, b) => a.ts - b.ts)
      .map((e) => e.id);
    expect(tsOnly).not.toEqual(canonical);
  });

  it("the fixture has ts collisions ACROSS devices and OVERLAPPING deviceSeq ranges", () => {
    // The two fixture properties that make M4 and M5 detectable, asserted
    // directly so a later edit that weakens the fixture fails loudly here
    // rather than silently disarming the mutation table.
    const fixture = twoDeviceFixture();
    const byTs = new Map<number, Set<string>>();
    for (const e of fixture) {
      const set = byTs.get(e.ts) ?? new Set<string>();
      set.add(e.deviceId ?? "");
      byTs.set(e.ts, set);
    }
    const crossDeviceCollisions = [...byTs.values()].filter((s) => s.size > 1).length;
    expect(crossDeviceCollisions).toBeGreaterThanOrEqual(2);

    const seqA = fixture.filter((e) => e.deviceId === "dev-a").map((e) => e.deviceSeq!);
    const seqB = fixture.filter((e) => e.deviceId === "dev-b").map((e) => e.deviceSeq!);
    // Device B's range sits BELOW device A's — #49's cold second device. A
    // tuple reordered to (ts, deviceSeq, deviceId) would visibly reorder them.
    expect(Math.min(...seqB)).toBeLessThan(Math.min(...seqA));
  });
});

describe("merge preserves the wire verbatim", () => {
  it("preserves deviceSeq, deviceId, ts and id exactly", async () => {
    await openDb();
    const e = ev({
      id: "keep-me",
      ts: 4242,
      deviceId: "dev-x",
      deviceSeq: 987,
      visitOrdinal: 3,
      siteKey: "12:ayah:1",
      tz: "Asia/Kuala_Lumpur",
      corpusHash: "abc1234567890def",
      gradeClass: "s3_full",
    });
    await mergeFromServer([e], { now: NOW });
    const [row] = await getAllEvents();
    expect(row!.deviceSeq).toBe(987);
    expect(row!.deviceId).toBe("dev-x");
    expect(row!.ts).toBe(4242);
    expect(row!.id).toBe("keep-me");
    expect(row!.visitOrdinal).toBe(3);
    expect(row!.siteKey).toBe("12:ayah:1");
    expect(row!.tz).toBe("Asia/Kuala_Lumpur");
    expect(row!.corpusHash).toBe("abc1234567890def");
    expect(row!.gradeClass).toBe("s3_full");
  });

  it("copies the legacy `seq` as provenance and never re-derives it", async () => {
    await openDb();
    // The legacy `seq` field is arrival-order and is B5's exact bug. The merge
    // must neither STRIP it (B5's gesture) nor RE-DERIVE it (B5's bug).
    await mergeFromServer(
      [
        { ...ev({ id: "s1", ts: 100, deviceId: "d", deviceSeq: 1 }), seq: 77 },
        ev({ id: "s2", ts: 200, deviceId: "d", deviceSeq: 2 }),
      ],
      { now: NOW },
    );
    const rows = await getAllEvents();
    const s1 = rows.find((r) => r.id === "s1")!;
    const s2 = rows.find((r) => r.id === "s2")!;
    expect(s1.seq).toBe(77);
    // Never invented for a row that did not carry one.
    expect(s2.seq).toBeUndefined();
  });

  it("marks merged rows synced so they are never pushed back", async () => {
    await openDb();
    await mergeFromServer([ev({ id: "from-server", ts: 1, deviceId: "d", deviceSeq: 1 })], {
      now: NOW,
    });
    const [row] = await getAllEvents();
    expect(row!.syncedAt).toBe(NOW);
  });

  it("writes CONCRETE values for absent index members so the row stays indexed", async () => {
    await openDb();
    // A pre-selection-era event (#58) with no deviceId/deviceSeq. An index key
    // cannot contain undefined: such a row would be ABSENT from every by_ts
    // cursor, not merely mis-ordered.
    await mergeFromServer([{ type: "session_start", ts: 500, surah: 12, ayah: 1, rung: "S1", id: "legacy" }], {
      now: NOW,
    });
    const db = await openDb();
    const indexed = await db.getAllFromIndex("events", "by_ts");
    expect(indexed.map((r) => r.id)).toEqual(["legacy"]);
    expect(indexed[0]!.deviceId).toBe("");
    expect(indexed[0]!.deviceSeq).toBe(0);
  });
});

describe("#50 — merge sees an existing id", () => {
  const base = ev({ id: "dup", ts: 100, deviceId: "d", deviceSeq: 1, ayah: 7 });

  it("SKIPS silently when the payload digest MATCHES", async () => {
    await openDb();
    await mergeFromServer([base], { now: NOW });
    const result = await mergeFromServer([base], { now: NOW + 1 });
    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
    expect(result.divergences).toEqual([]);
  });

  it("ALERTS and KEEPS THE LOCAL ROW when the payload digest DIFFERS", async () => {
    await openDb();
    await mergeFromServer([base], { now: NOW });
    const divergent = { ...base, ayah: 99 };
    const result = await mergeFromServer([divergent], { now: NOW + 1 });

    // Alert raised.
    expect(result.divergences).toHaveLength(1);
    expect(result.divergences[0]!.id).toBe("dup");
    expect(result.divergences[0]!.localDigest).not.toBe(result.divergences[0]!.serverDigest);

    // Local row UNCHANGED — never silently overwritten. The local row is what
    // this device observed and what its atoms were folded from.
    const [row] = await getAllEvents();
    expect(row!.ayah).toBe(7);
  });

  it("a divergence does NOT wedge the rest of the page", async () => {
    await openDb();
    await mergeFromServer([base], { now: NOW });
    const result = await mergeFromServer(
      [
        { ...base, ayah: 99 },
        ev({ id: "after-1", ts: 200, deviceId: "d", deviceSeq: 2 }),
        ev({ id: "after-2", ts: 300, deviceId: "d", deviceSeq: 3 }),
      ],
      { now: NOW + 1 },
    );
    expect(result.divergences).toHaveLength(1);
    // One poisoned uuid must not stop the page — that is #110's wedge in a
    // different costume.
    expect(result.inserted).toBe(2);
    const ids = (await getAllEvents()).map((r) => r.id);
    expect(ids).toContain("after-1");
    expect(ids).toContain("after-2");
  });

  it("marks a still-pending local row synced when the server demonstrably has it", async () => {
    const db = await openDb();
    // A row appended locally and NOT yet synced.
    await db.put("events", { ...base, syncedAt: null });
    const result = await mergeFromServer([base], { now: NOW });
    expect(result.skipped).toBe(1);
    const [row] = await getAllEvents();
    expect(row!.syncedAt).toBe(NOW);
  });

  it("a round-tripped event that LOST its explicit nulls still digests EQUAL", async () => {
    const db = await openDb();
    // What the local row looks like: explicit nulls for absent optionals.
    const local = {
      ...ev({ id: "rt", ts: 100, deviceId: "d", deviceSeq: 1 }),
      latency: null,
      choice: null,
      syncedAt: null,
    } as never;
    await db.put("events", local);
    // What EventsController::toWire() returns: those keys simply absent,
    // because it emits a field only `if ($value !== null)`.
    const fromServer = ev({ id: "rt", ts: 100, deviceId: "d", deviceSeq: 1 });

    const result = await mergeFromServer([fromServer], { now: NOW });
    // NO divergence. If this fires, #50's alert misfires on every single
    // round-tripped event and everyone learns to ignore it.
    expect(result.divergences).toEqual([]);
    expect(result.skipped).toBe(1);
  });
});

describe("#111 — far-future client ts", () => {
  it("ACCEPTS and FLAGS, never rejects and never rewrites the ts", async () => {
    await openDb();
    const farFuture = NOW + 5 * 365 * 24 * 60 * 60 * 1000;
    const result = await mergeFromServer(
      [ev({ id: "future", ts: farFuture, deviceId: "d", deviceSeq: 1 })],
      { now: NOW },
    );
    expect(result.inserted).toBe(1);
    expect(result.futureTs).toEqual(["future"]);

    // The ts is PRESERVED. Rewriting it would make client and server disagree
    // about the same uuid's payload — which the digest would then correctly
    // report as a #50 divergence. Two bugs for the price of one.
    const [row] = await getAllEvents();
    expect(row!.ts).toBe(farFuture);
  });

  it("does not flag a plausible ts", async () => {
    await openDb();
    const result = await mergeFromServer(
      [ev({ id: "fine", ts: NOW + 60_000, deviceId: "d", deviceSeq: 1 })],
      { now: NOW },
    );
    expect(result.futureTs).toEqual([]);
  });
});

describe("digest normalization", () => {
  it("treats an ABSENT field and a NULL field as identical", () => {
    const withNull = { type: "tap", ts: 1, surah: 12, ayah: 1, rung: "S1", latency: null } as never;
    const without = { type: "tap", ts: 1, surah: 12, ayah: 1, rung: "S1" } as never;
    expect(eventDigest(withNull)).toBe(eventDigest(without));
  });

  it("is independent of key insertion order", () => {
    const a = { type: "tap", ts: 1, surah: 12, ayah: 1, rung: "S1" } as never;
    const b = { rung: "S1", ayah: 1, surah: 12, ts: 1, type: "tap" } as never;
    expect(eventDigest(a)).toBe(eventDigest(b));
  });

  it("is independent of key order INSIDE specSnapshot", () => {
    const a = {
      type: "tap", ts: 1, surah: 12, ayah: 1, rung: "S1",
      specSnapshot: { alpha: 1, beta: { x: 1, y: 2 } },
    } as never;
    const b = {
      type: "tap", ts: 1, surah: 12, ayah: 1, rung: "S1",
      specSnapshot: { beta: { y: 2, x: 1 }, alpha: 1 },
    } as never;
    expect(eventDigest(a)).toBe(eventDigest(b));
  });

  it("ignores the local-only syncedAt", () => {
    const pendingRow = { type: "tap", ts: 1, surah: 12, ayah: 1, rung: "S1", syncedAt: null } as never;
    const syncedRow = { type: "tap", ts: 1, surah: 12, ayah: 1, rung: "S1", syncedAt: 12345 } as never;
    expect(eventDigest(pendingRow)).toBe(eventDigest(syncedRow));
  });

  it("DOES differ when a real field differs", () => {
    const a = { type: "tap", ts: 1, surah: 12, ayah: 1, rung: "S1" } as never;
    const b = { type: "tap", ts: 1, surah: 12, ayah: 2, rung: "S1" } as never;
    expect(eventDigest(a)).not.toBe(eventDigest(b));
  });

  it("preserves ARRAY order — array order is meaning", () => {
    const a = { type: "tap", ts: 1, surah: 12, ayah: 1, rung: "S1", specSnapshot: { p: [1, 2] } } as never;
    const b = { type: "tap", ts: 1, surah: 12, ayah: 1, rung: "S1", specSnapshot: { p: [2, 1] } } as never;
    expect(eventDigest(a)).not.toBe(eventDigest(b));
  });
});

describe("the pull cursor commits in the SAME transaction as the events", () => {
  it("advances the cursor alongside the merged rows", async () => {
    const db = await openDb();
    await mergeFromServer([ev({ id: "c1", ts: 1, deviceId: "d", deviceSeq: 1 })], {
      now: NOW,
      cursor: 42,
      identity: "tok",
    });
    const cursor = await db.get("meta", "pullCursor");
    const identity = await db.get("meta", "pullCursorIdentity");
    expect(cursor?.value).toBe(42);
    expect(identity?.value).toBe("tok");
    expect((await getAllEvents()).map((r) => r.id)).toEqual(["c1"]);
  });

  it("leaves the cursor untouched when none is supplied", async () => {
    const db = await openDb();
    await mergeFromServer([ev({ id: "c2", ts: 1, deviceId: "d", deviceSeq: 1 })], { now: NOW });
    expect(await db.get("meta", "pullCursor")).toBeUndefined();
  });
});
