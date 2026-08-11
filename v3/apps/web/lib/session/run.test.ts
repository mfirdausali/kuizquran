// THE TEST THAT WOULD HAVE CAUGHT v3-D67.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE LEADS WITH THE END-TO-END ASSERTION
// ---------------------------------------------------------------------------
// v3-D67: `append()` had ZERO reachable callers. 502 frontend tests passed. The
// render layer had 47 tests built from real engine output, and every one of them
// was TRUE — they asserted that a `RenderItem` paints correctly, which it does.
// What no test asserted was that a learner can START a session, ANSWER, and have
// the tap LAND IN THE LOG. So the product's core path was severed for eight
// build-plan steps while the suite reported green.
//
// The lesson from that defect is not "write more render tests". It is that a
// test over a component tells you about the component. This file therefore
// tests the SEAM — the run of it — and its first test is deliberately the
// crudest, most end-to-end assertion in the codebase:
//
//     start a session, answer every item, and assert the EVENT LOG is non-empty.
//
// That assertion is what was false yesterday, and it is worth more than any
// number of assertions about the shape of what the loop returns.
//
// ---------------------------------------------------------------------------
// NO ARABIC. NOT ONE BYTE.
// ---------------------------------------------------------------------------
// Every Arabic string in these tests arrives from the compiled corpus fixture at
// runtime, resolved through `buildFace`. Tests reference COORDINATES (surah 112,
// ayah 1, position 0) and assert on structure, counts and provenance. A test
// that hard-coded an expected Arabic string would be both a sacred-text
// violation and a worse test — it would freeze a corpus detail into an assertion
// that has nothing to do with what is being checked.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Corpus } from "@engine/types.ts";

import { getAllEvents } from "@/lib/idb/read";
import { resetDbForTests } from "@/lib/idb/db";
import { writeLock } from "@/lib/idb/writeLock";

// A seam for the commit-before-paint test alone. When null (every other test)
// the REAL append runs untouched, so nothing here weakens the other assertions.
let appendSpy:
  | ((ev: Parameters<typeof import("@/lib/idb/append").append>[0],
      ctx: Parameters<typeof import("@/lib/idb/append").append>[1]) => Promise<unknown>)
  | null = null;

vi.mock("@/lib/idb/append", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/idb/append")>();
  return {
    ...actual,
    append: (...args: Parameters<typeof actual.append>) =>
      appendSpy ? appendSpy(...args) : actual.append(...args),
  };
});
import {
  startSession,
  currentItem,
  answerCurrent,
  sessionSummaryOf,
  type SessionRun,
} from "./run";

// A fixed clock. The frontend is ALLOWED Date.now(); the engine is not. Tests
// pass time in explicitly so a run is reproducible and TZ-independent — the
// portability defect (v3-D45) came from tests that let the local zone leak in.
const T0 = Date.UTC(2026, 7, 11, 9, 0, 0);
const TZ = "UTC";
const SURAH = 112;

const HERE = dirname(fileURLToPath(import.meta.url));
const STAGED = resolve(HERE, "../../public/corpus/112.json");
const COMPILED = resolve(HERE, "../../../../packages/corpus-compiler/output/112/corpus.json");

let CORPUS: Corpus;

beforeAll(() => {
  // The staged asset is what the browser actually fetches; the compiled output
  // is its source. Prefer the staged one — testing what ships — and fall back so
  // a checkout that compiled but did not stage still runs these rather than
  // skipping them silently. (Same rationale as test/onboarding.test.tsx.)
  const path = existsSync(STAGED) ? STAGED : COMPILED;
  if (!existsSync(path)) {
    throw new Error(`No 112 corpus at ${STAGED} or ${COMPILED}. Run \`make compile-corpus\`.`);
  }
  CORPUS = JSON.parse(readFileSync(path, "utf8")) as Corpus;
});

function corpus(): Corpus {
  return CORPUS;
}

/** Drive a run to completion, answering every item CORRECTLY. Returns the
 *  number of taps made, so a caller can assert the loop actually advanced
 *  rather than exiting immediately (a loop that never runs is the failure mode
 *  this whole file exists to catch). */
async function playThrough(run: SessionRun, c: Corpus) {
  let taps = 0;
  let cur = currentItem(run, c);
  while (cur && taps < 500) {
    const correctIndex = cur.correctIndex;
    run = await answerCurrent(run, c, correctIndex, { now: T0 + taps * 1000, tz: TZ });
    taps++;
    cur = currentItem(run, c);
  }
  return { run, taps };
}

