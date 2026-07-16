import { describe, expect, it } from "vitest";
import { initAtom, type AtomState } from "../src/atom.ts";
import { scheduleGate } from "../src/gate.ts";
import { assembleQueue } from "../src/scheduler.ts";
import { DEFAULT_DAY_CONFIG } from "../src/daybound.ts";

const DAY = 86_400_000;
function local(y: number, mo: number, d: number, h: number): number {
  return new Date(y, mo - 1, d, h, 0, 0, 0).getTime();
}
const wordCounts = new Map<number, number>([[4, 15], [5, 12], [6, 20]]);

function encoded(ref: number, opts: Partial<AtomState> = {}): AtomState {
  return { ...initAtom("ayah", ref), encoded: true, gatePassed: true, strength: 60, stability: 4, lastRetrieval: local(2026, 7, 10, 8), ...opts };
}

describe("assembleQueue (FR3 order)", () => {
  const now = local(2026, 7, 14, 8);

  it("gates come before new Learn, and Learn is blocked while a gate is due", () => {
    // ayah 4 encoded yesterday, gate due today (not passed) → blocks unlock.
    const gated = scheduleGate({ ...initAtom("ayah", 4), encoded: true }, local(2026, 7, 13, 20), DEFAULT_DAY_CONFIG);
    const q = assembleQueue({
      atoms: [gated],
      now,
      lastActiveDay: local(2026, 7, 13, 8),
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
      atoms: [encoded(4)],
      now,
      lastActiveDay: local(2026, 7, 13, 8),
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, learnCandidates: [5, 6], budgetMin: 8 },
    });
    expect(q.some((i) => i.kind === "learn")).toBe(true);
    // never exceeds budget
    const total = q.reduce((s, i) => s + i.estMin, 0);
    expect(total).toBeLessThanOrEqual(8 + 0.001);
  });

  it("ranks a due connection above an equal-risk ayah (connection weighted up)", () => {
    const t = local(2026, 7, 8, 8); // decayed a few days
    const ayah: AtomState = { ...encoded(4), lastRetrieval: t, stability: 3 };
    const conn: AtomState = { ...initAtom("connection", 4), encoded: true, gatePassed: true, strength: 60, stability: 3, lastRetrieval: t };
    const q = assembleQueue({
      atoms: [ayah, conn],
      now,
      lastActiveDay: local(2026, 7, 13, 8),
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8, connectionWeight: 1.5 },
    });
    const reviews = q.filter((i) => i.kind === "review");
    expect(reviews[0]!.atomKey).toBe("connection:4"); // weighted up → ranks first
  });

  it("a missed day produces make-up items that are never dropped by the budget", () => {
    // gate came due on a skipped day; user returns two days later with a tight budget.
    const gated = scheduleGate({ ...initAtom("ayah", 4), encoded: true }, local(2026, 7, 12, 20), DEFAULT_DAY_CONFIG);
    const q = assembleQueue({
      atoms: [gated],
      now: local(2026, 7, 15, 8), // returned after missing the 14th
      lastActiveDay: local(2026, 7, 13, 8),
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 0.1 }, // absurdly tight
    });
    // make-up/gate survive even a near-zero budget (session stays finishable).
    expect(q.some((i) => i.kind === "makeup" || i.kind === "gate")).toBe(true);
  });

  it("session is always finishable: mandatory items present even at budget 0", () => {
    const gated = scheduleGate({ ...initAtom("ayah", 4), encoded: true }, local(2026, 7, 13, 20), DEFAULT_DAY_CONFIG);
    const q = assembleQueue({
      atoms: [gated],
      now,
      lastActiveDay: local(2026, 7, 13, 8),
      wordCounts,
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 0 },
    });
    expect(q.length).toBeGreaterThan(0);
  });
});
