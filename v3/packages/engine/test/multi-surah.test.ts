// Build-plan step 9: multi-surah engine fixes E-02/E-03/E-05/E-06/E-08.
//
// E-08 needs no code change here: bridge.ts's `nextOpening`/`bridgeItems`
// (the only code DEFECTS.md's "bridge.ts:14 has no bound check" could refer
// to) was atticked entirely in step 5 (v3-D25) — never ported, so the OOB
// call site doesn't exist in v3. Its proper by-construction closure
// (`expand()` emitting seams only for a..b-1) is Site/admit, build-plan
// step 11, not this one.
//
// E-05 needs no engine change either: `pace.ts`'s `paceConfig`/
// `candidatesForPace` are already pure, stateless lookups — callable once
// per surah with no shared state between calls. "Pace is per-learner, not
// per-surah" describes a STORAGE schema bug (which surah's pace setting is
// persisted where), not a pure-function bug; that schema doesn't exist yet
// (M6's sync/IndexedDB layer). Documented here rather than invented as
// speculative engine scope.

import { describe, expect, it } from "vitest";
import { unlockPermitted } from "../src/gate.ts";
import { extraLearnGrant } from "../src/freeplay.ts";
import { assembleQueue } from "../src/scheduler.ts";
import { splitBudget } from "../src/multiSurah.ts";
import { initAtom, type AtomState } from "../src/atom.ts";
import { planFor } from "../src/capacity.ts";

const DAY = 86_400_000;

function gateDueAtom(surah: number, ref: number, dueAt: number): AtomState {
  return { ...initAtom(surah, "ayah", ref), encoded: true, gateDueAt: dueAt, gatePassed: false };
}

describe("E-03: unlockPermitted is surah-scoped — a pending gate in one surah never blocks another", () => {
  it("a due, unpassed gate in surah 67 does NOT block unlock for surah 12", () => {
    const atoms = [gateDueAtom(67, 5, 0)]; // due, unpassed, surah 67
    expect(unlockPermitted(atoms, DAY, 12)).toBe(true); // surah 12 has no pending gate
    expect(unlockPermitted(atoms, DAY, 67)).toBe(false); // surah 67's own gate blocks it
  });

  it("extraLearnGrant (freeplay door 1) is surah-scoped too", () => {
    const atoms = [gateDueAtom(67, 5, 0)];
    const grantFor12 = extraLearnGrant(atoms, 12, [8], DAY, new Map());
    expect(grantFor12.granted).toBe(true);
    const grantFor67 = extraLearnGrant(atoms, 67, [8], DAY, new Map());
    expect(grantFor67.granted).toBe(false);
    expect(grantFor67.reason).toBe("a cold gate is still due");
  });
});

describe("E-02: assembleQueue never mixes another surah's atoms into one queue", () => {
  it("atoms from a different surah than input.surah are excluded from the built queue", () => {
    const atoms: AtomState[] = [
      { ...initAtom(12, "ayah", 4), encoded: true, gatePassed: true, strength: 60, stability: 4, lastRetrieval: 0 },
      { ...initAtom(67, "ayah", 4), encoded: true, gatePassed: true, strength: 60, stability: 4, lastRetrieval: 0 },
    ];
    const q = assembleQueue({ surah: 12, atoms, now: 30 * DAY, lastActiveDay: null, wordCounts: new Map() });
    // Every item in a surah-12 queue must belong to surah 12 (checked via
    // the atomKey format, which is surah-prefixed since E-01).
    for (const item of q) expect(item.atomKey.startsWith("12:")).toBe(true);
  });

  it("splitBudget divides one total across N surahs, never handing any one surah the full amount", () => {
    const shares = splitBudget(8, [{ surah: 12 }, { surah: 67 }]);
    expect(shares.get(12)! + shares.get(67)!).toBeCloseTo(8, 5);
    expect(shares.get(12)!).toBeLessThan(8);
    expect(shares.get(67)!).toBeLessThan(8);
  });

  it("splitBudget respects relative weight (a heavier-weighted surah gets a bigger share)", () => {
    const shares = splitBudget(9, [{ surah: 12, weight: 2 }, { surah: 67, weight: 1 }]);
    expect(shares.get(12)!).toBeCloseTo(6, 5);
    expect(shares.get(67)!).toBeCloseTo(3, 5);
  });

  it("splitBudget of zero surahs returns an empty map, never throws or divides by zero", () => {
    expect(splitBudget(8, []).size).toBe(0);
  });
});

describe("E-06: planFor never receives more than a surah's fair share of the total budget", () => {
  it("two equal-weight surahs each get a HALVED planFor ETA input, not the full daily budget", () => {
    const totalMinutesPerDay = 8;
    const shares = splitBudget(totalMinutesPerDay, [{ surah: 12 }, { surah: 67 }]);
    const planA = planFor({ remainingAyat: 100, avgWordsPerAyah: 16, minutesPerDay: shares.get(12)! });
    const planFull = planFor({ remainingAyat: 100, avgWordsPerAyah: 16, minutesPerDay: totalMinutesPerDay });
    // The split-budget plan can never be FASTER (fewer days) than the
    // dishonest full-budget plan every surah used to get independently.
    expect(planA.etaDays).toBeGreaterThanOrEqual(planFull.etaDays);
  });
});
