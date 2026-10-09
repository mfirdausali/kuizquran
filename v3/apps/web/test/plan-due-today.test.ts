// GUARDS DECISIONS.md v3-D227's own "NOT addressed" note:
// `components/plan/PlanIsland.tsx#dueToday` re-derived `gate.ts#gateDue()`'s
// predicate inline (`atom.gateDueAt !== null && !atom.gatePassed &&
// atom.gateDueAt <= now`) instead of importing the engine's own tested
// resolver — the exact "tested resolver exists, the one caller re-derives it
// inline" shape this build has repeatedly closed elsewhere
// (`gradeClassToWire` v3-D83, `lastActiveDayMs` v3-D113, `digestsMatch`
// v3-D159, `gateStateOf` v3-D212). The inline copy additionally omitted
// `gateDue()`'s own `atom.encoded` term. No reachable engine transition
// today leaves `gateDueAt` set with `encoded` false — `applyGateResult`
// always sets both together on a failure, `demoteToLearn` resets both
// together — so this was not a live divergence, but a fragile one: the two
// copies could silently drift apart again exactly as `gateStateOf`'s two
// copies once did (v3-D211/D212).
//
// Fixed by importing `gateDue` from the engine instead of re-deriving it.
// This test pins the BEHAVIOR the inline copy got wrong for a synthetic,
// currently-unreachable atom shape — proving the fix is a real delegation,
// not a coincidentally-matching rewrite.
//
// ALSO GUARDS a second, sharper gap in the same function (v3-D238):
// `dueToday`'s own comment read "Only the first, because the Steady pace
// unlocks one new ayah a day" — true only for Steady. `pace.ts` defines
// three real ceilings (`STEADY.newAyahCeiling = 1`, `SPRINT.newAyahCeiling =
// 3`, `MAINTAIN.newAyahCeiling = 0`) and the real session assembler
// (`lib/session/run.ts`, wired at v3-D138) grants a Sprint learner up to 3
// new ayat and a Maintain learner none — but `dueToday` hardcoded exactly
// one `learn` candidate regardless of which mode was passed in, so `/plan`'s
// forecast silently undercounted a Sprint learner's real capacity and
// fabricated a "Learn N" item (plus a phantom future cold-gate projection,
// `forecast.ts`'s own `concreteItems`) for a Maintain learner who can never
// structurally unlock one. Fixed by delegating to the same
// `pace.ts#candidatesForPace()` the session assembler already uses, rather
// than a second, pace-blind cap.

import { describe, expect, it } from "vitest";

import type { AtomState } from "@engine/atom.ts";
import { initAtom } from "@engine/atom.ts";
import { gateDue } from "@engine/gate.ts";
import { assembleQueue, REVIEW_RISK_THRESHOLD } from "@engine/scheduler.ts";
import { currentBand, forgettingRisk } from "@engine/strength.ts";
import { candidatesForPace, paceConfig } from "@engine/pace.ts";
import type { Corpus } from "@engine/types.ts";
import { dueToday } from "@/components/plan/PlanIsland";

const NOW = Date.UTC(2026, 8, 18, 9, 0, 0);
const SURAH = 112;

function stubCorpus(ayahCount: number): Corpus {
  return {
    meta: { surah: SURAH, ayahCount, wordCount: ayahCount * 5 },
  } as unknown as Corpus;
}

