// LOCALE DICTIONARIES — the scaffold v3-D15's post-launch Malay will land in.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS BEFORE THERE IS A SECOND LOCALE
// ---------------------------------------------------------------------------
// v3-D15 ships Malay AFTER launch. The expensive part of that change is never
// the translation — it is discovering, on the day the translator delivers,
// that every section component reads a module-scoped `HERO` constant directly
// and therefore cannot be handed a different language without editing all
// eight of them. This file is the seam, put in now while there is exactly one
// locale and the shape is free to get right.
//
// ---------------------------------------------------------------------------
// EN ONLY. NO MALAY STRINGS ARE AUTHORED HERE.
// ---------------------------------------------------------------------------
// There is no `ms.ts`, and this file does not stub one with English text
// wearing a Malay key. A dictionary whose Malay entries are silently English
// is worse than a missing locale: it type-checks, it renders, and it ships an
// untranslated page that looks translated. When a human translator delivers
// real Malay copy, it arrives as a new module satisfying `LandingDictionary`
// and is registered in the map below — a two-line change, which is the whole
// point of building the seam early.
//
// ---------------------------------------------------------------------------
// THE CLAIM CHECKER STILL SEES EVERYTHING (v3-D19)
// ---------------------------------------------------------------------------
// This is the constraint that shapes the file. `check-boundaries.mjs` clause 11
// scans `lib/landing/**` SOURCE, and `test/landing-claims.test.ts` scans the
// runtime values of `landingStrings()`. A dictionary layer that COPIED the
// English strings into a new structure would give the page a second source of
// prose — and the copy that actually rendered might not be the copy either
// check read.
//
// So this file holds NO STRINGS OF ITS OWN. The English dictionary IS the
// existing copy module, re-exported. There is exactly one place a landing
// sentence is written, it is still `lib/landing/copy.ts`, and both halves of
// the v3-D19 check still cover the text that ships.

import {
  DEMO,
  FOOTER,
  HERO,
  MECHANISM,
  OBJECTIONS,
  PLAN,
  PRICING_COPY,
  PROOF,
} from "@/lib/landing/copy";

/** The shape every locale must satisfy. Derived from the English module rather
 *  than declared by hand, so a field added to the copy becomes a field a
 *  translation is REQUIRED to supply — a hand-written interface would drift
 *  and the missing sentence would surface as a blank on the page. */
export interface LandingDictionary {
  hero: typeof HERO;
  demo: typeof DEMO;
  mechanism: typeof MECHANISM;
  plan: typeof PLAN;
  objections: typeof OBJECTIONS;
  proof: typeof PROOF;
  pricing: typeof PRICING_COPY;
  footer: typeof FOOTER;
}

/** English. Assembled from the copy module's own constants — this object
 *  introduces no new prose, it only groups what already exists. */
const en: LandingDictionary = {
  hero: HERO,
  demo: DEMO,
  mechanism: MECHANISM,
  plan: PLAN,
  objections: OBJECTIONS,
  proof: PROOF,
  pricing: PRICING_COPY,
  footer: FOOTER,
};

/** The registry. `ms` joins this map when a human delivers the translation
 *  (v3-D15); until then a single entry is the honest state. */
const DICTIONARIES = { en } as const;

export type Locale = keyof typeof DICTIONARIES;

export const LOCALES = Object.keys(DICTIONARIES) as Locale[];

/** The locale the app serves today. Named as a constant rather than inlined so
 *  that the day a second locale exists, the router change has one place to
 *  replace and the search for "where is the locale decided" has one answer. */
export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (value: string): value is Locale => value in DICTIONARIES;

/**
 * The active dictionary.
 *
 * Synchronous and parameterless today because there is one locale and the
 * landing page is a cacheable Server Component (v3-D14) that must not become
 * async for a lookup that cannot fail. When `[lang]` routing lands this gains
 * its parameter; every call site already goes through this function, so that
 * is a change to one file rather than to eight sections.
 */
export function getDictionary(locale: Locale = DEFAULT_LOCALE): LandingDictionary {
  return DICTIONARIES[locale];
}