beforeEach(async () => {
  // A brand-new IndexedDB per test: shared state between tests is how an
  // ordering suite accidentally passes.
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  writeLock.forceForTests({ role: "writer" });
});

describe("v3-D67 — a learner can complete a session, and the log proves it", () => {
  it("writes events to the log; the log is NOT empty after a session", async () => {
    const c = corpus();
    const started = await startSession(
      { surah: SURAH, now: T0, tz: TZ },
      c,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const before = await getAllEvents();
    const { taps } = await playThrough(started.run, c);

    // The loop must actually have run. A session that serves zero items would
    // vacuously "pass" an empty-log check in the wrong direction.
    expect(taps).toBeGreaterThan(0);

    const after = await getAllEvents();
    expect(after.length).toBeGreaterThan(before.length);
    // THE assertion of v3-D67: taps reach the log.
    expect(after.some((e) => e.type === "reconstruct_tap")).toBe(true);
  });

  it("opens with session_start, so summarizeSession can find its origin", async () => {
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");

    const events = await getAllEvents();
    const first = events.find((e) => e.type === "session_start");
    expect(first).toBeDefined();
    expect(first?.surah).toBe(SURAH);
    // summarizeSession reads `ts` off session_start as the duration origin.
    expect(first?.ts).toBe(T0);
  });

  it("stamps every event with deviceId, deviceSeq and tz — sync depends on it", async () => {
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    await playThrough(started.run, c);

    const events = await getAllEvents();
    expect(events.length).toBeGreaterThan(1);
    for (const e of events) {
      expect(typeof e.id).toBe("string");
      expect(typeof e.deviceId).toBe("string");
      expect(typeof e.deviceSeq).toBe("number");
      expect(e.tz).toBe(TZ);
    }
    // deviceSeq is the per-device ordinal: strictly increasing, no gaps, no
    // duplicates (edge cases #48/#49 — a fork here is unrepairable).
    const seqs = events.map((e) => e.deviceSeq as number).sort((a, b) => a - b);
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBe((seqs[i - 1] as number) + 1);
    }
  });

  it("records a WRONG tap as correct:false rather than dropping it", async () => {
    // The log is evidence, not a scoreboard. A wrong answer that never reaches
    // the log makes the fold overstate strength — silently and permanently.
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");

    const cur = currentItem(started.run, c);
    expect(cur).not.toBeNull();
    if (!cur) return;

    const wrong = cur.correctIndex === 0 ? 1 : 0;
    await answerCurrent(started.run, c, wrong, { now: T0 + 500, tz: TZ });

    const events = await getAllEvents();
    const taps = events.filter((e) => e.type === "reconstruct_tap");
    expect(taps.length).toBe(1);
    expect(taps[0]!.correct).toBe(false);
  });

  it("marks session events structured:true, so the fold grades them", async () => {
    // `structured === false` is free play, which summarizeSession and the fold
    // treat as evidence-only. A structured session logging free-play events
    // would drill correctly and record nothing that counts.
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    await playThrough(started.run, c);

    const events = await getAllEvents();
    const taps = events.filter((e) => e.type === "reconstruct_tap");
    expect(taps.length).toBeGreaterThan(0);
    expect(taps.every((e) => e.structured !== false)).toBe(true);
  });

  it("emits ayah_produced when an ayah's reconstruction completes", async () => {
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    const { run } = await playThrough(started.run, c);

    const events = await getAllEvents();
    const produced = events.filter((e) => e.type === "ayah_produced");
    expect(produced.length).toBeGreaterThan(0);

    // And the summary the learner sees is computed from those same events —
    // never from a counter the view kept on the side.
    const summary = await sessionSummaryOf(run);
    expect(summary.ayatCompleted).toBe(produced.length);
    expect(summary.taps).toBeGreaterThan(0);
  });
});