describe("PlanIsland#dueToday agrees with gate.ts#gateDue()", () => {
  it("never lists an unencoded atom's gate as due, even with a stray gateDueAt", () => {
    // A shape `gateDue()` itself refuses (its own `atom.encoded` term) —
    // unreachable via real transitions today, but exactly the shape the
    // inline copy silently admitted because it never checked `encoded` at
    // all.
    const atom: AtomState = {
      ...initAtom(SURAH, "ayah", 1),
      encoded: false,
      gatePassed: false,
      gateDueAt: NOW - 1,
    };
    expect(gateDue(atom, NOW)).toBe(false);

    const atoms = new Map<string, AtomState>([
      [`${SURAH}:ayah:1`, atom],
    ]);
    const result = dueToday(stubCorpus(1), atoms, NOW);
    expect(result.gates).toEqual([]);
  });

  it("still lists a genuinely due, encoded, unpassed gate", () => {
    const atom: AtomState = {
      ...initAtom(SURAH, "ayah", 1),
      encoded: true,
      gatePassed: false,
      gateDueAt: NOW - 1,
    };
    expect(gateDue(atom, NOW)).toBe(true);

    const atoms = new Map<string, AtomState>([
      [`${SURAH}:ayah:1`, atom],
    ]);
    const result = dueToday(stubCorpus(1), atoms, NOW);
    expect(result.gates).toEqual([{ surah: SURAH, ayah: 1 }]);
  });
});

describe("PlanIsland#dueToday's learn list respects the learner's real pace ceiling", () => {
  // No atoms at all — every one of these ayat is a genuine, real learn
  // candidate, exactly `learnCandidatesFor()`'s own shape in run.ts.
  const NO_ATOMS = new Map<string, AtomState>();

  it("defaults to Steady's ceiling of 1 when no pace is given — the pre-existing behavior", () => {
    const result = dueToday(stubCorpus(5), NO_ATOMS, NOW);
    expect(result.learn).toEqual([{ surah: SURAH, ayah: 1 }]);
  });

  it("Sprint's ceiling of 3 lists up to three ayat, in mushaf order — never just one", () => {
    const result = dueToday(stubCorpus(5), NO_ATOMS, NOW, "sprint");
    expect(result.learn).toEqual([
      { surah: SURAH, ayah: 1 },
      { surah: SURAH, ayah: 2 },
      { surah: SURAH, ayah: 3 },
    ]);
  });

  it("Sprint never lists more than the corpus actually has left to learn", () => {
    const result = dueToday(stubCorpus(2), NO_ATOMS, NOW, "sprint");
    expect(result.learn).toEqual([
      { surah: SURAH, ayah: 1 },
      { surah: SURAH, ayah: 2 },
    ]);
  });

  it("Maintain's ceiling of 0 lists no learn candidate at all — reviews only, never a fabricated unlock", () => {
    const result = dueToday(stubCorpus(5), NO_ATOMS, NOW, "maintain");
    expect(result.learn).toEqual([]);
  });

  it("Steady named explicitly still lists exactly one, matching the default", () => {
    const result = dueToday(stubCorpus(5), NO_ATOMS, NOW, "steady");
    expect(result.learn).toEqual([{ surah: SURAH, ayah: 1 }]);
  });
});

// v3-D252 — `dueToday` mirrors `run.ts#learnCandidatesFor`, and both read
// "an atom row exists" as "already learned". An atom can exist UN-ENCODED:
// `gate.ts#demoteToLearn` (the forgiveness ladder's "send back to Learn")
// leaves one behind with `encoded: false`, and `rebuild.ts#getAtom`
// materializes one on the first wrong tap of a Learn pass. Such an ayah is
// neither a gate nor a review, so `/plan` listed it nowhere at all.
describe("PlanIsland#dueToday lists an un-encoded ayah with an existing atom as a Learn candidate", () => {
  it("a demoted ayah (atom present, encoded:false, no gate) is the next Learn, in mushaf order", () => {
    const demoted: AtomState = {
      ...initAtom(SURAH, "ayah", 1),
      encoded: false,
      gatePassed: false,
      gateDueAt: null,
      strength: 30,
    };
    const atoms = new Map<string, AtomState>([[`${SURAH}:ayah:1`, demoted]]);
    const result = dueToday(stubCorpus(3), atoms, NOW);
    expect(result.learn).toEqual([{ surah: SURAH, ayah: 1 }]);
    expect(result.gates).toEqual([]);
    expect(result.reviews).toBe(0);
  });

  it("an ENCODED ayah is still never listed as a Learn candidate", () => {
    const encoded: AtomState = {
      ...initAtom(SURAH, "ayah", 1),
      encoded: true,
      gatePassed: true,
      gateDueAt: null,
    };
    const atoms = new Map<string, AtomState>([[`${SURAH}:ayah:1`, encoded]]);
    const result = dueToday(stubCorpus(3), atoms, NOW);
    expect(result.learn).toEqual([{ surah: SURAH, ayah: 2 }]);
  });
});

