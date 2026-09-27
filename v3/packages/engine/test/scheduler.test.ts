import { describe, expect, it } from "vitest";
import { initAtom, type AtomState } from "../src/atom.ts";
import { scheduleGate } from "../src/gate.ts";
import { assembleQueue, makeupDeferredCount, MAKEUP_CAP } from "../src/scheduler.ts";
import { DEFAULT_DAY_CONFIG } from "../src/daybound.ts";

const DAY = 86_400_000;
// UTC wall clock — matches DEFAULT_DAY_CONFIG.tz, which every test here passes.
// A machine-local constructor would make these assertions offset-dependent.
function atUtc(y: number, mo: number, d: number, h: number): number {
  return Date.UTC(y, mo - 1, d, h, 0, 0, 0);
}
const wordCounts = new Map<number, number>([[4, 15], [5, 12], [6, 20]]);

function encoded(ref: number, opts: Partial<AtomState> = {}): AtomState {
  return { ...initAtom(12, "ayah", ref), encoded: true, gatePassed: true, strength: 60, stability: 4, lastRetrieval: atUtc(2026, 7, 10, 8), ...opts };
}

describe("assembleQueue (FR3 order)", () => {
  const now = atUtc(2026, 7, 14, 8);

  it("gates come before new Learn, and Learn is blocked while a gate is due", () => {
    // ayah 4 encoded yesterday, gate due today (not passed) → blocks unlock.
    const gated = scheduleGate({ ...initAtom(12, "ayah", 4), encoded: true }, atUtc(2026, 7, 13, 20), DEFAULT_DAY_CONFIG);
    const q = assembleQueue({
      surah: 12,
      atoms: [gated],
      now,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, learnCandidates: [5], budgetMin: 8 },
    });
    const kinds = q.map((i) => i.kind);
    expect(kinds).toContain("gate");
    expect(kinds).not.toContain("learn"); // unlock blocked by the due gate
    // gate precedes everything
    expect(q[0]!.kind).toBe("gate");
  });

  it("permits Learn once no gate is due, respecting the time budget", () => {
    const q = assembleQueue({
      surah: 12,
      atoms: [encoded(4)],
      now,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, learnCandidates: [5, 6], budgetMin: 8 },
    });
    expect(q.some((i) => i.kind === "learn")).toBe(true);
    // never exceeds budget
    const total = q.reduce((s, i) => s + i.estMin, 0);
    expect(total).toBeLessThanOrEqual(8 + 0.001);
  });

  it("ranks a due connection above an equal-risk ayah (connection weighted up)", () => {
    const t = atUtc(2026, 7, 8, 8); // decayed a few days
    const ayah: AtomState = { ...encoded(4), lastRetrieval: t, stability: 3 };
    const conn: AtomState = { ...initAtom(12, "connection", 4), encoded: true, gatePassed: true, strength: 60, stability: 3, lastRetrieval: t };
    const q = assembleQueue({
      surah: 12,
      atoms: [ayah, conn],
      now,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8, connectionWeight: 1.5 },
    });
    const reviews = q.filter((i) => i.kind === "review");
    expect(reviews[0]!.atomKey).toBe("12:connection:4"); // weighted up → ranks first
  });

  it("a missed day produces make-up items that are never dropped by the budget", () => {
    // gate came due on a skipped day; user returns two days later with a tight budget.
    const gated = scheduleGate({ ...initAtom(12, "ayah", 4), encoded: true }, atUtc(2026, 7, 12, 20), DEFAULT_DAY_CONFIG);
    const q = assembleQueue({
      surah: 12,
      atoms: [gated],
      now: atUtc(2026, 7, 15, 8), // returned after missing the 14th
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 0.1 }, // absurdly tight
    });
    // make-up/gate survive even a near-zero budget (session stays finishable).
    expect(q.some((i) => i.kind === "makeup" || i.kind === "gate")).toBe(true);
  });

  it("session is always finishable: mandatory items present even at budget 0", () => {
    const gated = scheduleGate({ ...initAtom(12, "ayah", 4), encoded: true }, atUtc(2026, 7, 13, 20), DEFAULT_DAY_CONFIG);
    const q = assembleQueue({
      surah: 12,
      atoms: [gated],
      now,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 0 },
    });
    expect(q.length).toBeGreaterThan(0);
  });
});

