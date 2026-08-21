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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Corpus, DrillEvent } from "@engine/types.ts";
import { rebuild } from "@engine/rebuild.ts";
import { atomKey } from "@engine/atom.ts";

import { getAllEvents } from "@/lib/idb/read";
import { append } from "@/lib/idb/append";
import { resetDbForTests } from "@/lib/idb/db";
import { writeLock } from "@/lib/idb/writeLock";
import { assemblePass } from "@/lib/onboarding/pass";

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

// A seam for the "gradeClassToWire is the ONE mapping" test alone. When null
// (every other test) the REAL function runs untouched. DEFECTS.md#B2 / v3-D26:
// `gradeClass.ts`'s own header says gradeClassToWire() is "the ONE function
// that resolves [a GradeClass] to a literal Rung... there is structurally
// nowhere else for that decision to live" — but nothing ever called it, and
// this module independently re-derived the identical S2/S3/RC ternary instead
// (functionally correct today, only because the two copies still agree). This
// mock proves the WIRING, not just the VALUE: if run.ts is genuinely routing
// every rung through gradeClassToWire(), overriding it must change every
// emitted rung. A hardcoded literal alongside a correct-by-coincidence value
// would pass a value-only assertion and prove nothing (the exact vacuity shape
// this build has hit repeatedly — v3-D58 et al.).
let gradeClassToWireSpy: ((gc: string) => string) | null = null;

vi.mock("@engine/gradeClass.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@engine/gradeClass.ts")>();
  return {
    ...actual,
    gradeClassToWire: (gc: Parameters<typeof actual.gradeClassToWire>[0]) =>
      gradeClassToWireSpy ? gradeClassToWireSpy(gc) : actual.gradeClassToWire(gc),
  };
});
import {
  startSession,
  startFloorSession,
  currentItem,
  answerCurrent,
  sessionSummaryOf,
  extraLearnOfferFor,
  startExtraLearn,
  weakSpotOfferFor,
  startWeakSpotDrill,
  diminishingReturnsNudge,
  demoteOfferFor,
  acceptGateDemote,
  startDrillSession,
  startOpenPractice,
  SessionCommitFailure,
  type SessionRun,
} from "./run";
import { RetryableAppendError } from "@/lib/idb/append";
import { DEMOTE_OFFER_AFTER_FAILS, RESCAFFOLD_AFTER_FAILS } from "@engine/gate.ts";

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

  const path12 = existsSync(STAGED_12) ? STAGED_12 : COMPILED_12;
  if (!existsSync(path12)) {
    throw new Error(`No 12 corpus at ${STAGED_12} or ${COMPILED_12}. Run \`make compile-corpus\`.`);
  }
  CORPUS_12 = JSON.parse(readFileSync(path12, "utf8")) as Corpus;
});

function corpus(): Corpus {
  return CORPUS;
}

// Surah 12 (Yusuf, 111 ayat) — needed ONLY for the Door-1 describe block
// below. Surah 112 has just 4 ayat and ~15 words total, so a fresh learner's
// very first session already fits every one of its ayat inside the default
// 8-minute budget (scheduler.ts's DEFAULT_BUDGET) and encodes the whole
// surah in one sitting — there is never anything left for FR6's "extra
// Learn" door to offer. 12 is large enough (1777 words / 111 ayat) that a
// first session's budget-fitted queue can only ever cover a handful of
// ayat, leaving real candidates behind — the actual shape Door 1 exists for.
const SURAH_12 = 12;
const STAGED_12 = resolve(HERE, "../../public/corpus/12.json");
const COMPILED_12 = resolve(HERE, "../../../../packages/corpus-compiler/output/12/corpus.json");
let CORPUS_12: Corpus;

function corpus12(): Corpus {
  return CORPUS_12;
}

/** The DISPLAYED (shuffled) correct index for the run's current blank — the
 *  SAME assembly `SessionIsland` renders the bank from, and therefore the
 *  same index space `answerCurrent`'s `optionIndex` actually means (v3-D99 /
 *  DEFECTS.md#B10). NEVER `currentItem(...).correctIndex`: that is the
 *  engine's raw, unshuffled `[correct, ...distractors]` order (always 0),
 *  which `answerCurrent` stopped accepting once B10 closed — passing it
 *  taps whichever face the shuffle happened to put at slot 0, correct only
 *  by coincidence. */
function correctIndexFor(run: SessionRun, c: Corpus): number {
  const assembled = assemblePass(run.machine, c);
  if (!assembled) throw new Error("no current item to answer");
  return assembled.item.correctIndex;
}

/** Drive a run to completion, answering every item CORRECTLY. Returns the
 *  number of taps made, so a caller can assert the loop actually advanced
 *  rather than exiting immediately (a loop that never runs is the failure mode
 *  this whole file exists to catch). */