// v3-D295 — `dueToday`'s REVIEW count and its LEARN list were the two halves
// v3-D228 (gates) and v3-D238 (pace ceiling) never reconciled with the engine.
// `lib/home/queue.ts`'s own header already named this function "an
// APPROXIMATION of the queue" and called that shape wrong; nothing pinned it.
//
//   reviews — counted "encoded and not yet in the carry band", while the
//     scheduler (`assembleQueue` step 3) admits a review only when the gate is
//     PASSED and forgetting-risk x weight exceeds REVIEW_RISK_THRESHOLD. The
//     two disagree in BOTH directions: a just-encoded ayah whose cold gate is
//     merely armed was a phantom review; a carry-band ayah past the threshold
//     was a missed one.
//   learn — listed Learn candidates even while a due gate holds the
//     scheduler's own `unlockPermitted()` shut (Steady/Maintain tolerance 0),
//     so `/plan` named a "Learn N" today — and, via `forecast.ts`, a "Gate N"
//     tomorrow — that the session would never serve.
//
// The agreement cases below call the REAL `assembleQueue` with an unbounded
// budget (the Today row lists what is DUE; fitting it to minutes is the
// session's job), so they prove agreement with the scheduler, not with a copy.
describe("PlanIsland#dueToday's reviews and learn are the scheduler's own decisions (v3-D295)", () => {
  const DAY = 86_400_000;

  function scheduledFor(atoms: Map<string, AtomState>, ayahCount: number, pace: "steady" | "sprint" | "maintain") {
    const unencoded: number[] = [];
    for (let ayah = 1; ayah <= ayahCount; ayah++) {
      const a = atoms.get(`${SURAH}:ayah:${ayah}`);
      if (!a || !a.encoded) unencoded.push(ayah);
    }
    const cfg = paceConfig(pace);
    const q = assembleQueue({
      surah: SURAH,
      atoms: [...atoms.values()],
      now: NOW,
      wordCounts: new Map(),
      cfg: { budgetMin: 10_000, gateTolerance: cfg.gateTolerance, learnCandidates: candidatesForPace(unencoded, pace) },
    });
    return {
      reviews: q.filter((i) => i.kind === "review").length,
      learn: q.filter((i) => i.kind === "learn").map((i) => i.ayah),
    };
  }

  it("a just-encoded ayah whose cold gate is ARMED (not yet due) is not a review", () => {
    const justEncoded: AtomState = {
      ...initAtom(SURAH, "ayah", 1),
      encoded: true,
      gatePassed: false,
      gateDueAt: NOW + DAY,
      strength: 26,
      stability: 1,
      lastRetrieval: NOW - 3_600_000,
    };
    // Non-vacuous: the old "not carry" rule DID count this one.
    expect(currentBand(justEncoded, NOW)).not.toBe("carry");
    expect(gateDue(justEncoded, NOW)).toBe(false);
    const atoms = new Map<string, AtomState>([[`${SURAH}:ayah:1`, justEncoded]]);
    expect(dueToday(stubCorpus(4), atoms, NOW).reviews).toBe(0);
  });

  it("a gate-passed ayah retrieved moments ago is not yet due for review", () => {
    const fresh: AtomState = {
      ...initAtom(SURAH, "ayah", 1),
      encoded: true,
      gatePassed: true,
      strength: 55,
      stability: 5,
      lastRetrieval: NOW,
    };
    expect(currentBand(fresh, NOW)).toBe("reinforce");
    expect(forgettingRisk(fresh, NOW)).toBe(0);
    const atoms = new Map<string, AtomState>([[`${SURAH}:ayah:1`, fresh]]);
    expect(dueToday(stubCorpus(4), atoms, NOW).reviews).toBe(0);
  });

  it("a still-carry-band ayah already past the scheduler's risk threshold IS due", () => {
    const decaying: AtomState = {
      ...initAtom(SURAH, "ayah", 1),
      encoded: true,
      gatePassed: true,
      strength: 100,
      stability: 10,
      lastRetrieval: NOW - 2 * DAY,
    };
    // Non-vacuous: the old rule saw "carry" and skipped it, while the
    // scheduler's own threshold says it is due.
    expect(currentBand(decaying, NOW)).toBe("carry");
    expect(forgettingRisk(decaying, NOW)).toBeGreaterThan(REVIEW_RISK_THRESHOLD);
    const atoms = new Map<string, AtomState>([[`${SURAH}:ayah:1`, decaying]]);
    expect(dueToday(stubCorpus(4), atoms, NOW).reviews).toBe(1);
  });

  it("a due cold gate under Steady (tolerance 0) holds Learn shut — no Learn is named", () => {
    const gated: AtomState = {
      ...initAtom(SURAH, "ayah", 1),
      encoded: true,
      gatePassed: false,
      gateDueAt: NOW - 1,
    };
    const atoms = new Map<string, AtomState>([[`${SURAH}:ayah:1`, gated]]);
    const result = dueToday(stubCorpus(4), atoms, NOW, "steady");
    expect(result.gates).toEqual([{ surah: SURAH, ayah: 1 }]);
    expect(result.learn).toEqual([]);
  });

  it("Sprint's tolerance of 1 still unlocks past one due gate, but not past two", () => {
    const gate = (ayah: number): AtomState => ({
      ...initAtom(SURAH, "ayah", ayah),
      encoded: true,
      gatePassed: false,
      gateDueAt: NOW - 1,
    });
    const one = new Map<string, AtomState>([[`${SURAH}:ayah:1`, gate(1)]]);
    expect(dueToday(stubCorpus(6), one, NOW, "sprint").learn.map((l) => l.ayah)).toEqual([2, 3, 4]);
    const two = new Map<string, AtomState>([
      [`${SURAH}:ayah:1`, gate(1)],
      [`${SURAH}:ayah:2`, gate(2)],
    ]);
    expect(dueToday(stubCorpus(6), two, NOW, "sprint").learn).toEqual([]);
  });

  it("agrees with the real assembleQueue on a mixed log, for every pace", () => {
    const atoms = new Map<string, AtomState>([
      [`${SURAH}:ayah:1`, { ...initAtom(SURAH, "ayah", 1), encoded: true, gatePassed: true, strength: 100, stability: 10, lastRetrieval: NOW - 2 * DAY }],
      [`${SURAH}:ayah:2`, { ...initAtom(SURAH, "ayah", 2), encoded: true, gatePassed: true, strength: 55, stability: 5, lastRetrieval: NOW }],
      [`${SURAH}:ayah:3`, { ...initAtom(SURAH, "ayah", 3), encoded: true, gatePassed: false, gateDueAt: NOW + DAY, strength: 26, stability: 1, lastRetrieval: NOW - 3_600_000 }],
      [`${SURAH}:ayah:4`, { ...initAtom(SURAH, "ayah", 4), encoded: true, gatePassed: true, strength: 30, stability: 1, lastRetrieval: NOW - 5 * DAY }],
    ]);
    for (const pace of ["steady", "sprint", "maintain"] as const) {
      const plan = dueToday(stubCorpus(8), atoms, NOW, pace);
      const engine = scheduledFor(atoms, 8, pace);
      expect(plan.reviews, `${pace} reviews`).toBe(engine.reviews);
      expect(plan.learn.map((l) => l.ayah), `${pace} learn`).toEqual(engine.learn);
    }
    // Non-vacuous: the mix genuinely has due reviews and genuinely unlocks.
    expect(scheduledFor(atoms, 8, "steady").reviews).toBe(2);
    expect(scheduledFor(atoms, 8, "sprint").learn).toEqual([5, 6, 7]);
  });
});