// v3-D256 — FR5 "makeup" / edge case #70 ("Churned learner returns after
// months... queue explosion; makeup caps queue + says what deferred") and
// #98 ("Returning after weeks... makeup messaging says what was deferred").
//
// Before this fix, step 1's make-up merge folded EVERY gate due on a skipped
// day into `mandatory` items the budget fit (step 4) may never drop — so a
// learner who skipped three weeks got every one of those gates in one
// sitting, the exact "queue explosion" #70 names. `MAKEUP_CAP` bounds it;
// `makeupDeferredCount` reports the honest overflow off the SAME candidate
// list, so the two can never disagree about which atoms qualify.
//
// v3-D260 (DEFECTS.md#B16's own "Still open" note) retired the
// `lastActiveDay`-based classification these tests originally exercised: a
// gate qualifies purely by its own `gateDueAt` against the START of TODAY's
// learning-day, with no second timestamp to hardcode wrong or let go stale.
describe("FR5 makeup cap (v3-D256/D260, edge case #70/#98)", () => {
  const now = atUtc(2026, 7, 20, 8);

  // Six ayat, each encoded (and its gate scheduled) on its own, distinct day
  // — six genuinely separate skipped-day debts, oldest (ayah 1) first.
  function sixMissedGates(): AtomState[] {
    return [1, 2, 3, 4, 5, 6].map((ayah) =>
      scheduleGate(
        { ...initAtom(12, "ayah", ayah), encoded: true },
        atUtc(2026, 7, 1 + ayah, 20),
        DEFAULT_DAY_CONFIG,
      ),
    );
  }

  it("caps the make-up items a session's own queue carries at MAKEUP_CAP", () => {
    const atoms = sixMissedGates();
    const q = assembleQueue({
      surah: 12,
      atoms,
      now,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8 },
    });
    const makeups = q.filter((i) => i.kind === "makeup");
    expect(makeups.length).toBe(MAKEUP_CAP);
    // Oldest debt first — the earliest-missed gates are the ones a session
    // actually works through, never an arbitrary array-order subset.
    expect(makeups.map((i) => i.ayah)).toEqual([1, 2, 3]);
  });

  // v3-D259 — v3-D256's cap counted only `kind === "makeup"`, and every test
  // above did too, so nobody noticed that step 2 (GATES) re-admitted the
  // DEFERRED missed gates as ordinary mandatory "gate" items (they are all
  // `gateDue`): the queue still carried the whole backlog, just relabelled.
  // A deferred gate must be genuinely absent from this session's queue.
  it("a deferred missed gate is NOT re-admitted as an ordinary gate — the cap bounds the whole queue", () => {
    const atoms = sixMissedGates();
    const q = assembleQueue({
      surah: 12,
      atoms,
      now,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8 },
    });
    expect(q.filter((i) => i.kind === "gate")).toEqual([]);
    const mandatory = q.filter((i) => i.kind === "gate" || i.kind === "makeup");
    expect(mandatory.map((i) => i.ayah)).toEqual([1, 2, 3]);
    // The deferred ones (4, 5, 6) appear nowhere in this session.
    expect(q.some((i) => i.ayah >= 4)).toBe(false);
  });

  it("the deferred count equals exactly the missed gates absent from the queue", () => {
    const atoms = sixMissedGates();
    const q = assembleQueue({
      surah: 12,
      atoms,
      now,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8 },
    });
    const queuedAyat = new Set(q.map((i) => i.ayah));
    const absent = atoms.filter((a) => !queuedAyat.has(a.ref)).length;
    expect(makeupDeferredCount(atoms, 12, now)).toBe(absent);
  });

  it("makeupDeferredCount reports exactly the overflow the queue itself deferred", () => {
    const atoms = sixMissedGates();
    expect(makeupDeferredCount(atoms, 12, now)).toBe(6 - MAKEUP_CAP);
  });

  it("the cap is overridable via cfg.makeupCap, and both readers agree", () => {
    const atoms = sixMissedGates();
    const q = assembleQueue({
      surah: 12,
      atoms,
      now,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8, makeupCap: 5 },
    });
    expect(q.filter((i) => i.kind === "makeup").length).toBe(5);
    expect(makeupDeferredCount(atoms, 12, now, { cap: 5 })).toBe(1);
  });

  it("reports zero deferred when nothing exceeds the cap", () => {
    const atoms = sixMissedGates().slice(0, 2); // only 2, well under MAKEUP_CAP
    const q = assembleQueue({
      surah: 12,
      atoms,
      now,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8 },
    });
    expect(q.filter((i) => i.kind === "makeup").length).toBe(2);
    expect(makeupDeferredCount(atoms, 12, now)).toBe(0);
  });

  // v3-D260 — a gate due EXACTLY today (the ordinary, ever-present next-day
  // case) is never backlog, regardless of whether the learner has ANY prior
  // activity on record at all — there is no longer a `lastActiveDay` input
  // this could even be gated on.
  it("reports zero for a gate due exactly today — not overdue from a prior day at all", () => {
    const dueToday = scheduleGate(
      { ...initAtom(12, "ayah", 1), encoded: true },
      atUtc(2026, 7, 19, 20), // encoded yesterday evening
      DEFAULT_DAY_CONFIG,
    );
    const q = assembleQueue({
      surah: 12,
      atoms: [dueToday],
      now: atUtc(2026, 7, 20, 8), // today — the gate's own due day
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8 },
    });
    expect(q.filter((i) => i.kind === "makeup")).toEqual([]);
    expect(q.some((i) => i.kind === "gate")).toBe(true);
    expect(makeupDeferredCount([dueToday], 12, atUtc(2026, 7, 20, 8))).toBe(0);
  });

  it("never counts a different surah's atoms (E-01/E-02 scoping)", () => {
    const otherSurah = sixMissedGates().map((a) => ({ ...a, surah: 67 }));
    expect(makeupDeferredCount(otherSurah, 12, now)).toBe(0);
  });
});

