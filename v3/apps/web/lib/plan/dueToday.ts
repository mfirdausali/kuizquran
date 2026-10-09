// /plan's "TODAY" row — what is actually due right now, the only day
// genuinely knowable (WIREFRAME §14), which is precisely why it is the only
// day that gets named items.
//
// THIS MODULE DECIDES NOTHING OF ITS OWN. Every fact it reports is the
// engine's own answer to the same question the session assembler asks:
//
//   gates   — `gate.ts#gateDue()`            (v3-D228)
//   learn   — `pace.ts#candidatesForPace()`  (v3-D238), and only while the
//             scheduler's own `gate.ts#unlockPermitted()` admits a new unlock
//             under the pace's `gateTolerance` (v3-D295)
//   reviews — `scheduler.ts#isReviewDue()`   (v3-D295) — the exact predicate
//             `assembleQueue`'s step 3 admits a review by
//
// v3-D295: this lived in `components/plan/PlanIsland.tsx` and counted reviews
// as "encoded and not yet in the carry band" — a second rule for a decision
// the scheduler already makes, disagreeing in both directions (a just-encoded
// ayah whose cold gate is merely ARMED read as a review; a carry-band ayah
// already past `REVIEW_RISK_THRESHOLD` did not) — and named a Learn while a
// due gate held `unlockPermitted()` shut. `lib/home/queue.ts`'s own header
// named that function "an APPROXIMATION of the queue". It moved here because
// asking `unlockPermitted` is a scheduling decision, and check-boundaries.mjs
// clause 5 forbids one in a view.
//
// WHAT THIS STILL IS NOT: the fitted session. Counts here are what is DUE,
// before `assembleQueue` fits reviews to the learner's minutes — the forecast
// row then prices them in minutes itself. `lib/home/queue.ts` shows the fitted
// count, because a dashboard CTA starts that exact queue.
//
// Pure. `now` is passed in.

import type { Corpus } from "@engine/types.ts";
import type { AtomState } from "@engine/atom.ts";
import { atomKey } from "@engine/atom.ts";
import { gateDue, unlockPermitted } from "@engine/gate.ts";
import { candidatesForPace, DEFAULT_PACE_MODE, paceConfig, type PaceMode } from "@engine/pace.ts";
import { isReviewDue } from "@engine/scheduler.ts";

export interface DueToday {
  gates: { surah: number; ayah: number }[];
  reviews: number;
  learn: { surah: number; ayah: number }[];
}

/** `pace` defaults to Steady so every pre-existing caller/test is unchanged. */
export function dueToday(
  corpus: Corpus,
  atoms: Map<string, AtomState>,
  now: number,
  pace: PaceMode = DEFAULT_PACE_MODE,
): DueToday {
  const surah = corpus.meta.surah;
  const gates: { surah: number; ayah: number }[] = [];
  const learnCandidates: number[] = [];

  for (let ayah = 1; ayah <= corpus.meta.ayahCount; ayah++) {
    const atom = atoms.get(atomKey(surah, "ayah", ayah));
    // `gateDue` is asked FIRST, for any atom that exists, so the delegation
    // `plan-due-today.test.ts` pins stays discriminating: an inline copy
    // lacking `gateDue`'s own `encoded` term would still be caught listing a
    // stray `gateDueAt` on an un-encoded atom.
    if (atom && gateDue(atom, now)) {
      gates.push({ surah, ayah });
    } else if (!atom || !atom.encoded) {
      // Every unencoded ayah is a real candidate — mirroring `run.ts
      // #learnCandidatesFor`'s own shape — capped below to the mode's actual
      // ceiling, never to a hardcoded 1. v3-D252: "unencoded" includes an
      // atom row that EXISTS with `encoded: false` (a demoted ayah, or an
      // abandoned Learn pass).
      learnCandidates.push(ayah);
    }
  }

  // Over EVERY atom of this surah, ayah and connection alike — exactly the
  // set `assembleQueue` step 3 ranks. A gate-due atom is never also a review:
  // `isReviewDue` requires `gatePassed`, which `gateDue` requires false.
  const surahAtoms = [...atoms.values()].filter((a) => a.surah === surah);
  const reviews = surahAtoms.filter((a) => isReviewDue(a, now)).length;

  const unlockOpen = unlockPermitted(surahAtoms, now, surah, paceConfig(pace).gateTolerance);
  const learn = unlockOpen
    ? candidatesForPace(learnCandidates, pace).map((ayah) => ({ surah, ayah }))
    : [];
  return { gates, reviews, learn };
}