async function playThrough(run: SessionRun, c: Corpus) {
  let taps = 0;
  let cur = currentItem(run, c);
  while (cur && taps < 500) {
    run = await answerCurrent(run, c, correctIndexFor(run, c), { now: T0 + taps * 1000, tz: TZ });
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

    const correct = correctIndexFor(started.run, c);
    const wrong = correct === 0 ? 1 : 0;
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

// v3-D99 — DEFECTS.md#B10: `answerCurrent` graded against the engine's RAW,
// unshuffled `[correct, ...distractors]` order (`cur.options[optionIndex]`),
// but `optionIndex` is the LOGICAL index a real tap reports — an index into
// the SHUFFLED display bank `lib/onboarding/pass.ts#assemblePass` builds and
// `SessionIsland` renders from (`components/quiz/QuizCard.tsx`'s own prop
// contract: "an index into the item's own options... the caller commits
// this to the log and decides correctness against the item's own
// correctIndex"). This is the EXACT drift v3-D57/D58 already found once in
// onboarding/the landing demo (`lib/demo/reconstruct.ts#applyTap` correctly
// resolves `step.item.options[optionIndex].text` — the shuffled Face's own
// text — never a raw-order lookup) — the session loop reintroduced it
// independently at build-plan step 18. Nothing caught it: this file's own
// `playThrough` always submitted the RAW index 0 directly (bypassing the
// shuffle and the DOM entirely), and the e2e suite's one `/session` tap
// explicitly says "whether it is right or wrong does not matter here". On
// the shipped `/session` route, tapping the DISPLAYED correct tile was
// graded against a raw-order string that only coincidentally matched it —
// see this run's own diagnostic against a real corpus: all 4/4 blanks of
// 112:1 mismatched.
describe("v3-D99 — DEFECTS.md#B10: a tap is graded against the DISPLAYED option, not the engine's raw order", () => {
  it("tapping the shuffled-correct slot is recorded correct:true and the ayah advances", async () => {
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");

    const { run, taps } = await playThrough(started.run, c);
    expect(taps).toBeGreaterThan(0);
    expect(run.done).toBe(true);

    const events = await getAllEvents();
    const reconstructTaps = events.filter((e) => e.type === "reconstruct_tap");
    expect(reconstructTaps.length).toBeGreaterThan(0);
    // Every tap this run submitted was the DISPLAYED correct slot
    // (`correctIndexFor`, above) — a caller that graded against the raw,
    // unshuffled order instead would record most of these as slips, and the
    // reconstruction would stall rather than reach `done`.
    for (const t of reconstructTaps) {
      expect(t.correct).toBe(true);
    }
  });

  it("a shuffled-correct index that lands on RAW slot >0 still resolves to the true correct surface, not a distractor", async () => {
    // Isolates the exact failure mode: find a blank where the shuffle moved
    // the correct face away from raw slot 0 (112:1 always has one — the
    // engine never shuffles, so this is a property of `displayOrder`, not
    // luck), then submit ONLY that one shuffled index and assert the ENGINE
    // itself agrees it was correct (not just that no error was thrown).
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");

    const assembled = assemblePass(started.run.machine, c);
    if (!assembled) throw new Error("an item must be served");
    // Confirms the test fixture actually exercises the bug's precondition —
    // a vacuous run (shuffle happened to be identity) would prove nothing.
    expect(assembled.item.correctIndex).not.toBe(0);

    const next = await answerCurrent(started.run, c, assembled.item.correctIndex, {
      now: T0 + 100,
      tz: TZ,
    });

    expect(next.lastTap).toEqual({ index: assembled.item.correctIndex, correct: true });
    const events = await getAllEvents();
    const tap = events.find((e) => e.type === "reconstruct_tap");
    expect(tap?.correct).toBe(true);
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

    const next = await answerCurrent(started.run, c, correctIndexFor(started.run, c), {
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

    const next = await answerCurrent(started.run, c, correctIndexFor(started.run, c), {
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

describe("edge case #74 — a retryable append failure can be retried without double-counting", () => {
  // `appendSpy` is process-wide state shared across every test in this file
  // (see the module mock above) — a test that throws BEFORE resetting it
  // would leak a permanently-failing append into every test that runs after,
  // which is a real trap this suite fell into while this file was written
  // (an un-guarded `appendSpy = null` after a re-throwing assertion corrupted
  // unrelated later tests). `finally` closes that hole for good.
  afterEach(() => {
    appendSpy = null;
  });

  it("answerCurrent throws SessionCommitFailure — not a bare error — and leaves no half-applied event", async () => {
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    const cur = currentItem(started.run, c);
    if (!cur) throw new Error("an item must be served");

    appendSpy = async (ev) => {
      throw new RetryableAppendError(
        "write-failed",
        { ...(ev as object), id: "sim-retry-id", deviceId: "sim-retry-device", deviceSeq: 999 } as any,
      );
    };

    let caught: unknown;
    try {
      await answerCurrent(started.run, c, correctIndexFor(started.run, c), { now: T0 + 100, tz: TZ });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SessionCommitFailure);
    expect((caught as SessionCommitFailure).cause).toBeInstanceOf(RetryableAppendError);

    // A thrown commit must not leave a half-applied event — the tap never landed.
    const events = await getAllEvents();
    expect(events.some((e) => e.type === "reconstruct_tap")).toBe(false);
  });

  it("resume() lands the SAME row via retryAppend — the mocked append() export is never re-entered", async () => {
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    const cur = currentItem(started.run, c);
    if (!cur) throw new Error("an item must be served");

    // Only the TAP commit fails here — an incidental `ayah_produced` (112:1's
    // very first tap can complete the whole ayah in one blank) must go
    // through untouched, so this test isolates the tap-retry path alone.
    // Every call through the MOCKED `append` export for the tap fails. A
    // correct retry goes through `retryAppend`, which — per its own header —
    // reuses the row verbatim via the LOCAL (unmocked) `append` inside
    // lib/idb/append.ts, never re-entering this spy. So `tapAppendCalls` must
    // stay at 1.
    const real = await vi.importActual<typeof import("@/lib/idb/append")>(
      "@/lib/idb/append",
    );
    let tapAppendCalls = 0;
    appendSpy = async (ev, actx) => {
      if ((ev as { type?: string }).type !== "reconstruct_tap") {
        return real.append(ev, actx);
      }
      tapAppendCalls++;
      throw new RetryableAppendError(
        "write-failed",
        { ...(ev as object), id: "sim-retry-id", deviceId: "sim-retry-device", deviceSeq: 999 } as any,
      );
    };

    let failure: SessionCommitFailure | undefined;
    try {
      await answerCurrent(started.run, c, correctIndexFor(started.run, c), { now: T0 + 100, tz: TZ });
    } catch (err) {
      if (err instanceof SessionCommitFailure) failure = err;
      else throw err;
    }
    expect(failure).toBeInstanceOf(SessionCommitFailure);
    if (!failure) return;

    const next = await failure.resume();
    expect(next.lastTap).not.toBeNull();
    expect(tapAppendCalls).toBe(1);

    const events = await getAllEvents();
    const taps = events.filter((e) => e.type === "reconstruct_tap");
    // Exactly one tap event — a retry that re-called `answerCurrent` from
    // scratch (rather than resuming) would double it under a fresh id.
    expect(taps.length).toBe(1);
    expect(taps[0]!.id).toBe("sim-retry-id");
  });

  it("also retries an ayah_produced commit that fails AFTER its tap already landed", async () => {
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");

    const real = await vi.importActual<typeof import("@/lib/idb/append")>(
      "@/lib/idb/append",
    );
    let ayahAppendCalls = 0;
    appendSpy = async (ev, actx) => {
      if ((ev as { type?: string }).type === "ayah_produced") {
        ayahAppendCalls++;
        throw new RetryableAppendError(
          "write-failed",
          { ...(ev as object), id: "sim-ayah-id", deviceId: "sim-ayah-device", deviceSeq: 998 } as any,
        );
      }
      return real.append(ev, actx);
    };

    let run = started.run;
    let cur = currentItem(run, c);
    let failure: SessionCommitFailure | undefined;
    let taps = 0;
    while (cur && taps < 500 && !failure) {
      try {
        run = await answerCurrent(run, c, correctIndexFor(run, c), { now: T0 + taps * 1000, tz: TZ });
        taps++;
        cur = currentItem(run, c);
      } catch (err) {
        if (err instanceof SessionCommitFailure) failure = err;
        else throw err;
      }
    }
    expect(failure).toBeInstanceOf(SessionCommitFailure);
    if (!failure) return;

    const next = await failure.resume();
    expect(next.lastTap).not.toBeNull();
    expect(ayahAppendCalls).toBe(1); // never re-entered on retry

    const events = await getAllEvents();
    const produced = events.filter((e) => e.type === "ayah_produced");
    expect(produced.length).toBe(1);
    expect(produced[0]!.id).toBe("sim-ayah-id");
  });

  it("a non-retryable append error is NOT wrapped in SessionCommitFailure", async () => {
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    const cur = currentItem(started.run, c);
    if (!cur) throw new Error("an item must be served");

    appendSpy = async () => {
      throw new Error("some unrelated failure — not a RetryableAppendError");
    };

    let caught: unknown;
    try {
      await answerCurrent(started.run, c, correctIndexFor(started.run, c), { now: T0 + 100, tz: TZ });
    } catch (err) {
      caught = err;
    }

    expect(caught).not.toBeInstanceOf(SessionCommitFailure);
    expect(caught).toBeInstanceOf(Error);
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
    await answerCurrent(started.run, c, correctIndexFor(started.run, c), { now: T0 + 100, tz: TZ });

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

describe("DEFECTS.md#B2 / v3-D26 — every wire rung is resolved by gradeClassToWire(), never re-derived", () => {
  it("routes session_start, reconstruct_tap AND ayah_produced through the engine's ONE mapping", async () => {
    // Every GradeClass maps to a DISTINCT Rung, so an override that always
    // returns "S1" (pretest's wire value — never RC/S2/S3, so it cannot be
    // confused with a coincidentally-correct hardcoded literal) makes every
    // site that genuinely calls gradeClassToWire() observably diverge from
    // whatever it would otherwise have emitted.
    gradeClassToWireSpy = () => "S1";

    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    const { taps } = await playThrough(started.run, c);
    gradeClassToWireSpy = null;

    expect(taps).toBeGreaterThan(0);

    const events = await getAllEvents();
    const withRung = events.filter(
      (e) => e.type === "session_start" || e.type === "reconstruct_tap" || e.type === "ayah_produced",
    );
    // Every one of the three rung-bearing event types must actually appear,
    // or this assertion would vacuously pass over an empty set.
    expect(events.some((e) => e.type === "session_start")).toBe(true);
    expect(events.some((e) => e.type === "reconstruct_tap")).toBe(true);
    expect(events.some((e) => e.type === "ayah_produced")).toBe(true);
    for (const e of withRung) {
      expect(e.rung).toBe("S1");
    }
  });

  it("without the override, ayah_produced still carries the real S2/S3 the engine decided", async () => {
    // The mock is a probe, not a replacement — with it off, the genuine
    // mapping must still hold: a completed pass grades S2 or S3, never RC/S1/S4.
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    await playThrough(started.run, c);

    const events = await getAllEvents();
    const produced = events.filter((e) => e.type === "ayah_produced");
    expect(produced.length).toBeGreaterThan(0);
    for (const e of produced) {
      expect(["S2", "S3"]).toContain(e.rung);
    }
  });
});

// v3-D98 — FR6 Door 1: `packages/engine/src/freeplay.ts#extraLearnGrant` was
// real, pure, unit-tested three times over (v3-D97's own sweep found it) and
// had ZERO production callers anywhere in this app. A learner who finished
// today's assembled queue simply saw "Session complete" with no offer of one
// more gate-intact, cost-disclosed ayah — the exact "mechanism built and
// unit-tested, zero production callers" shape v3-D82..D97 each closed one
// instance of.
describe("v3-D98 — Door 1, 'extra Learn' after the assembled queue is done", () => {
  it("offers nothing before the mastery gate window opens the FIRST candidate is un-encoded — a virgin log grants the first mushaf-order ayah", async () => {
    const c = corpus();
    const offer = await extraLearnOfferFor(
      { surah: SURAH, queue: [], cursor: 0, machine: {} as SessionRun["machine"], startedAt: T0, slips: 0, lastTap: null, done: true, gateSlipped: false, rescaffolding: false, structured: true },
      c,
      T0,
    );
    expect(offer.granted).toBe(true);
    expect(offer.ayah).toBe(1);
    expect(offer.costMin).toBeGreaterThan(0);
  });

  it("a real first session (budget-limited on the 111-ayah surah) leaves candidates behind, and Door 1 offers the NEXT one", async () => {
    const c = corpus12();
    const started = await startSession({ surah: SURAH_12, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    const { run, taps } = await playThrough(started.run, c);
    expect(taps).toBeGreaterThan(0);
    expect(run.done).toBe(true);

    // What the FIRST session actually encoded, derived from the real log —
    // never a hardcoded ayah number, which would freeze a corpus-cost detail
    // this test has no business asserting.
    const events = await getAllEvents();
    const encoded = new Set(
      events.filter((e) => e.type === "ayah_produced").map((e) => e.ayah),
    );
    // The 8-minute default budget must not have swallowed the whole surah, or
    // this test is not exercising the scenario it claims to (see the corpus12
    // comment above for why 12, not 112, is used here).
    expect(encoded.size).toBeGreaterThan(0);
    expect(encoded.size).toBeLessThan(111);

    const offer = await extraLearnOfferFor(run, c, T0 + taps * 1000);
    expect(offer.granted).toBe(true);
    expect(offer.ayah).not.toBeNull();
    expect(encoded.has(offer.ayah!)).toBe(false);
    expect(offer.costMin).toBeGreaterThan(0);
  });

  it("reports 'nothing left to Learn' once every ayah in the surah is already encoded", async () => {
    // Surah 112 is small enough that a single natural session already learns
    // every one of its 4 ayat (see the corpus12 comment above) — the other
    // half of Door 1's contract: it must not keep offering once there is
    // genuinely nothing left.
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    const { run } = await playThrough(started.run, c);
    expect(run.done).toBe(true);

    const offer = await extraLearnOfferFor(run, c, T0 + 10_000);
    expect(offer.granted).toBe(false);
    expect(offer.ayah).toBeNull();
    expect(offer.reason).toBe("nothing left to Learn");
  });

  it("startExtraLearn extends a DONE run with the offered ayah, and it finishes exactly like any other queue item", async () => {
    const c = corpus12();
    const started = await startSession({ surah: SURAH_12, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    const first = await playThrough(started.run, c);
    expect(first.run.done).toBe(true);

    const now2 = T0 + first.taps * 1000;
    const offer = await extraLearnOfferFor(first.run, c, now2);
    expect(offer.granted).toBe(true);
    const offeredAyah = offer.ayah!;

    const extended = startExtraLearn(first.run, c, offeredAyah);
    expect(extended.done).toBe(false);
    expect(extended.queue.length).toBe(first.run.queue.length + 1);
    expect(extended.queue[extended.cursor]!.ayah).toBe(offeredAyah);
    expect(extended.machine.ayah).toBe(offeredAyah);

    // Playing THIS through must land a real ayah_produced for the offered
    // ayah and end the run done again — Door 1 reuses the ordinary commit
    // path, not a parallel one that could drift from it (invariant #2).
    const second = await playThrough(extended, c);
    expect(second.taps).toBeGreaterThan(0);
    expect(second.run.done).toBe(true);

    const events = await getAllEvents();
    const producedForOffered = events.filter(
      (e) => e.type === "ayah_produced" && e.ayah === offeredAyah,
    );
    expect(producedForOffered.length).toBe(1);
  });
});

// v3-D106 — FR6 Door 2: `packages/engine/src/freeplay.ts#weakSpots` was real,
// pure, unit-tested since it landed alongside Door 1 (v3-D98) — that entry's
// own header named Door 2 "out of scope here" pending "a real UI surface of
// its own (a ranked list)." A learner who finished today's assembled queue
// had no way to ask "what's my weakest carried atom right now?" and drill it
// as a real, full-weight review — the exact "mechanism built and
// unit-tested, zero production callers" shape v3-D82..D105 each closed one
// instance of.
describe("v3-D106 — Door 2, 'weak-spot gym' after the assembled queue is done", () => {
  it("offers nothing before any atom is encoded — a virgin log has no weak spot to rank", async () => {
    const offer = await weakSpotOfferFor(
      { surah: SURAH, queue: [], cursor: 0, machine: {} as SessionRun["machine"], startedAt: T0, slips: 0, lastTap: null, done: true, gateSlipped: false, rescaffolding: false, structured: true },
      T0,
    );
    expect(offer).toBeNull();
  });

  it("offers the ayah once it is genuinely ENCODED — a same-day S2 Learn touch does not count", async () => {
    // blankCountFor's own contract (reconstruct.ts): the "learn" band blanks
    // exactly ONE word regardless of total, so a fresh multi-word ayah's
    // FIRST touch grades S2 (partial), never S3 — `update()` only sets
    // `encoded: true` on an "s3"/"gate" outcome. A real first session on a
    // multi-word-ayah surah therefore leaves NOTHING encoded yet, which is
    // why this seeds a genuine Carry-band S3 completion directly (the same
    // technique DEFECTS.md#B11's own test block below uses) rather than
    // assuming one naturally falls out of `playThrough`.
    const gatedAyah = 4;
    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH_12, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );
    const seeded = rebuild(await getAllEvents());
    expect(seeded.get(atomKey(SURAH_12, "ayah", gatedAyah))?.encoded).toBe(true);

    const doneRun: SessionRun = {
      surah: SURAH_12,
      queue: [],
      cursor: 0,
      machine: {} as SessionRun["machine"],
      startedAt: T0,
      slips: 0,
      lastTap: null,
      done: true,
      gateSlipped: false,
      rescaffolding: false,
      structured: true,
    };
    const offer = await weakSpotOfferFor(doneRun, T0 + 10_000);
    expect(offer).not.toBeNull();
    expect(offer!.kind).toBe("ayah");
    expect(offer!.ref).toBe(gatedAyah);
  });

  it("startWeakSpotDrill extends a DONE run with the offered ayah as a REVIEW, sized off its REAL strength, and it finishes exactly like any other queue item", async () => {
    const c = corpus12();
    const gatedAyah = 4;
    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH_12, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );

    const doneRun: SessionRun = {
      surah: SURAH_12,
      queue: [],
      cursor: 0,
      machine: {} as SessionRun["machine"],
      startedAt: T0,
      slips: 0,
      lastTap: null,
      done: true,
      gateSlipped: false,
      rescaffolding: false,
      structured: true,
    };
    const offer = await weakSpotOfferFor(doneRun, T0 + 10_000);
    expect(offer).not.toBeNull();
    const offeredAyah = offer!.ref;
    expect(offeredAyah).toBe(gatedAyah);

    const extended = await startWeakSpotDrill(doneRun, c, offeredAyah);
    expect(extended.done).toBe(false);
    expect(extended.queue.length).toBe(doneRun.queue.length + 1);
    expect(extended.queue[extended.cursor]!.kind).toBe("review");
    expect(extended.queue[extended.cursor]!.ayah).toBe(offeredAyah);
    expect(extended.machine.ayah).toBe(offeredAyah);
    // Unlike Door 1's fresh candidate (strength definitionally 0, by
    // `extraLearnGrant`'s own contract), this is a review of something
    // already encoded — the reconstruction must be sized off its REAL
    // current strength (the seeded S3 pass's own GAIN), never a hardcoded 0.
    expect(extended.machine.strength).toBeGreaterThan(0);

    const second = await playThrough(extended, c);
    expect(second.taps).toBeGreaterThan(0);
    expect(second.run.done).toBe(true);

    const events = await getAllEvents();
    const producedForOffered = events.filter(
      (e) => e.type === "ayah_produced" && e.ayah === offeredAyah,
    );
    // The seed above is the FIRST production (how the ayah became a
    // weak-spot candidate at all); the weak-spot rep is a SECOND, full-weight
    // production of the same ayah — never a free-play echo that rebuild.ts
    // silently drops (invariant #5).
    expect(producedForOffered.length).toBe(2);
    for (const e of producedForOffered) {
      expect(e.structured).toBe(true);
      expect(["S2", "S3"]).toContain(e.rung);
    }
  });
});

// FR6's diminishing-returns nudge (`packages/engine/src/freeplay.ts#diminishingReturns`)
// was real and unit-tested (`freeplay.test.ts`) since freeplay landed but had
// ZERO production callers — v3-D106's own header named it out of scope: "the
// adoption offer and the diminishing-returns nudge are deliberately NOT done —
// each needs its own UI surface." Its surface is the ONE existing place a
// learner can mass the SAME atom in a sitting: FR6 Door 2 (the weak-spot gym),
// which re-offers whichever encoded atom is riskiest, so a learner who keeps
// tapping "Practice your weakest spot" drills the same ayah again and again.
// After enough same-day reps invariant #4's ×0.35 massed-success damping means
// another rep is worth ~a third of a spaced one — `diminishingReturns` is the
// honest line that says so. `diminishingReturnsNudge` counts the fold's own
// same-learning-day structured `ayah_produced` reps of an ayah (the reconstruct
// completions the damping actually penalizes) and hands the engine's own string
// (or null) to the component — React never decides the threshold or the words.
describe("v3-D111 — FR6 diminishing-returns nudge on the Door 2 weak-spot offer", () => {
  // One structured Carry-band completion of `ayah` at `ts` — the same seed the
  // Door 2 block above uses to make an ayah a weak-spot candidate, i.e. exactly
  // one massed rep of the atom the nudge counts.
  async function seedRep(ayah: number, ts: number): Promise<void> {
    await append(
      { type: "ayah_produced", ts, tz: TZ, surah: SURAH_12, ayah, rung: "S3", structured: true } as DrillEvent,
      { now: ts, tz: TZ },
    );
  }

  const doneRun: SessionRun = {
    surah: SURAH_12,
    queue: [],
    cursor: 0,
    machine: {} as SessionRun["machine"],
    startedAt: T0,
    slips: 0,
    lastTap: null,
    done: true,
    gateSlipped: false,
    rescaffolding: false,
    structured: true,
  };

  it("returns null below the threshold — three same-day reps is not yet 'a lot'", async () => {
    const ayah = 4;
    for (let i = 0; i < 3; i++) await seedRep(ayah, T0 + i * 1000);
    const nudge = await diminishingReturnsNudge(doneRun, ayah, T0 + 10_000);
    expect(nudge).toBeNull();
  });

  it("returns the honest nudge once the same atom has been massed 4× the same learning day", async () => {
    const ayah = 4;
    for (let i = 0; i < 4; i++) await seedRep(ayah, T0 + i * 1000);
    const nudge = await diminishingReturnsNudge(doneRun, ayah, T0 + 10_000);
    expect(nudge).toMatch(/spacing/);
  });

  it("counts only the CURRENT learning day — yesterday's reps never accumulate into today's", async () => {
    const ayah = 4;
    const yesterday = T0 - 86_400_000;
    // Four reps yesterday, one today: today's count is 1, well below the floor.
    for (let i = 0; i < 4; i++) await seedRep(ayah, yesterday + i * 1000);
    await seedRep(ayah, T0);
    const nudge = await diminishingReturnsNudge(doneRun, ayah, T0 + 10_000);
    expect(nudge).toBeNull();
  });

  it("scopes to the offered ayah — massing a DIFFERENT ayah does not trip the nudge", async () => {
    const offered = 4;
    const other = 5;
    for (let i = 0; i < 4; i++) await seedRep(other, T0 + i * 1000);
    await seedRep(offered, T0 + 5000);
    const nudge = await diminishingReturnsNudge(doneRun, offered, T0 + 10_000);
    expect(nudge).toBeNull();
  });

  it("counts structured reps only — a free-play (structured:false) echo is evidence, not a graded rep the damping penalizes", async () => {
    const ayah = 4;
    for (let i = 0; i < 4; i++) {
      await append(
        { type: "ayah_produced", ts: T0 + i * 1000, tz: TZ, surah: SURAH_12, ayah, rung: "S3", structured: false } as DrillEvent,
        { now: T0 + i * 1000, tz: TZ },
      );
    }
    const nudge = await diminishingReturnsNudge(doneRun, ayah, T0 + 10_000);
    expect(nudge).toBeNull();
  });
});

// v3-D101 — the day-1 cold gate (FR3/invariant #9, gate.ts) can never actually
// be PASSED on the shipped `/session` route. `gate.ts#applyGateResult()` is
// the ONLY place `AtomState.gatePassed` is ever set true, and it is folded
// exclusively from a `gate_result` event (rebuild.ts:88-100) — but
// `answerAfterTap` in this module always emits `type: "ayah_produced"` for a
// completed reconstruction pass, regardless of whether the queue item it just
// completed was a "learn"/"review" item or a due "gate" item (`run.queue[cursor]
// .kind === "gate"`, set by `machineFor`'s own `full = q.kind === "gate"`
// clause a few lines above — read, but never checked again at commit time).
//
// Consequence, traced through the real fold: a completed gate item lands as
// an S3-rung `ayah_produced`, which `rebuild.ts`'s "rung_complete"/
// "ayah_produced" branch folds by calling `scheduleGate()` AGAIN (because
// `e.rung === "S3"`) — re-arming the SAME gate for the next learning-day
// rather than ever calling `applyGateResult()`. `gatePassed` stays `false`
// forever. Since `unlockPermitted()`'s default `gateTolerance` is 0
// (pace.ts's "steady" default), a learner who has completed one ayah's Learn
// can NEVER unlock a second ayah — every day the same cold gate reappears,
// gets "passed" from the learner's point of view, and silently re-schedules
// itself for tomorrow. This is the same shape of defect as B10 (v3-D99) and
// B2 (v3-D83): a caller re-deriving/misrouting a grading decision instead of
// using the dedicated, tested resolver — on a path nothing in this file
// exercised before tonight (grep confirms zero `gate_result`/`kind: "gate"`
// references anywhere in this file prior to this block).
describe("v3-D101 — the day-1 cold gate must actually be passable through the real session loop", () => {
  it("completing a due cold gate emits gate_result and marks the atom gatePassed, not just re-armed for tomorrow", async () => {
    const c = corpus();
    const gatedAyah = 1;

    // Seed the state a genuine Carry-band S3 completion leaves behind — the
    // SAME wire event `answerAfterTap` itself emits for a full production —
    // rather than grinding through the real spacing algorithm across many
    // simulated days to reach one naturally. `append()` is the same public,
    // production entry point every real tap commits through.
    await append(
      {
        type: "ayah_produced",
        ts: T0,
        tz: TZ,
        surah: SURAH,
        ayah: gatedAyah,
        rung: "S3",
        structured: true,
      } as DrillEvent,
      { now: T0, tz: TZ },
    );

    const seededAtoms = rebuild(await getAllEvents());
    const seededAtom = seededAtoms.get(atomKey(SURAH, "ayah", gatedAyah));
    // Confirms the seed actually exercises this test's precondition — the
    // atom is encoded with a gate due, not yet passed.
    expect(seededAtom?.encoded).toBe(true);
    expect(seededAtom?.gateDueAt).not.toBeNull();
    expect(seededAtom?.gatePassed).toBe(false);

    // Exactly one learning-day later — a normal next-day return (NOT a
    // skipped-day make-up, which scheduler.ts classifies differently: a gap
    // of >=2 learning-days routes through the "makeup" branch instead of the
    // "gate" branch). T0 is 09:00 UTC, past DEFAULT_DAY_CONFIG's 04:30
    // rollover, so T0 + 24h lands past the SAME rollover the next day —
    // exactly one learning-day later, and past the gate's Aug-12 04:30 due
    // time seeded above.
    const day2 = T0 + 86_400_000;
    const started = await startSession({ surah: SURAH, now: day2, tz: TZ }, c);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    // The assembled queue must open with the due gate (scheduler.ts's own
    // FR3 order: make-ups → gates → reviews → learn).
    const firstItem = started.run.queue[0];
    expect(firstItem?.kind).toBe("gate");
    expect(firstItem?.ayah).toBe(gatedAyah);

    const { taps } = await playThrough(started.run, c);
    expect(taps).toBeGreaterThan(0);

    // The learner completed the gate CORRECTLY — `playThrough` always taps
    // the shuffled-correct index (`correctIndexFor`, above). The wire must
    // record a PASSED cold gate.
    const events = await getAllEvents();
    const gateResults = events.filter((e) => e.type === "gate_result");
    expect(gateResults.length).toBeGreaterThan(0);
    expect(gateResults.every((e) => e.correct === true)).toBe(true);
    // The bug's exact wrong emission: a completed gate item must NEVER be
    // recorded as a second ayah_produced for the same ayah.
    const wrongEmissions = events.filter(
      (e) => e.type === "ayah_produced" && e.ayah === gatedAyah && e.ts >= day2,
    );
    expect(wrongEmissions.length).toBe(0);

    const atoms = rebuild(events);
    const atom = atoms.get(atomKey(SURAH, "ayah", gatedAyah));
    expect(atom?.gatePassed).toBe(true);
  });
});

// v3-D107 — the day-1 cold gate, once actually PASSABLE (v3-D101), still
// could never actually FAIL through the real session loop, which is the root
// cause of a second, deeper problem: `gate.ts#gateForgiveness()`/
// `demoteToLearn()` (v2-D08's forgiveness ladder) were real, unit-tested
// (gate.test.ts) and fold-safe (rebuild.test.ts's own `gate_demote` block)
// but had ZERO production callers — and could not, structurally, ever gain
// one: `AtomState.gateFails` only ever increments inside `applyGateResult`'s
// FAIL branch (gate.ts:36-41), reached only by a `gate_result` event whose
// `correct` is `false`.
//
// `advanceReconstruct` (reconstruct.ts:131-138) never advances the blank
// index on a wrong tap — a learner simply retries the SAME blank until they
// get it right, so `adv.correct` is unconditionally `true` at the moment
// `ayahProduced` fires. `answerAfterTap`'s gate branch (line ~471, prior to
// this fix) stamped `gate_result.correct: adv.correct` — always `true` — so
// a cold gate that started with a slip and was doggedly retried into
// completion was recorded as a clean pass. v2's own `pages/Gate.tsx` (the
// port source, read but never touched) got this right: a local `slipped`
// flag, set on any wrong tap during the "cold" stage, decides `passed =
// !slipped` at completion — "one pass, no partial credit... any slip fails
// the whole gate" (Gate.tsx's own header). That flag was never ported.
//
// Consequence: `gateFails` could never exceed 0 in production, so
// `gateForgiveness()` could never return anything but "cold" — not merely
// unwired, but UNREACHABLE. Fixing the slip-tracking bug is what makes the
// forgiveness ladder wireable at all; wiring `demoteOfferFor`/
// `acceptGateDemote` below is the "offer, never force, send it back to
// Learn" surface WIREFRAME.md's own "cold gate — spine of the schedule"
// section promises.
describe("v3-D107 — a slip during a due cold gate must fail the gate, not silently pass it", () => {
  it("one wrong tap anywhere in the pass, then finishing it by retrying, still records gate_result.correct:false", async () => {
    const c = corpus();
    const gatedAyah = 1;

    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );

    const day2 = T0 + 86_400_000;
    const started = await startSession({ surah: SURAH, now: day2, tz: TZ }, c);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.run.queue[0]?.kind).toBe("gate");

    // Slip on the very first blank...
    let run = started.run;
    const wrong0 = correctIndexFor(run, c) === 0 ? 1 : 0;
    run = await answerCurrent(run, c, wrong0, { now: day2 + 100, tz: TZ });
    expect(run.lastTap?.correct).toBe(false);

    // ...then recover: retry the same blank correctly, and finish every
    // remaining blank correctly too. A real learner is never locked out by
    // one slip mid-pass (advanceReconstruct just re-serves the same blank).
    let taps = 1;
    let cur = currentItem(run, c);
    while (cur && taps < 50) {
      run = await answerCurrent(run, c, correctIndexFor(run, c), {
        now: day2 + 200 + taps * 100,
        tz: TZ,
      });
      taps++;
      cur = currentItem(run, c);
    }

    const events = await getAllEvents();
    const gateResults = events.filter((e) => e.type === "gate_result" && e.ts >= day2);
    expect(gateResults.length).toBe(1);
    // THE BUG, prior to the fix: this read `true`, because only the FINAL
    // (successful) tap decided `adv.correct` — the earlier slip was invisible
    // to the wire.
    expect(gateResults[0]!.correct).toBe(false);

    const atoms = rebuild(events);
    const atom = atoms.get(atomKey(SURAH, "ayah", gatedAyah));
    expect(atom?.gatePassed).toBe(false);
    expect(atom?.gateFails).toBe(1);
  });

  it("a gate completed with zero slips still passes cleanly (no regression on the v3-D101 happy path)", async () => {
    const c = corpus();
    const gatedAyah = 1;
    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );
    const day2 = T0 + 86_400_000;
    const started = await startSession({ surah: SURAH, now: day2, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    await playThrough(started.run, c);

    // NOTE: `playThrough`'s own taps are stamped `T0 + n*1000` (a fixed small
    // offset from the SEED's T0, not from `day2`) — unlike the deliberate
    // slip test above, which drives its own taps with `day2`-based
    // timestamps. Filtering by `e.ts >= day2` here would silently exclude
    // the very event this test checks; filter by type alone, as the
    // pre-existing v3-D101 happy-path test above does.
    const events = await getAllEvents();
    const gateResults = events.filter((e) => e.type === "gate_result");
    expect(gateResults.length).toBe(1);
    expect(gateResults[0]!.correct).toBe(true);
  });
});

// v3-D107 (continued) — the forgiveness ladder's learner-facing surface:
// `demoteOfferFor` reads the SAME `gateForgiveness()` v2's `Gate.tsx` called,
// and `acceptGateDemote` commits the SAME `gate_demote` event
// `rebuild.ts`/`gate.ts#demoteToLearn` already fold correctly (proven since
// the engine port, never reachable until now).
describe("v3-D107 — gate forgiveness ladder: demoteOfferFor / acceptGateDemote", () => {
  it("offers nothing before DEMOTE_OFFER_AFTER_FAILS consecutive fails", async () => {
    const c = corpus();
    const gatedAyah = 1;
    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );
    const day2 = T0 + 86_400_000;
    const started = await startSession({ surah: SURAH, now: day2, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    expect(started.run.queue[0]?.kind).toBe("gate");

    expect(await demoteOfferFor(started.run)).toBeNull();
  });

  it("offers to send the ayah back to Learn after DEMOTE_OFFER_AFTER_FAILS consecutive gate fails, and acceptGateDemote clears its encoding", async () => {
    const c = corpus();
    const gatedAyah = 1;
    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );

    // DEMOTE_OFFER_AFTER_FAILS consecutive real cold-gate FAILS, one per
    // learning-day — the exact wire shape a real learner's repeated slips
    // now produce, per the fix above. Seeded directly via `append()` (the
    // same public, production entry point every real tap commits through),
    // rather than grinding through DEMOTE_OFFER_AFTER_FAILS full simulated
    // sessions, mirroring v3-D101/v3-D106's own seeding discipline.
    for (let day = 1; day <= DEMOTE_OFFER_AFTER_FAILS; day++) {
      await append(
        {
          type: "gate_result",
          ts: T0 + day * 86_400_000,
          tz: TZ,
          surah: SURAH,
          ayah: gatedAyah,
          rung: "S3",
          correct: false,
          structured: true,
        } as DrillEvent,
        { now: T0 + day * 86_400_000, tz: TZ },
      );
    }

    const seededAtoms = rebuild(await getAllEvents());
    const seededAtom = seededAtoms.get(atomKey(SURAH, "ayah", gatedAyah));
    expect(seededAtom?.gateFails).toBe(DEMOTE_OFFER_AFTER_FAILS);

    const dueDay = T0 + (DEMOTE_OFFER_AFTER_FAILS + 1) * 86_400_000;
    const started = await startSession({ surah: SURAH, now: dueDay, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    expect(started.run.queue[0]?.kind).toBe("gate");
    expect(started.run.queue[0]?.ayah).toBe(gatedAyah);

    const offer = await demoteOfferFor(started.run);
    expect(offer).toEqual({ ayah: gatedAyah });

    await acceptGateDemote(started.run, c, { now: dueDay + 500, tz: TZ });

    const events = await getAllEvents();
    expect(
      events.some((e) => e.type === "gate_demote" && e.ayah === gatedAyah && e.ts === dueDay + 500),
    ).toBe(true);

    // demoteToLearn's own contract (gate.test.ts): re-learned, not
    // abandoned — encoding and gate state clear, gateFails resets, nothing
    // else is touched.
    const atomsAfterDemote = rebuild(events);
    const atomAfterDemote = atomsAfterDemote.get(atomKey(SURAH, "ayah", gatedAyah));
    expect(atomAfterDemote?.encoded).toBe(false);
    expect(atomAfterDemote?.gatePassed).toBe(false);
    expect(atomAfterDemote?.gateFails).toBe(0);
  });

  it("acceptGateDemote is a no-op when the current item is not a due gate", async () => {
    const c = corpus();
    const started = await startSession({ surah: SURAH, now: T0, tz: TZ }, c);
    if (!started.ok) throw new Error("session must start");
    // A virgin log's first item is "learn", never "gate".
    expect(started.run.queue[0]?.kind).not.toBe("gate");

    const before = await getAllEvents();
    const after = await acceptGateDemote(started.run, c, { now: T0 + 500, tz: TZ });
    const events = await getAllEvents();

    expect(events.length).toBe(before.length);
    expect(events.some((e) => e.type === "gate_demote")).toBe(false);
    expect(after).toBe(started.run);
  });
});

// v3-D108 — FR9, the 2-minute floor session
// (`packages/engine/src/floor.ts#floorQueue`/`floorMinutes`).
//
// `floorQueue` was real and engine-tested (`habit.test.ts`, `e01.test.ts`)
// since it landed, but had ZERO production callers — v3-D107's own sweep
// found it and deliberately deferred it, named exactly as "needs its own
// /home CTA and a reduced-queue entry point into the session loop." This is
// that entry point: `startFloorSession` mirrors `startSession` (same
// `session_start`/resume discipline, via the shared `startFromQueue` helper)
// but sources its queue from `floorQueue` instead of `assembleQueue` — the
// smallest viable session, at most ~2 minutes, never empty once anything is
// due or encoded.
//
// `floorQueue`'s own three priorities (a due gate > the riskiest due review >
// a guaranteed-win warm-up) are ALREADY proven at the engine level; this
// block proves the WIRING — that the real session loop actually calls it,
// maps its items onto ordinary QueueItems, and that a floor session commits
// through the exact same graded path (`answerCurrent`/`settleAnswer`/
// `answerAfterTap`) an ordinary session does, never a second grading rule.
describe("v3-D108 — FR9, the 2-minute floor session (floorQueue wired into a real entry point)", () => {
  it("is unavailable (nothing-due) on a virgin log — nothing due, nothing encoded, nothing to warm up on", async () => {
    const c = corpus();
    const started = await startFloorSession({ surah: SURAH, now: T0, tz: TZ }, c);
    expect(started.ok).toBe(false);
    if (started.ok) return;
    expect(started.unavailable).toBe("nothing-due");
  });

  it("serves the due cold gate first, and completing it grades through gate_result exactly like the ordinary session", async () => {
    const c = corpus();
    const gatedAyah = 1;

    // Same seeding technique as the v3-D101 block above: the wire shape a
    // genuine Carry-band S3 completion leaves behind.
    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );

    const day2 = T0 + 86_400_000;
    const started = await startFloorSession({ surah: SURAH, now: day2, tz: TZ }, c);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    // A due gate is priority 1 in floorQueue's own ordering — it must lead a
    // floor session too, and the floor queue must stay small (never the full
    // assembled queue's shape).
    expect(started.run.queue[0]?.kind).toBe("gate");
    expect(started.run.queue[0]?.ayah).toBe(gatedAyah);
    expect(started.run.queue.length).toBeLessThanOrEqual(2);

    const { taps } = await playThrough(started.run, c);
    expect(taps).toBeGreaterThan(0);

    const events = await getAllEvents();
    const gateResults = events.filter((e) => e.type === "gate_result");
    expect(gateResults.length).toBeGreaterThan(0);
    expect(gateResults.every((e) => e.correct === true)).toBe(true);

    const atoms = rebuild(events);
    expect(atoms.get(atomKey(SURAH, "ayah", gatedAyah))?.gatePassed).toBe(true);
  });

  it("falls back to a warm-up on the strongest carried atom once its gate is already passed and nothing else is due", async () => {
    const c = corpus();
    const gatedAyah = 1;

    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );
    const day2 = T0 + 86_400_000;
    const gateStart = await startFloorSession({ surah: SURAH, now: day2, tz: TZ }, c);
    if (!gateStart.ok) throw new Error("gate floor session must start");
    await playThrough(gateStart.run, c);

    const passedAtoms = rebuild(await getAllEvents());
    expect(passedAtoms.get(atomKey(SURAH, "ayah", gatedAyah))?.gatePassed).toBe(true);

    // Immediately after (same instant): the gate is passed (no longer due)
    // and forgetting risk on a just-touched atom is ~0 (below floor.ts's own
    // 0.15 review threshold) — floorQueue's own "never empty" clause 3
    // (habit.test.ts) falls back to a warm-up on the strongest carried atom.
    const warmupStart = await startFloorSession({ surah: SURAH, now: day2, tz: TZ }, c);
    expect(warmupStart.ok).toBe(true);
    if (!warmupStart.ok) return;

    // FloorItem.kind "warmup" has no QueueItemKind of its own — it is graded
    // as an ordinary "review" (full-weight, structured:true), the same
    // "no second grading rule" discipline `startWeakSpotDrill` follows for
    // Door 2. It must NOT be a "gate" (no gate is due) and must be sized off
    // the atom's REAL strength (already encoded), never a fresh strength-0
    // "learn".
    expect(warmupStart.run.queue[0]?.kind).toBe("review");
    expect(warmupStart.run.queue[0]?.ayah).toBe(gatedAyah);
    expect(warmupStart.run.machine.strength).toBeGreaterThan(0);

    const { taps } = await playThrough(warmupStart.run, c);
    expect(taps).toBeGreaterThan(0);

    const events = await getAllEvents();
    // The warm-up rep is a SECOND production of the same ayah — never a
    // free-play echo the fold silently drops (invariant #5).
    const produced = events.filter((e) => e.type === "ayah_produced" && e.ayah === gatedAyah);
    expect(produced.length).toBe(2);
    expect(produced.every((e) => e.structured === true)).toBe(true);
  });

  it("opens with its own session_start (or resumes today's), exactly like the ordinary session loop", async () => {
    const c = corpus();
    const gatedAyah = 1;
    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );
    const day2 = T0 + 86_400_000;
    const started = await startFloorSession({ surah: SURAH, now: day2, tz: TZ }, c);
    if (!started.ok) throw new Error("floor session must start");

    const events = await getAllEvents();
    const starts = events.filter((e) => e.type === "session_start" && e.ts === day2);
    expect(starts.length).toBe(1);

    // A same-day RESUME must not emit a second session_start.
    const resumed = await startFloorSession({ surah: SURAH, now: day2 + 60_000, tz: TZ }, c);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.run.startedAt).toBe(day2);
    const afterResume = await getAllEvents();
    expect(afterResume.filter((e) => e.type === "session_start").length).toBe(1);
  });
});

// v3-D109 — the gate forgiveness ladder's REMAINING rung. v3-D107 closed
// DEFECTS.md#B12 (a cold gate could actually fail) and wired the "demote"
// half of `gate.ts#gateForgiveness()`, but explicitly left the "rescaffold"
// rung unwired, named exactly as: "wiring it here would mean a queue item
// that transitions between two ReconstructState machines mid-item, a real
// (small) state-machine extension this run chose not to make." Between
// RESCAFFOLD_AFTER_FAILS (2) and DEMOTE_OFFER_AFTER_FAILS (4) consecutive
// gate fails, v2's own `pages/Gate.tsx` (read, never touched) serves a
// LIGHTER, ungraded-for-pass/fail S2 warm-up pass FIRST — same ayah, same
// gate item — before the real full cold check: "A lighter warm-up first —
// then the real cold check." A wrong tap during the warm-up is ordinary
// reconstruct feedback, never a gate slip (`Gate.tsx`: `stage === "cold" &&
// !correct` is the only place `slipped` is ever set). Nothing in this file
// exercised the "rescaffold" branch of `gateForgiveness()` before tonight —
// grep confirms zero references to `RESCAFFOLD_AFTER_FAILS`/`rescaffolding`
// anywhere in this file prior to this block.
describe("v3-D109 — gate forgiveness ladder: the rescaffold rung (v2-D08)", () => {
  it("failing a gate RESCAFFOLD_AFTER_FAILS times serves a lighter S2 warm-up before the real cold check, and completing both cleanly still passes the gate", async () => {
    const c = corpus();
    const gatedAyah = 1;
    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );

    // RESCAFFOLD_AFTER_FAILS consecutive real cold-gate FAILS, one per
    // learning-day — seeded directly via `append()` (the same public,
    // production entry point every real tap commits through), mirroring
    // v3-D107's own seeding discipline for the demote rung.
    for (let day = 1; day <= RESCAFFOLD_AFTER_FAILS; day++) {
      await append(
        {
          type: "gate_result",
          ts: T0 + day * 86_400_000,
          tz: TZ,
          surah: SURAH,
          ayah: gatedAyah,
          rung: "S3",
          correct: false,
          structured: true,
        } as DrillEvent,
        { now: T0 + day * 86_400_000, tz: TZ },
      );
    }

    const seededAtoms = rebuild(await getAllEvents());
    const seededAtom = seededAtoms.get(atomKey(SURAH, "ayah", gatedAyah));
    expect(seededAtom?.gateFails).toBe(RESCAFFOLD_AFTER_FAILS);

    const dueDay = T0 + (RESCAFFOLD_AFTER_FAILS + 1) * 86_400_000;
    const started = await startSession({ surah: SURAH, now: dueDay, tz: TZ }, c);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.run.queue[0]?.kind).toBe("gate");
    expect(started.run.queue[0]?.ayah).toBe(gatedAyah);
    // THE assertion this test exists for: a gate at the "rescaffold" rung
    // must open in the warm-up phase, not straight into the cold check.
    expect(started.run.rescaffolding).toBe(true);

    // Drive every blank of the gate item CORRECTLY, timestamped from `dueDay`
    // forward (NOT `playThrough`'s own fixed `T0 + n*1000` offsets, which
    // would land well BEFORE `dueDay` and defeat any `e.ts >= dueDay` filter
    // below — the exact trap v3-D107's own happy-path test warns about).
    // Stops the moment the cursor leaves the gate item (index 0).
    let run = started.run;
    let cur = currentItem(run, c);
    let guard = 0;
    while (cur && run.cursor === 0 && guard < 60) {
      run = await answerCurrent(run, c, correctIndexFor(run, c), {
        now: dueDay + 100 + guard * 100,
        tz: TZ,
      });
      guard++;
      cur = currentItem(run, c);
    }
    expect(guard).toBeGreaterThan(0);
    // By the time the gate item is resolved, the warm-up phase is long over.
    expect(run.rescaffolding).toBe(false);

    const events = await getAllEvents();
    // The warm-up pass commits as an ORDINARY S2 ayah_produced — never a
    // second gate_result, and never S3 (it did not blank the whole ayah).
    const warmupProds = events.filter(
      (e) => e.type === "ayah_produced" && e.ayah === gatedAyah && e.ts >= dueDay,
    );
    expect(warmupProds.length).toBe(1);
    expect(warmupProds[0]!.rung).toBe("S2");

    // Exactly ONE gate_result — the real cold check that followed — and it
    // passed, since neither phase had a slip.
    const gateResults = events.filter((e) => e.type === "gate_result" && e.ts >= dueDay);
    expect(gateResults.length).toBe(1);
    expect(gateResults[0]!.correct).toBe(true);

    const atoms = rebuild(events);
    const atom = atoms.get(atomKey(SURAH, "ayah", gatedAyah));
    expect(atom?.gatePassed).toBe(true);
    // applyGateResult resets the forgiveness counter on a pass (gate.ts).
    expect(atom?.gateFails).toBe(0);
  });

  it("a wrong tap during the warm-up is not a gate slip — only a slip in the real cold check can fail the gate", async () => {
    const c = corpus();
    const gatedAyah = 1;
    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );
    for (let day = 1; day <= RESCAFFOLD_AFTER_FAILS; day++) {
      await append(
        {
          type: "gate_result",
          ts: T0 + day * 86_400_000,
          tz: TZ,
          surah: SURAH,
          ayah: gatedAyah,
          rung: "S3",
          correct: false,
          structured: true,
        } as DrillEvent,
        { now: T0 + day * 86_400_000, tz: TZ },
      );
    }

    const dueDay = T0 + (RESCAFFOLD_AFTER_FAILS + 1) * 86_400_000;
    const started = await startSession({ surah: SURAH, now: dueDay, tz: TZ }, c);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.run.rescaffolding).toBe(true);

    // Slip on the very first blank of the WARM-UP.
    let run = started.run;
    const wrong0 = correctIndexFor(run, c) === 0 ? 1 : 0;
    run = await answerCurrent(run, c, wrong0, { now: dueDay + 100, tz: TZ });
    expect(run.lastTap?.correct).toBe(false);
    // THE assertion this test exists for: a warm-up slip must never be
    // remembered as a gate slip.
    expect(run.gateSlipped).toBe(false);

    // Finish both the warm-up and the real cold check cleanly from here,
    // timestamped from `dueDay` forward (never `playThrough`'s own
    // `T0`-relative offsets — see the previous test's own comment).
    let cur = currentItem(run, c);
    let guard = 1;
    while (cur && run.cursor === 0 && guard < 60) {
      run = await answerCurrent(run, c, correctIndexFor(run, c), {
        now: dueDay + 200 + guard * 100,
        tz: TZ,
      });
      guard++;
      cur = currentItem(run, c);
    }

    const events = await getAllEvents();
    const gateResults = events.filter((e) => e.type === "gate_result" && e.ts >= dueDay);
    expect(gateResults.length).toBe(1);
    // Clean despite the warm-up slip — only a COLD-phase slip may fail it.
    expect(gateResults[0]!.correct).toBe(true);
  });

  it("a slip during the REAL cold check (after a clean warm-up) still fails the gate", async () => {
    const c = corpus();
    const gatedAyah = 1;
    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );
    for (let day = 1; day <= RESCAFFOLD_AFTER_FAILS; day++) {
      await append(
        {
          type: "gate_result",
          ts: T0 + day * 86_400_000,
          tz: TZ,
          surah: SURAH,
          ayah: gatedAyah,
          rung: "S3",
          correct: false,
          structured: true,
        } as DrillEvent,
        { now: T0 + day * 86_400_000, tz: TZ },
      );
    }

    const dueDay = T0 + (RESCAFFOLD_AFTER_FAILS + 1) * 86_400_000;
    const started = await startSession({ surah: SURAH, now: dueDay, tz: TZ }, c);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    // Finish the warm-up cleanly, one tap at a time, until the machine
    // transitions to the real cold check (`rescaffolding` flips to false).
    let run = started.run;
    let guard = 0;
    while (run.rescaffolding && guard < 50) {
      run = await answerCurrent(run, c, correctIndexFor(run, c), {
        now: dueDay + 100 + guard * 100,
        tz: TZ,
      });
      guard++;
    }
    expect(run.rescaffolding).toBe(false);
    expect(run.queue[run.cursor]?.kind).toBe("gate");

    // Now slip once during the REAL cold check.
    const wrong0 = correctIndexFor(run, c) === 0 ? 1 : 0;
    run = await answerCurrent(run, c, wrong0, { now: dueDay + 5_000, tz: TZ });
    expect(run.gateSlipped).toBe(true);

    // Recover by retrying every remaining blank correctly, timestamped from
    // `dueDay` forward (never `playThrough`'s own `T0`-relative offsets).
    let cur = currentItem(run, c);
    let guard2 = 1;
    while (cur && run.cursor === 0 && guard2 < 60) {
      run = await answerCurrent(run, c, correctIndexFor(run, c), {
        now: dueDay + 6_000 + guard2 * 100,
        tz: TZ,
      });
      guard2++;
      cur = currentItem(run, c);
    }

    const events = await getAllEvents();
    const gateResults = events.filter((e) => e.type === "gate_result" && e.ts >= dueDay);
    expect(gateResults.length).toBe(1);
    expect(gateResults[0]!.correct).toBe(false);

    const atoms = rebuild(events);
    const atom = atoms.get(atomKey(SURAH, "ayah", gatedAyah));
    expect(atom?.gatePassed).toBe(false);
    // One MORE fail on top of the two seeded — the ladder keeps counting,
    // never silently caps.
    expect(atom?.gateFails).toBe(RESCAFFOLD_AFTER_FAILS + 1);
  });

  it("an ordinary cold gate (fewer than RESCAFFOLD_AFTER_FAILS fails) opens straight into the cold check, exactly as before", async () => {
    const c = corpus();
    const gatedAyah = 1;
    await append(
      { type: "ayah_produced", ts: T0, tz: TZ, surah: SURAH, ayah: gatedAyah, rung: "S3", structured: true } as DrillEvent,
      { now: T0, tz: TZ },
    );
    const day2 = T0 + 86_400_000;
    const started = await startSession({ surah: SURAH, now: day2, tz: TZ }, c);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.run.queue[0]?.kind).toBe("gate");
    expect(started.run.rescaffolding).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// STEP 20 — the continuous drill can actually START, and honours its mode.
// ---------------------------------------------------------------------------
// `/drill`'s picker (`components/drill/DrillPicker.tsx`) rendered a live
// preview — what would be drilled, how long, and what a slip costs — but had
// NO Start button and no handoff into the session loop, so build-plan step 20
// dead-ended one tap short of drilling anything. Worse, the picker's own
// "Victory lap — nothing can be damaged" radio was a claim with nothing behind
// it: every emit site in this module hardcoded `structured: true`, so the
// `structured:false` free-play path the victory lap needs (invariant #5 /
// `update.ts:71`'s structured guard) had zero production reach. These tests
// pin both halves: a drill can start over a chosen set of ayat, and a
// victory-lap drill damages nothing because its taps AND its `ayah_produced`
// carry `structured:false` and the fold leaves the atom untouched.
describe("step 20 — startDrillSession over a chosen range, graded vs victory-lap", () => {
  // Seed a drillable (ENCODED) ayah by appending its whole-ayah S3
  // `ayah_produced` — the SAME public `append()` a real Carry-band completion
  // uses, never a fabricated internal atom shape. `update.ts:118` sets
  // `encoded` on an s3/gate outcome, which is exactly what makes an ayah
  // reachable by the drill (a not-yet-encoded ayah is a guess, not a
  // retrieval — `lib/drill/preview.ts`'s own gap guard).
  async function seedEncoded(surah: number, ayah: number, ts: number) {
    await append(
      { type: "ayah_produced", ts, tz: TZ, surah, ayah, rung: "S3", structured: true } as DrillEvent,
      { now: ts, tz: TZ },
    );
  }

  it("drills only the ENCODED ayat in the selection, in ascending order", async () => {
    const c = corpus();
    // Encode 3 then 1 (out of order); leave 2 and 4 un-encoded.
    await seedEncoded(SURAH, 3, T0);
    await seedEncoded(SURAH, 1, T0 + 1000);

    // Pass the selection DESCENDING to prove the queue is sorted, not merely
    // echoed, and that the un-encoded 2/4 are dropped rather than drilled
    // (drilling an un-encoded ayah would grade a guess).
    const started = await startDrillSession(
      { surah: SURAH, now: T0 + 2000, tz: TZ, ayat: [4, 3, 2, 1], structured: true },
      c,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.run.queue.map((q) => q.ayah)).toEqual([1, 3]);
    expect(started.run.queue.every((q) => q.kind === "review")).toBe(true);
    expect(started.run.structured).toBe(true);
  });

  it("returns 'none-ready' when nothing in the selection has been encoded", async () => {
    const c = corpus();
    // A fresh log: no ayah is encoded, so there is nothing to drill. This is
    // NOT "no corpus" and NOT "nothing due" — a learner picked a real range,
    // but none of it is ready. Its own reason so the view can say so.
    const started = await startDrillSession(
      { surah: SURAH, now: T0, tz: TZ, ayat: [1, 2, 3, 4], structured: true },
      c,
    );
    expect(started.ok).toBe(false);
    if (started.ok) return;
    expect(started.unavailable).toBe("none-ready");
  });

  it("a GRADED drill logs fold-graded (structured) events", async () => {
    const c = corpus();
    await seedEncoded(SURAH, 1, T0);
    const before = await getAllEvents();
    const beforeIds = new Set(before.map((e) => e.id));

    const started = await startDrillSession(
      { surah: SURAH, now: T0 + 1000, tz: TZ, ayat: [1], structured: true },
      c,
    );
    if (!started.ok) throw new Error("a graded drill of an encoded ayah must start");
    await playThrough(started.run, c);

    const after = await getAllEvents();
    const fresh = after.filter((e) => !beforeIds.has(e.id));
    const produced = fresh.filter((e) => e.type === "ayah_produced");
    const taps = fresh.filter((e) => e.type === "reconstruct_tap");
    expect(produced.length).toBeGreaterThan(0);
    expect(taps.length).toBeGreaterThan(0);
    // Graded ⇒ structured is never false (absent counts as structured).
    expect(produced.every((e) => e.structured !== false)).toBe(true);
    expect(taps.every((e) => e.structured !== false)).toBe(true);
  });

  it("a VICTORY-LAP drill damages NOTHING: taps and ayah_produced are structured:false and the fold leaves strength unchanged", async () => {
    const c = corpus();
    await seedEncoded(SURAH, 1, T0);
    const seeded = await getAllEvents();
    const seededIds = new Set(seeded.map((e) => e.id));
    const strengthBefore = rebuild(seeded).get(atomKey(SURAH, "ayah", 1))?.strength;
    expect(typeof strengthBefore).toBe("number");

    const started = await startDrillSession(
      { surah: SURAH, now: T0 + 1000, tz: TZ, ayat: [1], structured: false },
      c,
    );
    if (!started.ok) throw new Error("a victory-lap drill of an encoded ayah must start");
    expect(started.run.structured).toBe(false);
    await playThrough(started.run, c);

    const after = await getAllEvents();
    const fresh = after.filter((e) => !seededIds.has(e.id));
    const produced = fresh.filter((e) => e.type === "ayah_produced");
    const taps = fresh.filter((e) => e.type === "reconstruct_tap");
    expect(produced.length).toBeGreaterThan(0);
    expect(taps.length).toBeGreaterThan(0);
    // The load-bearing half: every drill event this run wrote is free-play.
    expect(produced.every((e) => e.structured === false)).toBe(true);
    expect(taps.every((e) => e.structured === false)).toBe(true);
    // …and because the fold's structured guard (`update.ts:71`) drops them,
    // the atom's strength is byte-identical to before the victory lap — the
    // "nothing can be damaged" promise the picker's radio makes.
    const strengthAfter = rebuild(after).get(atomKey(SURAH, "ayah", 1))?.strength;
    expect(strengthAfter).toBe(strengthBefore);
  });

  it("a WRONG tap during a victory lap still damages nothing (errors carry full weight ONLY when structured)", async () => {
    const c = corpus();
    await seedEncoded(SURAH, 1, T0);
    const strengthBefore = rebuild(await getAllEvents()).get(atomKey(SURAH, "ayah", 1))?.strength;

    const started = await startDrillSession(
      { surah: SURAH, now: T0 + 1000, tz: TZ, ayat: [1], structured: false },
      c,
    );
    if (!started.ok) throw new Error("victory-lap drill must start");

    // One deliberate wrong tap, then finish correctly. A wrong tap does not
    // advance (the learner retries), so the run still completes.
    const correct = correctIndexFor(started.run, c);
    const wrong = correct === 0 ? 1 : 0;
    const afterWrong = await answerCurrent(started.run, c, wrong, { now: T0 + 1500, tz: TZ });
    await playThrough(afterWrong, c);

    const after = await getAllEvents();
    const wrongTaps = after.filter(
      (e) => e.type === "reconstruct_tap" && e.correct === false && e.ts >= T0 + 1000,
    );
    expect(wrongTaps.length).toBeGreaterThan(0);
    expect(wrongTaps.every((e) => e.structured === false)).toBe(true);
    const strengthAfter = rebuild(after).get(atomKey(SURAH, "ayah", 1))?.strength;
    expect(strengthAfter).toBe(strengthBefore);
  });
});

describe("v3-D117 — FR6 Door 3, 'open practice' (any ayah × chosen difficulty)", () => {
  // A single S3 completion only reaches ~26 strength from a fresh atom
  // (update.ts: GAIN.s3=30 × diffFactor≈0.88, initial difficulty 0.3) — well
  // inside "learn" band (<40), NOT "carry" (>=80). `encoded` flips true on
  // the FIRST S3 success regardless of strength (update.ts:118), which is all
  // step 20's own `seedEncoded` needed — but the "S2 still blanks only part"
  // test below needs a genuinely CARRY-band atom to prove anything: a
  // strength-0 atom's ordinary "learn" band ALSO blanks only part (1 word),
  // which would pass whether or not the override actually happened. This
  // seeds real, well-spaced (never same-learning-day, so never damped ×0.35)
  // S3 completions until the real fold reports carry band, confirming its
  // own precondition rather than assuming a rep count reaches it.
  async function seedEncoded(surah: number, ayah: number, ts: number) {
    await append(
      { type: "ayah_produced", ts, tz: TZ, surah, ayah, rung: "S3", structured: true } as DrillEvent,
      { now: ts, tz: TZ },
    );
  }

  async function seedCarryBand(
    surah: number,
    ayah: number,
    startTs: number,
  ): Promise<{ strength: number; lastTs: number }> {
    let ts = startTs;
    for (let i = 0; i < 20; i++) {
      await seedEncoded(surah, ayah, ts);
      const strength =
        rebuild(await getAllEvents()).get(atomKey(surah, "ayah", ayah))?.strength ?? 0;
      if (strength >= 80) return { strength, lastTs: ts };
      ts += 2 * 24 * 60 * 60 * 1000; // 2 days apart — never the same learning day
    }
    throw new Error("test precondition broken: could not reach carry band in 20 reps");
  }

  it("starts on an UNTAUGHT ayah (no atom exists yet) — this is the whole point of open practice", async () => {
    const c = corpus();
    const started = await startOpenPractice(
      { surah: SURAH, now: T0, tz: TZ, ayah: 2, drill: "S2" },
      c,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.run.queue).toEqual([
      { kind: "review", atomKey: atomKey(SURAH, "ayah", 2), ayah: 2, estMin: 0 },
    ]);
    // Free play, unconditionally — Door 3 has no graded option.
    expect(started.run.structured).toBe(false);
  });

  it("'S3' forces WHOLE-ayah blanking, regardless of the atom's real (unseen) strength", async () => {
    const c = corpus();
    const started = await startOpenPractice(
      { surah: SURAH, now: T0, tz: TZ, ayah: 1, drill: "S3" },
      c,
    );
    if (!started.ok) throw new Error("open practice on an untaught ayah must start");
    // An ORDINARY review of a never-seen atom (band "learn") would blank only
    // 1 word — `reconstruct.ts#blankCountFor`. Full blanking here proves the
    // chosen difficulty overrode the real (absent) strength, not merely that
    // a fresh atom happens to look full.
    expect(started.run.machine.blankPositions.length).toBe(started.run.machine.words.length);
  });

  it("'S2' blanks only PART of the ayah, even when the atom is already CARRY-band strong", async () => {
    const c = corpus12();
    const ayah = 1;
    const { strength: strengthBefore, lastTs } = await seedCarryBand(SURAH_12, ayah, T0);
    expect(strengthBefore).toBeGreaterThanOrEqual(80); // carry band, confirmed for real

    const started = await startOpenPractice(
      { surah: SURAH_12, now: lastTs + 1000, tz: TZ, ayah, drill: "S2" },
      c,
    );
    if (!started.ok) throw new Error("open practice on an encoded ayah must start");
    const { blankPositions, words } = started.run.machine;
    // An ORDINARY review of this SAME atom (band "carry") would blank the
    // WHOLE ayah — `blankCountFor`'s own carry branch returns `total`. A
    // strictly partial count here proves "S2" overrode the real strength
    // rather than reading it.
    expect(words.length).toBeGreaterThan(2); // a vacuous "half of 1 or 2" would prove nothing
    expect(blankPositions.length).toBeGreaterThan(0);
    expect(blankPositions.length).toBeLessThan(words.length);
  });

  it("rejects an ayah that does not exist in the corpus, honestly — never 'none-ready'", async () => {
    const c = corpus();
    const started = await startOpenPractice(
      { surah: SURAH, now: T0, tz: TZ, ayah: 9999, drill: "S3" },
      c,
    );
    expect(started.ok).toBe(false);
    if (started.ok) return;
    expect(started.unavailable).toBe("invalid-ayah");
  });

  it("completing a pass on an UNTAUGHT ayah damages nothing: structured:false and the atom stays un-encoded", async () => {
    const c = corpus();
    const ayah = 3;
    const before = await getAllEvents();
    const beforeIds = new Set(before.map((e) => e.id));

    const started = await startOpenPractice(
      { surah: SURAH, now: T0, tz: TZ, ayah, drill: "S3" },
      c,
    );
    if (!started.ok) throw new Error("open practice on an untaught ayah must start");
    await playThrough(started.run, c);

    const after = await getAllEvents();
    const fresh = after.filter((e) => !beforeIds.has(e.id));
    const produced = fresh.filter((e) => e.type === "ayah_produced");
    const taps = fresh.filter((e) => e.type === "reconstruct_tap");
    expect(produced.length).toBeGreaterThan(0);
    expect(taps.length).toBeGreaterThan(0);
    expect(produced.every((e) => e.structured === false)).toBe(true);
    expect(taps.every((e) => e.structured === false)).toBe(true);
    // The fold's structured guard (`update.ts:71`) drops every free-play
    // outcome, so an ayah practiced but never actually taught stays
    // un-encoded — a Door 3 pass, however "hard" and however cleanly
    // completed, cannot silently teach it. (That is exactly what
    // `coldSuccessAdoption` exists to offer as a deliberate, separate,
    // tap-gated step — still unwired, out of this run's scope.)
    const atom = rebuild(after).get(atomKey(SURAH, "ayah", ayah));
    expect(atom?.encoded ?? false).toBe(false);
  });

  it("completing a pass on an already-encoded ayah leaves its strength byte-identical", async () => {
    const c = corpus12();
    const ayah = 2;
    await seedEncoded(SURAH_12, ayah, T0);
    const seeded = await getAllEvents();
    const seededIds = new Set(seeded.map((e) => e.id));
    const strengthBefore = rebuild(seeded).get(atomKey(SURAH_12, "ayah", ayah))?.strength;
    expect(typeof strengthBefore).toBe("number");

    const started = await startOpenPractice(
      { surah: SURAH_12, now: T0 + 1000, tz: TZ, ayah, drill: "S3" },
      c,
    );
    if (!started.ok) throw new Error("open practice on an encoded ayah must start");
    await playThrough(started.run, c);

    const after = await getAllEvents();
    const fresh = after.filter((e) => !seededIds.has(e.id));
    expect(fresh.some((e) => e.type === "ayah_produced")).toBe(true);
    const strengthAfter = rebuild(after).get(atomKey(SURAH_12, "ayah", ayah))?.strength;
    expect(strengthAfter).toBe(strengthBefore);
  });
});
