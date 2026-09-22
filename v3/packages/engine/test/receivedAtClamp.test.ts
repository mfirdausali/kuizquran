// Edge case #111 (BUILD-PLAN.md's own table): "Far-future client ts... accept
// + flag; fold clamps spacing at received_at." The client-side merge already
// accepts a far-future `ts` unconditionally and flags it (`merge.ts`'s own
// `futureTs`, v3-D240) — it deliberately never clamps, because clamping is
// documented as "the FOLD's job, not the merge's." This file proves the fold
// actually does that job: a `DrillEvent.receivedAt` (server-stamped, present
// only when the fold-runner assembles events read directly from the `events`
// table's own `received_at` column — never sent to or from the client, so it
// is undefined for every ordinary client-side fold) is used in place of a
// `ts` that sits AHEAD of it, so a device with a badly-skewed-forward clock
// can never permanently poison an atom's own `lastRetrieval`/`gateDueAt` into
// the far future.
import { describe, expect, it } from "vitest";
import { rebuild } from "../src/rebuild.ts";
import type { DrillEvent } from "../src/types.ts";

const DAY = 86_400_000;
const NOW = 20 * DAY; // an ordinary "today", far from both epoch and the poison
const FAR_FUTURE = NOW + 400 * DAY; // a badly-skewed-forward device clock

describe("rebuild — a far-future ts is clamped to receivedAt, never trusted for spacing", () => {
  it("a poisoned S3 completion's lastRetrieval is the real receivedAt, not the skewed ts", () => {
    const events: DrillEvent[] = [
      {
        type: "rung_complete",
        ts: FAR_FUTURE,
        receivedAt: NOW,
        surah: 112,
        ayah: 1,
        rung: "S3",
      },
    ];
    const atoms = rebuild(events);
    const atom = atoms.get("112:ayah:1");
    expect(atom).toBeDefined();
    expect(atom!.lastRetrieval).toBe(NOW);
    expect(atom!.lastRetrieval).not.toBe(FAR_FUTURE);
  });

  it("the day-1 cold gate scheduled off a poisoned completion is due tomorrow from receivedAt, not from the skewed ts", () => {
    const events: DrillEvent[] = [
      {
        type: "rung_complete",
        ts: FAR_FUTURE,
        receivedAt: NOW,
        surah: 112,
        ayah: 1,
        rung: "S3",
      },
    ];
    const atoms = rebuild(events);
    const atom = atoms.get("112:ayah:1")!;
    expect(atom.gateDueAt).not.toBeNull();
    // Due the next learning-day boundary after receivedAt, never after the
    // far-future ts (which would put it ~400 days later than this).
    expect(atom.gateDueAt!).toBeLessThan(NOW + 2 * DAY);
  });

  it("a poisoned gate FAIL re-arms off receivedAt, not the skewed ts", () => {
    const events: DrillEvent[] = [
      { type: "rung_complete", ts: NOW, surah: 112, ayah: 1, rung: "S3" },
      {
        type: "gate_result",
        ts: FAR_FUTURE,
        receivedAt: NOW + DAY,
        surah: 112,
        ayah: 1,
        rung: "S3",
        correct: false,
      },
    ];
    const atoms = rebuild(events);
    const atom = atoms.get("112:ayah:1")!;
    expect(atom.gateFails).toBe(1);
    expect(atom.gateDueAt!).toBeLessThan(NOW + 3 * DAY);
  });

  it("a poisoned slip's lastRetrieval is also clamped to receivedAt", () => {
    const events: DrillEvent[] = [
      { type: "rung_complete", ts: NOW, surah: 112, ayah: 1, rung: "S3" },
      {
        type: "tap",
        ts: FAR_FUTURE,
        receivedAt: NOW + DAY,
        surah: 112,
        ayah: 1,
        rung: "S3",
        correct: false,
      },
    ];
    const atoms = rebuild(events);
    const atom = atoms.get("112:ayah:1")!;
    expect(atom.lastRetrieval).toBe(NOW + DAY);
  });

  it("never clamps an ordinary LATE-ARRIVAL event — ts earlier than receivedAt is untouched", () => {
    // The common, legitimate case: an offline device commits at `ts`, then
    // syncs a week later. `receivedAt` (the sync moment) sits AFTER `ts` —
    // the opposite direction from the poison case — and must never be
    // substituted in, or every offline-then-synced learner's real spacing
    // would be corrupted to "just now" on every sync.
    const events: DrillEvent[] = [
      {
        type: "rung_complete",
        ts: NOW,
        receivedAt: NOW + 7 * DAY,
        surah: 112,
        ayah: 1,
        rung: "S3",
      },
    ];
    const atoms = rebuild(events);
    const atom = atoms.get("112:ayah:1")!;
    expect(atom.lastRetrieval).toBe(NOW);
  });

  it("never clamps when receivedAt is absent — the ordinary client-side fold, unchanged", () => {
    const events: DrillEvent[] = [
      { type: "rung_complete", ts: FAR_FUTURE, surah: 112, ayah: 1, rung: "S3" },
    ];
    const atoms = rebuild(events);
    const atom = atoms.get("112:ayah:1")!;
    expect(atom.lastRetrieval).toBe(FAR_FUTURE);
  });
});