// v3-D260 (DEFECTS.md#B16's own "Still open" note) — before this fix, the
// cap only ever bit on the FIRST post-gap assembly: `assembleQueue`'s make-up
// step was gated on `daysBetween(lastActiveDay, now) >= 2`, and completing
// even a capped session wrote fresh graded events "now", so the VERY NEXT
// assembly's gap read under 2 learning-days and skipped step 1 entirely —
// every atom still overdue from before the cap was spent flowed through
// step 2 as an ordinary mandatory "gate", uncapped, the rest of the whole
// backlog in one further sitting rather than "a piece at a time"
// (v3-D256's own wording). The fix reads only each atom's own `gateDueAt`
// against today's `dayStart`, which stays true no matter how many sessions
// in a row have already run today or yesterday.
describe("v3-D260 — the make-up cap keeps biting across consecutive sessions, not only the first", () => {
  // Nine ayat, each with its own distinct skipped-day debt — three full
  // cap-widths of backlog, so a SECOND capped session is still observably
  // capped rather than merely "empty because everything already fit".
  function nineMissedGates(): AtomState[] {
    return Array.from({ length: 9 }, (_, i) => i + 1).map((ayah) =>
      scheduleGate(
        { ...initAtom(12, "ayah", ayah), encoded: true },
        atUtc(2026, 7, 1 + ayah, 20),
        DEFAULT_DAY_CONFIG,
      ),
    );
  }

  it("a session immediately following a capped one still defers past MAKEUP_CAP, not the whole remaining backlog", () => {
    const now = atUtc(2026, 7, 20, 8);
    const atoms = nineMissedGates();

    // Session 1: caps at 3 (ayat 1-3), defers 6 (ayat 4-9).
    const first = assembleQueue({
      surah: 12,
      atoms,
      now,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8 },
    });
    expect(first.filter((i) => i.kind === "makeup").map((i) => i.ayah)).toEqual([1, 2, 3]);
    expect(makeupDeferredCount(atoms, 12, now)).toBe(6);

    // The learner passes all 3 of today's make-up gates — the ONLY state
    // change a completed session produces on these atoms.
    const afterFirst = atoms.map((a) =>
      first.some((i) => i.kind === "makeup" && i.ayah === a.ref) ? { ...a, gatePassed: true } : a,
    );

    // Session 2, the VERY NEXT learning-day — under the old `lastActiveDay`
    // gap gate this reads as an ordinary (non-churned) return, since a
    // graded event was just committed "now"; the old code would have let
    // all 6 remaining atoms (4-9) through step 2 as ordinary mandatory
    // gates. The fix caps this session identically to the first.
    const secondNow = atUtc(2026, 7, 21, 8);
    const second = assembleQueue({
      surah: 12,
      atoms: afterFirst,
      now: secondNow,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8 },
    });
    expect(second.filter((i) => i.kind === "gate")).toEqual([]);
    expect(second.filter((i) => i.kind === "makeup").map((i) => i.ayah)).toEqual([4, 5, 6]);
    expect(second.some((i) => i.ayah >= 7)).toBe(false);
    expect(makeupDeferredCount(afterFirst, 12, secondNow)).toBe(3);

    // Session 3 clears the last of the backlog.
    const afterSecond = afterFirst.map((a) =>
      second.some((i) => i.kind === "makeup" && i.ayah === a.ref) ? { ...a, gatePassed: true } : a,
    );
    const thirdNow = atUtc(2026, 7, 22, 8);
    const third = assembleQueue({
      surah: 12,
      atoms: afterSecond,
      now: thirdNow,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8 },
    });
    expect(third.filter((i) => i.kind === "makeup").map((i) => i.ayah)).toEqual([7, 8, 9]);
    expect(makeupDeferredCount(afterSecond, 12, thirdNow)).toBe(0);
  });
});
