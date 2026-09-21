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
