import { describe, expect, it } from "vitest";
import { rebuild, applyEvent, type AtomsMap } from "../src/rebuild.ts";
import type { DrillEvent } from "../src/types.ts";

const DAY = 86_400_000;

// A small deterministic event stream: encode ayah 4 (S1,S2,S3 completes) then a
// gate pass the next day, plus a slip.
function stream(): DrillEvent[] {
  const t = 5 * DAY + 6 * 3600_000;
  return [
    { type: "rung_start", ts: t, surah: 12, ayah: 4, rung: "S1" },
    { type: "tap", ts: t + 1000, surah: 12, ayah: 4, rung: "S1", correct: false, pretest: true },
    { type: "rung_complete", ts: t + 5000, surah: 12, ayah: 4, rung: "S1" },
    { type: "rung_complete", ts: t + 9000, surah: 12, ayah: 4, rung: "S2" },
    { type: "tap", ts: t + 11000, surah: 12, ayah: 4, rung: "S3", correct: false },
    { type: "rung_complete", ts: t + 15000, surah: 12, ayah: 4, rung: "S3" },
    { type: "ayah_complete", ts: t + 15500, surah: 12, ayah: 4, rung: "S3" },
    // next learning-day: cold gate passed
    { type: "gate_result", ts: t + DAY + 3600_000, surah: 12, ayah: 4, rung: "S3", correct: true },
  ];
}

describe("rebuild — atoms are a rebuildable cache (invariant #2)", () => {
  it("fold(events) == replay(events) — order-preserving determinism", () => {
    const events = stream();
    const a = rebuild(events);
    const b = rebuild(events);
    expect(a).toEqual(b);
  });

  it("incremental applyEvent equals a full rebuild (fold == replay) (property)", () => {
    const events = stream();
    const full = rebuild(events);
    const incremental: AtomsMap = new Map();
    for (const e of events) applyEvent(incremental, e);
    expect(incremental).toEqual(full);
  });

  it("encodes the ayah and passes its gate", () => {
    const atoms = rebuild(stream());
    const atom = atoms.get("ayah:4")!;
    expect(atom.encoded).toBe(true);
    expect(atom.gatePassed).toBe(true);
    expect(atom.strength).toBeGreaterThan(0);
  });

  it("the pretest first-pass error left no strength mark (invariant #3)", () => {
    // Build an identical stream WITHOUT the pretest tap; strengths must match,
    // proving the pretest tap contributed nothing.
    const withPretest = stream();
    const withoutPretest = stream().filter((e) => !(e.type === "tap" && e.pretest));
    const a = rebuild(withPretest).get("ayah:4")!;
    const b = rebuild(withoutPretest).get("ayah:4")!;
    expect(a).toEqual(b);
  });

  it("folds connection_born + junction/chain events into a reviewed connection atom", () => {
    const t = 5 * DAY;
    const events: DrillEvent[] = [
      // encode ayah 4
      { type: "rung_complete", ts: t, surah: 12, ayah: 4, rung: "S3" },
      // S4 bridge births the 4→5 connection
      { type: "connection_born", ts: t + 1000, surah: 12, ayah: 4, rung: "S4", to: 5 },
      { type: "junction_result", ts: t + 2000, surah: 12, ayah: 4, rung: "S4", to: 5, correct: true },
      // a chain traversal (FIRe) over the already-encoded ayah + its born connection
      { type: "chain_step", ts: t + 3000, surah: 12, ayah: 4, rung: "S4", stepKind: "ayah", correct: true },
      { type: "chain_step", ts: t + 3100, surah: 12, ayah: 4, rung: "S4", stepKind: "junction", to: 5, correct: true },
      // v2-BUG-3 gap guard: ayah 5 was never encoded (no S3 yet) — its chain step
      // must NOT phantom-credit it as "reviewed".
      { type: "chain_step", ts: t + 3200, surah: 12, ayah: 5, rung: "S4", stepKind: "ayah", correct: true },
    ];
    const atoms = rebuild(events);
    expect(atoms.get("connection:4")).toBeDefined(); // born
    expect(atoms.get("connection:4")!.strength).toBeGreaterThan(0); // reviewed
    expect(atoms.get("ayah:4")).toBeDefined();
    expect(atoms.get("ayah:5")).toBeUndefined(); // never encoded — gap guard skipped it, no phantom
    // fold == replay still holds with the new event kinds
    expect([...rebuild(events).entries()]).toEqual([...atoms.entries()]);
  });

  it("a random event permutation of independent ayat rebuilds identically per atom", () => {
    // Two independent ayat; interleaving order across ayat must not change per-atom result.
    const t = 5 * DAY;
    const evA: DrillEvent[] = [
      { type: "rung_complete", ts: t + 1, surah: 12, ayah: 4, rung: "S1" },
      { type: "rung_complete", ts: t + 2, surah: 12, ayah: 4, rung: "S2" },
      { type: "rung_complete", ts: t + 3, surah: 12, ayah: 4, rung: "S3" },
    ];
    const evB: DrillEvent[] = [
      { type: "rung_complete", ts: t + 1, surah: 12, ayah: 5, rung: "S1" },
      { type: "rung_complete", ts: t + 2, surah: 12, ayah: 5, rung: "S2" },
      { type: "rung_complete", ts: t + 3, surah: 12, ayah: 5, rung: "S3" },
    ];
    const straight = rebuild([...evA, ...evB]);
    const interleaved = rebuild([evA[0]!, evB[0]!, evA[1]!, evB[1]!, evA[2]!, evB[2]!]);
    expect(interleaved.get("ayah:4")).toEqual(straight.get("ayah:4"));
    expect(interleaved.get("ayah:5")).toEqual(straight.get("ayah:5"));
  });
});

