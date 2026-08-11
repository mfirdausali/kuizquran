"use client";

// THE FOUR THINGS ONBOARDING CAPTURES, AND NOTHING ELSE.
//
// WIREFRAME §17: "Total data captured: gloss language, optional placement
// priors, surah, pace. Nothing else. Every field is consumed by the scheduler;
// if a question doesn't change what the engine does tomorrow, it isn't asked."
//
// That sentence is a SPEC, and this type is where it is enforceable. Every
// member below has to name the engine function that consumes it, or it does not
// belong in the type:
//
//   glossLang  → `corpus.ts#wordGloss(word, lang)` — decides which gloss every
//                meaning question shows, tomorrow and every day after.
//   surah      → the enrollment itself. Without it there is no atom, no queue.
//   pace       → `pace.ts#paceConfig(mode)` — budgetMin, newAyahCeiling and
//                gateTolerance, i.e. how much the scheduler hands out per day
//                and how strict the cold gate is.
//   placement  → `placement.ts` priors, seeding atoms as "known but unstable"
//                so a returning-hifz learner is not marched through ayah 1.
//
// There is no name field, no email field, no age, no country, no "how did you
// hear about us", no goal-setting slider. Not because they would be hard, but
// because none of them changes what the engine does tomorrow, and asking a
// question whose answer changes nothing is a small dishonesty that trains the
// learner to expect larger ones.
//
// ---------------------------------------------------------------------------
// WHY THIS IS WRITTEN ONLY AT THE END
// ---------------------------------------------------------------------------
// `commitOnboarding` is the ONE writer, and it stamps `onboardedAt` in the same
// transaction-shaped sequence as the choices. `OnboardedSteer` reads exactly
// that key to decide whether a returning visitor belongs on /home, so a partial
// write — choices without the stamp, or a stamp without choices — would either
// strand a learner in onboarding forever or drop them on a dashboard with no
// enrollment. Screens 1–6 hold their answers in React state and commit once.
//
// It also means a learner who abandons onboarding halfway has left NOTHING on
// the device, which is the correct reading of "recall before identity": we did
// not quietly keep what they chose before they agreed to start.

import { openDb } from "@/lib/idb";
import type { GlossLang } from "@engine/types.ts";
import type { PaceMode } from "@engine/pace.ts";

/** Placement priors — screen 4's output, and the only optional member.
 *  `skipped` is a first-class answer, not an absence: §17 makes screen 4
 *  skippable with "default fresh", and a learner who skipped is materially
 *  different from one who probed and carried nothing. */
export type PlacementOutcome =
  | { kind: "skipped" }
  | { kind: "fresh" }
  | { kind: "carried"; throughAct: number; probed: number };

export interface OnboardingChoices {
  glossLang: GlossLang;
  surah: number;
  pace: PaceMode;
  placement: PlacementOutcome;
}

/** The meta keys onboarding owns. Named here so no surface spells them inline
 *  — `OnboardedSteer` already reads `onboardedAt`, and a typo'd second spelling
 *  of that key would silently strand every returning learner. */
export const ONBOARDED_AT = "onboardedAt";
export const CHOICES = "onboardingChoices";

/**
 * Commit the four answers and stamp the device as onboarded.
 *
 * ORDER IS LOAD-BEARING: the choices go in FIRST and `onboardedAt` LAST, in one
 * readwrite transaction. `OnboardedSteer` treats the stamp as proof that a
 * learner exists on this device, so the stamp must never be visible before the
 * data it vouches for.
 */
export async function commitOnboarding(
  choices: OnboardingChoices,
  now: number,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  await tx.store.put({ key: CHOICES, value: choices });
  await tx.store.put({ key: ONBOARDED_AT, value: now });
  await tx.done;
}

/** Read back the committed choices, or null on a device that never onboarded. */
export async function readChoices(): Promise<OnboardingChoices | null> {
  const db = await openDb();
  const row = await db.get("meta", CHOICES);
  const value = row?.value;
  if (typeof value !== "object" || value === null) return null;
  return value as OnboardingChoices;
}

/**
 * The device's default gloss language (§17 screen 3: "Default = device
 * locale"). EN unless the browser's language is Malay — the only two the corpus
 * carries (v2-D27; `ja` stays deferred).
 *
 * Defaulting is not deciding: screen 3 still shows both and still needs a tap.
 */
export function defaultGlossLang(): GlossLang {
  try {
    const langs = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
    for (const tag of langs) {
      const primary = String(tag).toLowerCase().split("-")[0];
      if (primary === "ms" || primary === "id") return "ms";
      if (primary === "en") return "en";
    }
  } catch {
    // A locked-down or unusual environment. EN is the documented fallback.
  }
  return "en";
}
