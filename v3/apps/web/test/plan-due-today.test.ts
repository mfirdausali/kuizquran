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
