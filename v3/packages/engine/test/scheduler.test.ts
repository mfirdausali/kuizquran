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
      lastActiveDay: atUtc(2026, 7, 13, 8),
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
      lastActiveDay: atUtc(2026, 7, 13, 8),
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
      lastActiveDay: atUtc(2026, 7, 13, 8),
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
      lastActiveDay: atUtc(2026, 7, 13, 8),
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
      lastActiveDay: atUtc(2026, 7, 13, 8),
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
describe("FR5 makeup cap (v3-D256, edge case #70/#98)", () => {
  const lastActiveDay = atUtc(2026, 7, 1, 8);
  const now = atUtc(2026, 7, 20, 8);

  // Six ayat, each encoded (and its gate scheduled) on its own, distinct day
  // strictly after `lastActiveDay` — six genuinely separate skipped-day
  // debts, oldest (ayah 1) first.
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
      lastActiveDay,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8 },
    });
    const makeups = q.filter((i) => i.kind === "makeup");
    expect(makeups.length).toBe(MAKEUP_CAP);
    // Oldest debt first — the earliest-missed gates are the ones a session
    // actually works through, never an arbitrary array-order subset.
    expect(makeups.map((i) => i.ayah)).toEqual([1, 2, 3]);
  });

  it("makeupDeferredCount reports exactly the overflow the queue itself deferred", () => {
    const atoms = sixMissedGates();
    expect(makeupDeferredCount(atoms, 12, now, lastActiveDay)).toBe(6 - MAKEUP_CAP);
  });

  it("the cap is overridable via cfg.makeupCap, and both readers agree", () => {
    const atoms = sixMissedGates();
    const q = assembleQueue({
      surah: 12,
      atoms,
      now,
      lastActiveDay,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8, makeupCap: 5 },
    });
    expect(q.filter((i) => i.kind === "makeup").length).toBe(5);
    expect(makeupDeferredCount(atoms, 12, now, lastActiveDay, { cap: 5 })).toBe(1);
  });

  it("reports zero deferred when nothing exceeds the cap", () => {
    const atoms = sixMissedGates().slice(0, 2); // only 2, well under MAKEUP_CAP
    const q = assembleQueue({
      surah: 12,
      atoms,
      now,
      lastActiveDay,
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8 },
    });
    expect(q.filter((i) => i.kind === "makeup").length).toBe(2);
    expect(makeupDeferredCount(atoms, 12, now, lastActiveDay)).toBe(0);
  });

  it("reports zero for an ordinary next-day return — not a skipped-day gap at all", () => {
    const atoms = sixMissedGates();
    const yesterday = atUtc(2026, 7, 19, 8); // < 2 learning-days before `now`
    expect(makeupDeferredCount(atoms, 12, now, yesterday)).toBe(0);
  });

  it("reports zero when there is no prior activity to compare against", () => {
    const atoms = sixMissedGates();
    expect(makeupDeferredCount(atoms, 12, now, null)).toBe(0);
  });

  it("never counts a different surah's atoms (E-01/E-02 scoping)", () => {
    const otherSurah = sixMissedGates().map((a) => ({ ...a, surah: 67 }));
    expect(makeupDeferredCount(otherSurah, 12, now, lastActiveDay)).toBe(0);
  });
});
