// WHAT THE LIBRARY CAN HONESTLY SAY ABOUT EACH OFFERED SURAH.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS RATHER THAN A TERNARY IN THE PAGE'S JSX
// ---------------------------------------------------------------------------
// The library lists the surahs a learner may enroll in. The offered set is
// `lib/onboarding/surahs.ts#OFFERED_SURAHS` and is NOT restated here — this
// module decorates that list, it does not duplicate it. A second copy of the
// list is the drift that `test/onboarding.test.tsx` already guards against for
// the ayah counts, and there is no reason to reintroduce it one directory over.
//
// What this module adds is the fact the stub library got WRONG: which surahs
// the app can actually serve, and on WHICH SURFACE. That is a real distinction
// today and the page cannot be honest without it.
//
// ---------------------------------------------------------------------------
// AVAILABILITY IS PER-SURFACE, NOT PER-SURAH — THE FACT THE STUB MISSED
// ---------------------------------------------------------------------------
// There are two corpus loaders and they serve DISJOINT sets:
//
//   `lib/corpus/staged.ts#CLIENT_SURAHS`  = [112, 103, 67]  — staged into
//        `public/corpus/`, fetched by the browser. This is what /session
//        drills, so these three are the surahs a learner can actually PRACTISE.
//
//   `lib/corpus/load.ts#AVAILABLE_SURAHS` = [12]            — read from disk on
//        the server. This is what /surah/N renders its macro panel and ayah
//        facts from, so surah 12 is the only one with a populated surah PAGE.
//
// The consequence is uncomfortable and worth stating plainly: for 112, 103 and
// 67, `/surah/N` renders "no compiled corpus is available for this surah yet",
// because `loadCorpus` returns null for anything outside AVAILABLE_SURAHS. The
// stub library shipped exactly one link, to `/surah/112`, and that link landed
// on that empty state. Listing all four without saying so would have multiplied
// one dead end into three while looking more finished.
//
// So a row does not carry a single "available" boolean. It carries what the
// learner can do with that surah TODAY, on each surface, and the page prints
// it. Nothing here is disabled: all four routes render a real page, and three
// of the four are genuinely practisable — marking those "unavailable" because
// the SERVER loader lacks them would be a lie in the opposite direction.
//
// ---------------------------------------------------------------------------
// WHY THIS IS BUILD-TIME DATA AND NOT A MANIFEST FETCH (E-07)
// ---------------------------------------------------------------------------
// `packages/corpus-compiler/output/manifest.json` is real and carries exactly
// these facts — but `output/` is gitignored (v3-D52) and `stage-corpus.mjs`
// copies only the per-surah corpus JSONs into `public/corpus/`, never the
// manifest. There is therefore no manifest URL a browser can fetch and no
// manifest path a clean checkout is guaranteed to have. A page that read it
// would be green on a machine that has run `make compile-corpus` and broken
// everywhere else.
//
// Deriving availability from constants that already exist is also the E-07 fix
// itself: "corpus fetch is per-surah and unguarded — N fetches per load, one
// 404 breaks the page." This page performs ZERO corpus fetches to render N
// rows, so there is no 404 to break it.

// From `staged.ts`, NOT from `client.ts`. `client.ts` is a `"use client"`
// module, and importing this constant across that boundary into this
// server-consumed module hands back a client-reference proxy instead of the
// array — which failed the production prerender of /library with
// "CLIENT_SURAHS.includes is not a function" while every other gate passed.
import { CLIENT_SURAHS } from "@/lib/corpus/staged.ts";
import { AVAILABLE_SURAHS } from "@/lib/corpus/load";
import { OFFERED_SURAHS, surahLabel, type OfferedSurah } from "@/lib/onboarding/surahs";

/**
 * One row of the library, ready to render.
 *
 * The view prints these strings and compares nothing. Deciding what a learner
 * may do with a surah is a decision, and decisions do not live under `app/` or
 * `components/` (v3/CLAUDE.md rule 4).
 */
export interface LibraryRow {
  surah: number;
  /** "112 · Al-Ikhlas · 4 ayat" — from `surahLabel`, never re-formatted here. */
  label: string;
  /** Where the row goes. Every offered surah has a real page at this path. */
  href: string;
  /**
   * Can the learner DRILL this surah? True when the corpus is staged for the
   * browser, because that is what /session reconstructs from.
   */
  practisable: boolean;
  /**
   * Does `/surah/N` have a corpus to render its structure and ayat from?
   * True only for surahs the SERVER loader can read.
   */
  detailed: boolean;
  /**
   * The one short phrase the row shows on the right. Written here so the two
   * booleans above are turned into words ONCE, rather than in a JSX ternary
   * that the next surface would copy and let drift.
   */
  status: string;
}

/**
 * The four honest states, named. Exported so a test can assert the page prints
 * a DIFFERENT one for a drillable surah than for a server-only one — an
 * assertion that fails the moment someone marks every row the same.
 */
export const STATUS_READY = "ready to practise";
export const STATUS_PRACTISE_ONLY = "ready to practise · overview coming";
export const STATUS_BROWSE_ONLY = "browse only · practice coming";
export const STATUS_UNAVAILABLE = "not in this build yet";

/** Turn one offered surah into a row. Not exported: the list is the API. */
function rowFor(s: OfferedSurah): LibraryRow {
  const practisable = CLIENT_SURAHS.includes(s.surah);
  const detailed = AVAILABLE_SURAHS.includes(s.surah);

  // Ordered most-capable first. A surah that is both drillable and has a
  // populated detail page needs no qualifier; the other three do, and saying
  // WHICH half is missing is the whole point of the row.
  const status = practisable
    ? detailed
      ? STATUS_READY
      : STATUS_PRACTISE_ONLY
    : detailed
      ? STATUS_BROWSE_ONLY
      : STATUS_UNAVAILABLE;

  return {
    surah: s.surah,
    label: surahLabel(s),
    href: `/surah/${s.surah}`,
    practisable,
    detailed,
    status,
  };
}

/**
 * Every surah the library offers, in the order onboarding offers them
 * (shortest-first — the honest ordering for a commitment).
 *
 * The recommender proper is build-plan step 30. This is not it, and the page
 * says so: an ordering by length is a fact, not a recommendation dressed up as
 * one.
 */
export function libraryRows(): readonly LibraryRow[] {
  return OFFERED_SURAHS.map(rowFor);
}