describe("rebuild — v2 Phase 1 tap-to-reconstruct events (reconstruct_tap/ayah_produced)", () => {
  it("a reconstruct slip (reconstruct_tap, correct:false) grades exactly like a tap slip", () => {
    const t = 5 * DAY;
    const viaTap: DrillEvent[] = [
      { type: "tap", ts: t, surah: 12, ayah: 4, rung: "S2", correct: false },
    ];
    const viaReconstruct: DrillEvent[] = [
      { type: "reconstruct_tap", ts: t, surah: 12, ayah: 4, rung: "S2", correct: false },
    ];
    expect(rebuild(viaReconstruct).get("ayah:4")).toEqual(rebuild(viaTap).get("ayah:4"));
  });

  it("ayah_produced (rung S2, partial reconstruction) grades like rung_complete S2 — no gate scheduled", () => {
    const t = 5 * DAY;
    const events: DrillEvent[] = [
      { type: "ayah_produced", ts: t, surah: 12, ayah: 4, rung: "S2" },
    ];
    const atoms = rebuild(events);
    const atom = atoms.get("ayah:4")!;
    expect(atom.strength).toBeGreaterThan(0);
    expect(atom.encoded).toBe(false);
    expect(atom.gateDueAt).toBeNull();
  });

  it("ayah_produced (rung S3, whole-ayah reconstruction) encodes the ayah and schedules the gate", () => {
    const t = 5 * DAY;
    const events: DrillEvent[] = [
      { type: "ayah_produced", ts: t, surah: 12, ayah: 4, rung: "S3" },
    ];
    const atoms = rebuild(events);
    const atom = atoms.get("ayah:4")!;
    expect(atom.encoded).toBe(true);
    expect(atom.gateDueAt).not.toBeNull();
    expect(atom.strength).toBeGreaterThan(0);
  });

  it("a full end-to-end reconstruct pass (one slip + completion) moves strength once, via the log", () => {
    const t = 5 * DAY;
    const events: DrillEvent[] = [
      { type: "reconstruct_tap", ts: t, surah: 12, ayah: 7, rung: "S2", correct: false },
      { type: "reconstruct_tap", ts: t + 500, surah: 12, ayah: 7, rung: "S2", correct: true },
      { type: "ayah_produced", ts: t + 600, surah: 12, ayah: 7, rung: "S2" },
    ];
    const atoms = rebuild(events);
    const atom = atoms.get("ayah:7")!;
    // Net of one slip (-15, Learn band) then a graded S2 completion (+12): still positive.
    expect(atom.strength).toBeGreaterThan(0);
    expect(atom.reps).toBe(2); // the slip + the completion; the bare correct tap carries no signal
  });
});

describe("rebuild — v2 Phase 2 gate_demote (v2-D08 forgiveness ladder)", () => {
  it("a gate_demote after repeated fails clears encoding/gate state, and doesn't itself touch strength", () => {
    const t = 5 * DAY;
    const beforeDemote: DrillEvent[] = [
      { type: "ayah_produced", ts: t, surah: 12, ayah: 4, rung: "S3" }, // encode + schedule gate
      { type: "gate_result", ts: t + DAY, surah: 12, ayah: 4, rung: "S3", correct: false },
    ];
    const demoteEvent: DrillEvent = { type: "gate_demote", ts: t + DAY + 1000, surah: 12, ayah: 4, rung: "S3" };

    const preAtom = rebuild(beforeDemote).get("ayah:4")!;
    const atoms = rebuild([...beforeDemote, demoteEvent]);
    const atom = atoms.get("ayah:4")!;
    expect(atom.encoded).toBe(false);
    expect(atom.gateDueAt).toBeNull();
    expect(atom.gatePassed).toBe(false);
    expect(atom.gateFails).toBe(0);
    // demoteToLearn is a lifecycle transition, not a retrieval — strength is left
    // exactly as the gate fail evidence already put it (not additionally zeroed).
    expect(atom.strength).toBe(preAtom.strength);
  });

  it("a gate_demote on a never-taught ayah is a no-op (nothing to send back)", () => {
    const events: DrillEvent[] = [{ type: "gate_demote", ts: 5 * DAY, surah: 12, ayah: 99, rung: "S3" }];
    expect(rebuild(events).get("ayah:99")).toBeUndefined();
  });
});