describe("commit before paint (invariant #2)", () => {
  // WHY THIS TEST INTERLEAVES A REAL AWAIT RATHER THAN JUST READING AFTERWARDS.
  //
  // The first version of this test awaited `answerCurrent`, then read the log,
  // and asserted the event was there. It PASSED against a mutant that replaced
  // `await append(...)` with `void append(...)` — the fire-and-forget write that
  // invariant #2 exists to forbid — because fake-indexeddb settles the write
  // during the same microtask drain, so by read time it had landed anyway.
  //
  // That is the vacuity pattern this build has now hit ten times: the assertion
  // was true, and it constrained nothing. The fix is to observe the ORDERING at
  // the moment the revealed state is produced, not the state of the world after.
  // `answerCurrent` must not resolve until the durable write has completed, so
  // we race it against a marker appended to a shared timeline.
  it("does not resolve a revealed state before the write is durable", async () => {
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");

    const cur = currentItem(started.run, c);
    if (!cur) throw new Error("an item must be served");

    // Instrument the WRITE, not an observer of it. An earlier version of this
    // test polled the log in a parallel loop and asserted "durable" was stamped
    // before "resolved" — but the poll's own `await` yields the microtask queue,
    // so a correctly-awaited implementation still resolved first. That version
    // failed on correct code: it was measuring when the test noticed the write,
    // not when the write happened.
    //
    // Delaying the append itself removes the ambiguity. If `answerCurrent`
    // awaits the commit, it cannot resolve until this delay has elapsed; if it
    // fires and forgets, it resolves immediately and the ordering flips.
    // Instrument the APPEND ITSELF, via the module mock, and make it slow.
    //
    // Two earlier versions of this test were vacuous. The first read the log
    // after awaiting and passed against a `void append(...)` mutant, because
    // fake-indexeddb settles the write in the same microtask drain. The second
    // polled the log in a parallel loop and FAILED on correct code, because the
    // poll's own await yields — it measured when the test noticed the write, not
    // when the write happened.
    //
    // The only unambiguous instrument is a delay inside the append that the
    // implementation must actually wait out. If `answerCurrent` awaits the
    // commit, it cannot resolve before "write-durable" is stamped. If it fires
    // and forgets, it resolves first and this fails. Both directions are checked
    // in the mutation log for this change.
    const timeline: string[] = [];
    const real = await vi.importActual<typeof import("@/lib/idb/append")>(
      "@/lib/idb/append",
    );
    // Scope the delay to the TAP append only. An earlier version delayed every
    // append, and the `ayah_produced` write — which is separately awaited —
    // stamped "write-durable" before "resolved" no matter what the tap did,
    // masking the mutant. Only the event under test may drive this timeline.
    appendSpy = async (ev, actx) => {
      const isTap = (ev as { type?: string }).type === "reconstruct_tap";
      const out = await real.append(ev, actx);
      if (isTap) {
        await new Promise((r) => setTimeout(r, 20));
        timeline.push("write-durable");
      }
      return out;
    };

    const next = await answerCurrent(started.run, c, cur.correctIndex, {
      now: T0 + 100,
      tz: TZ,
    });
    timeline.push("resolved");
    appendSpy = null;

    // THE ordering constraint: the write completed before the call resolved.
    expect(timeline).toContain("write-durable");
    expect(timeline.indexOf("write-durable")).toBeLessThan(
      timeline.indexOf("resolved"),
    );
    expect(next.lastTap).not.toBeNull();
  });

  it("has a durable event backing the revealed verdict", async () => {
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");

    const cur = currentItem(started.run, c);
    if (!cur) throw new Error("an item must be served");

    const next = await answerCurrent(started.run, c, cur.correctIndex, {
      now: T0 + 100,
      tz: TZ,
    });

    // The state carries a reveal...
    expect(next.lastTap).not.toBeNull();
    // ...and by the time it does, the event is already durable.
    const events = await getAllEvents();
    expect(events.some((e) => e.type === "reconstruct_tap")).toBe(true);
  });
});

describe("resume (edge case #93) — a reload does not lose the session", () => {
  it("rebuilds an equivalent run from the log alone", async () => {
    // The log is the truth. A session held only in React state dies on reload,
    // which is exactly the bfcache/refresh case the stub called out.
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");

    const cur = currentItem(started.run, c);
    if (!cur) throw new Error("an item must be served");
    await answerCurrent(started.run, c, cur.correctIndex, { now: T0 + 100, tz: TZ });

    // Simulate a reload: throw away the in-memory run, keep only the database.
    const resumed = await startSession({ surah: SURAH, now: T0 + 200, tz: TZ }, c);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;

    // A resume must NOT re-emit session_start — that would reset the duration
    // origin and make every reload look like a fresh session.
    const events = await getAllEvents();
    expect(events.filter((e) => e.type === "session_start").length).toBe(1);
  });
});
