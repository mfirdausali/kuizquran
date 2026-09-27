import { describe, expect, it } from "vitest";
import { lastActiveDayMs } from "../src/activity.ts";
import { initAtom } from "../src/atom.ts";
import { scheduleGate } from "../src/gate.ts";
import { assembleQueue, makeupDeferredCount, MAKEUP_CAP } from "../src/scheduler.ts";
import { DEFAULT_DAY_CONFIG } from "../src/daybound.ts";
import type { DrillEvent, EventType } from "../src/types.ts";

function ev(ts: number): DrillEvent {
  return { type: "rung_complete", ts, surah: 12, ayah: 4, rung: "S1" };
}

function typed(type: EventType, ts: number, extra: Partial<DrillEvent> = {}): DrillEvent {
  return { type, ts, surah: 12, ayah: 4, rung: "S1", ...extra } as DrillEvent;
}

describe("lastActiveDayMs (v2-BUG-2 fix)", () => {
  it("null on an empty log (a brand-new learner)", () => {
    expect(lastActiveDayMs([])).toBeNull();
  });

  it("the max ts across the log, regardless of insertion order", () => {
    const events = [ev(1_000), ev(5_000), ev(3_000)];
    expect(lastActiveDayMs(events)).toBe(5_000);
  });

  it("a single-event log returns that event's ts", () => {
    expect(lastActiveDayMs([ev(42)])).toBe(42);
  });
});

// v3-D259 — "last active day" means the last day the learner actually
// RETRIEVED something in a structured session, never merely the newest `ts`
// in the log. The make-up merge (scheduler.ts step 1) fires only when
// `daysBetween(lastActiveDay, now) >= 2`, so ANY audit-only event stamped
// "now" — the `interruption` `acknowledgeReentry` writes on a churned
// re-entry, a `session_start` from a session opened and abandoned, a
// read-only Test (`test_*`, invariant #5), a planned-absence toggle
// (`day_marked_away`), an adoption audit row — silently switched the cap
// off, and every missed gate flowed through step 2 as an uncapped
// mandatory gate: the exact "queue explosion" v3-D256 built MAKEUP_CAP to
// prevent. The set counted here is exactly the event types `rebuild.ts`
// folds as retrieval evidence, and only when structured (invariant #5:
// free-play is evidence only, never lifecycle).
describe("lastActiveDayMs counts only structured retrieval evidence (v3-D259)", () => {
  const RETRIEVAL: EventType[] = [
    "tap",
    "reconstruct_tap",
    "rung_complete",
    "ayah_produced",
    "gate_result",
    "junction_result",
    "chain_step",
  ];
  const AUDIT_ONLY: EventType[] = [
    "session_start",
    "interruption",
    "test_start",
    "test_answer",
    "test_result",
    "day_marked_away",
    "adoption",
    "rung_start",
    "ayah_complete",
    "gate_demote",
    "connection_born",
    "placement_probe",
    "placement_result",
  ];

  it("ignores every audit-only event newer than the last retrieval", () => {
    for (const t of AUDIT_ONLY) {
      const log = [typed("ayah_produced", 1_000, { rung: "S3" }), typed(t, 9_000)];
      expect(lastActiveDayMs(log), t).toBe(1_000);
    }
  });

  it("still counts every retrieval type the fold consumes", () => {
    for (const t of RETRIEVAL) {
      const log = [typed("ayah_produced", 1_000, { rung: "S3" }), typed(t, 9_000)];
      expect(lastActiveDayMs(log), t).toBe(9_000);
    }
  });

  it("ignores free-play (structured:false) retrievals — invariant #5", () => {
    const log = [
      typed("ayah_produced", 1_000, { rung: "S3" }),
      typed("reconstruct_tap", 9_000, { structured: false, correct: true }),
      typed("ayah_produced", 9_500, { rung: "S3", structured: false }),
    ];
    expect(lastActiveDayMs(log)).toBe(1_000);
  });

  it("null when the log holds no retrieval at all (only audit events)", () => {
    expect(lastActiveDayMs([typed("session_start", 5_000), typed("test_result", 6_000)])).toBeNull();
  });

  it("a churned return's own re-entry audit event no longer switches the make-up cap off", () => {
    const DAY = 86_400_000;
    const encodedAt = Date.UTC(2026, 6, 1, 8);
    const now = encodedAt + 21 * DAY;
    // Four ayat encoded on one day; each schedules its own next-day gate.
    const atoms = [1, 2, 3, 4].map((ayah) =>
      scheduleGate({ ...initAtom(12, "ayah", ayah), encoded: true }, encodedAt, DEFAULT_DAY_CONFIG),
    );
    const log: DrillEvent[] = [
      ...[1, 2, 3, 4].map((ayah) => typed("ayah_produced", encodedAt, { ayah, rung: "S3" })),
      // what acknowledgeReentry writes the moment the stale tab regains focus
      typed("interruption", now - 60_000, { structured: false, resume: "makeup" }),
    ];
    const lastActiveDay = lastActiveDayMs(log);
    const q = assembleQueue({
      surah: 12,
      atoms,
      now,
      lastActiveDay,
      wordCounts: new Map(),
      cfg: { day: DEFAULT_DAY_CONFIG, budgetMin: 8 },
    });
    expect(q.filter((i) => i.kind === "makeup").length).toBe(MAKEUP_CAP);
    expect(q.filter((i) => i.kind === "gate").length).toBe(0);
    expect(makeupDeferredCount(atoms, 12, now, lastActiveDay)).toBe(4 - MAKEUP_CAP);
  });
});
