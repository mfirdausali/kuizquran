// atoms = a rebuildable cache; the append-only event log is truth (invariant #2 /
// PRD §9). rebuild() folds an ordered event stream into the atoms map by deriving
// a RetrievalOutcome per graded event and applying update(). Pure.
//
// Rollup (word taps → ayah atom): the graded unit is the ayah, so we grade at the
// rung/gate level, not per word:
//  - rung_complete(S1) → an s1 correct retrieval (a clean meaning sweep finished)
//  - rung_complete(S2) → an s2 correct retrieval
//  - rung_complete(S3) → an s3 correct retrieval → encoded → schedule day-1 gate
//  - a slip tap (correct:false, non-pretest) → a negative retrieval of that rung
//  - gate_result → a gate outcome (pass/fail), applied + gate state updated
//
// This keeps update() the single source of strength math; rebuild is just the
// fold that feeds it.

import type { DrillEvent, Rung } from "./types.ts";
import { atomKey, initAtom, type AtomState } from "./atom.ts";
import { update, type RetrievalKind, type RetrievalOutcome } from "./update.ts";
import { applyGateResult, scheduleGate } from "./gate.ts";
import { birthConnection } from "./bridge.ts";
import type { DayConfig } from "./daybound.ts";

// S4 rolls up as a light meaning signal, like S1 (bridge = meaning items).
// RC (v2 reconstruct) is never written to the wire directly — a reconstruct
// pass's DrillEvent.rung carries its grading equivalence class "S2"/"S3"
// (see reconstruct.ts); this entry only exists so the Record<Rung,...> stays
// total and is never actually read.
const RUNG_KIND: Record<Rung, RetrievalKind> = { S1: "s1", S2: "s2", S3: "s3", S4: "s1", RC: "s2" };

export type AtomsMap = Map<string, AtomState>;

function getAtom(atoms: AtomsMap, ayah: number): AtomState {
  const key = atomKey("ayah", ayah);
  let a = atoms.get(key);
  if (!a) {
    a = initAtom("ayah", ayah);
    atoms.set(key, a);
  }
  return a;
}

/** Whether an event was produced inside the structured session (invariant #5). */
function isStructured(e: DrillEvent): boolean {
  // Free-play events set structured=false explicitly; default is structured.
  return (e as { structured?: boolean }).structured !== false;
}

/** Apply a single event to the atoms map (mutates the map, replaces atom values). */
export function applyEvent(atoms: AtomsMap, e: DrillEvent, cfg?: DayConfig): void {
  const key = atomKey("ayah", e.ayah);

  if ((e.type === "tap" || e.type === "reconstruct_tap") && e.correct === false) {
    // A slip → negative retrieval of the current rung (pretest excluded in update()).
    // reconstruct_tap (v2 Phase 1) rolls up exactly like the old S2/S3 `tap`: its
    // `rung` already carries the grading equivalence class ("S2"/"S3").
    const atom = getAtom(atoms, e.ayah);
    const outcome: RetrievalOutcome = {
      kind: RUNG_KIND[e.rung],
      correct: false,
      ts: e.ts,
      pretest: e.pretest === true,
      structured: isStructured(e),
    };
    atoms.set(key, update(atom, outcome, { cfg }));
    return;
  }

  if (e.type === "rung_complete" || e.type === "ayah_produced") {
    // ayah_produced (v2 Phase 1) is the tap-to-reconstruct completion event —
    // graded exactly like rung_complete, using whatever grading rung ("S2"/"S3")
    // reconstruct.ts stamped on it.
    const atom = getAtom(atoms, e.ayah);
    const outcome: RetrievalOutcome = {
      kind: RUNG_KIND[e.rung],
      correct: true,
      ts: e.ts,
      structured: isStructured(e),
    };
    let updated = update(atom, outcome, { cfg });
    // Completing S3 = the ayah was produced whole → schedule the day-1 cold gate.
    if (e.rung === "S3" && isStructured(e)) {
      updated = scheduleGate(updated, e.ts, cfg);
    }
    atoms.set(key, updated);
    return;
  }

  if (e.type === "gate_result") {
    const atom = getAtom(atoms, e.ayah);
    const passed = e.correct === true;
    const outcome: RetrievalOutcome = {
      kind: "gate",
      correct: passed,
      ts: e.ts,
      structured: isStructured(e),
    };
    const updated = update(atom, outcome, { cfg });
    atoms.set(key, applyGateResult(updated, passed, e.ts, cfg));
    return;
  }

  if (e.type === "connection_born") {
    // S4 bridge created the n→n+1 connection atom (ref = the `from` ayah = e.ayah).
    birthConnection(atoms, e.ayah);
    return;
  }

  if (e.type === "junction_result") {
    // A junction check crossing n→n+1 → review the connection atom (ref = e.ayah).
    const connKey = atomKey("connection", e.ayah);
    const conn = atoms.get(connKey) ?? birthConnection(atoms, e.ayah);
    const outcome: RetrievalOutcome = {
      kind: "review",
      correct: e.correct === true,
      ts: e.ts,
      structured: isStructured(e),
    };
    atoms.set(connKey, update(conn, outcome, { cfg }));
    return;
  }

  if (e.type === "chain_step") {
    // One traversed step of a chain (FIRe): update the ayah OR connection atom.
    // v2-BUG-3 gap guard: never materialize a phantom atom for a chain step — an
    // ayah step only credits an already-ENCODED ayah; a junction step only
    // credits an already-BORN connection. A step whose atom doesn't exist yet is
    // dropped here (the event itself still lands in the append-only log; it just
    // carries no strength signal) instead of being silently faked as "reviewed".
    const isJunction = e.stepKind === "junction";
    const k = isJunction ? atomKey("connection", e.ayah) : atomKey("ayah", e.ayah);
    const atom = atoms.get(k);
    if (!atom || (!isJunction && !atom.encoded)) return;
    const outcome: RetrievalOutcome = {
      kind: "review",
      correct: e.correct === true,
      ts: e.ts,
      structured: isStructured(e),
    };
    atoms.set(k, update(atom, outcome, { cfg }));
    return;
  }
  // rung_start / ayah_complete carry no strength signal on their own.
}

/** Rebuild the entire atoms cache from an ordered event log (fold). */
export function rebuild(events: DrillEvent[], cfg?: DayConfig): AtomsMap {
  const atoms: AtomsMap = new Map();
  for (const e of events) applyEvent(atoms, e, cfg);
  return atoms;
}
