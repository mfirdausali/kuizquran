// WHAT SCREEN 5 IS ALLOWED TO OFFER.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS RATHER THAN A LIST IN THE JSX
// ---------------------------------------------------------------------------
// WIREFRAME §17 screen 5 names Al-Mulk (surah 67, 30 ayat, ~5 weeks) as the
// pre-selected default and calls this "the learner's one real choice."
//
// Surah 67 IS NOT IN THIS BUILD. Verified against
// `packages/corpus-compiler/output/manifest.json`, which carries exactly three
// surahs: 12 (111 ayat, authored distractors, mental model), 103 (3 ayat) and
// 112 (4 ayat). Offering Al-Mulk would enroll a learner in a surah the app
// cannot serve a single ayah of — they would finish onboarding, land on the
// dashboard, and find nothing to do. That is worse than a shorter list.
//
// So the list is what is actually compiled, and the wireframe's default is
// recorded here as an intent that the data does not yet support. The day 67
// compiles, it appears in this list and becomes the default WITHOUT a change to
// any component — which is the point of putting it here rather than in JSX.
//
// ---------------------------------------------------------------------------
// WHY THE LIST IS STATIC DATA AND NOT A MANIFEST FETCH
// ---------------------------------------------------------------------------
// Edge case E-07: "corpus fetch is per-surah and unguarded — N fetches per
// load, one 404 breaks the page." A picker that fetched each surah's corpus to
// learn its ayah count would be exactly that defect. The real fix is a
// MANIFEST, and the manifest is a build-plan item that has not landed. Until it
// does, this file holds the small facts the picker needs — ayah counts, which
// are corpus META and not Quranic text — and the test asserts they match the
// compiled manifest, so a drift fails rather than misleads.

/** The surah §17 names as the default. Recorded so the intent is not lost when
 *  the data catches up — see the header for why it is not offered today. */
export const WIREFRAME_DEFAULT_SURAH = 67;

/**
 * WHERE A LEARNER WITH NO ENROLLMENT IS SENT.
 *
 * The `(onboarding)` route group contributes no URL segment, so the seven
 * screens live at `/start`. `/onboarding` is NOT a route and never was —
 * `SessionGate` linked there and 404'd every learner who reached it without an
 * enrollment, i.e. exactly the learner that screen exists to rescue.
 *
 * It is named here, beside the rest of onboarding's facts, for the same reason
 * `OFFERED_SURAHS` is: a route spelled inline in two components is a route that
 * can be right in one and wrong in the other, and it was.
 */
export const ONBOARDING_HREF = "/start";

export interface OfferedSurah {
  surah: number;
  /** The surah's NAME is Latin metadata, not Quranic text. */
  name: string;
  ayahCount: number;
}

/**
 * The surahs this build can honestly enroll a learner in.
 *
 * Ordered shortest-first: a learner choosing their first surah is choosing a
 * commitment, and the honest ordering is by what that commitment costs.
 *
 * Surah 12 (Yusuf) is 111 ayat — a genuine multi-month commitment, and the only
 * one here with authored distractors and a mental model. It is offered, not
 * defaulted, for exactly that reason.
 */
export const OFFERED_SURAHS: readonly OfferedSurah[] = [
  { surah: 112, name: "Al-Ikhlas", ayahCount: 4 },
  { surah: 103, name: "Al-Asr", ayahCount: 3 },
  // Al-Mulk — WIREFRAME §17's own named default, and BUILD-PLAN Q3's answer
  // (ratified by Firdaus 2026-08-11). Vendored from the Quran.com API and
  // compiled the same day: 30 ayat, 333 words, pages 562-564, cross-checked
  // against QAC's independent 30/333 count before being committed.
  //
  // It is listed here because the test that guarded this gap ("does NOT offer
  // the wireframe's default, because it is not compiled") was written to FAIL
  // the day 67 compiled, precisely so a human would decide rather than drift
  // into offering it. This is that decision.
  { surah: 67, name: "Al-Mulk", ayahCount: 30 },
  { surah: 12, name: "Yusuf", ayahCount: 111 },
];

/**
 * The pre-selected default (§17: "no, pre-selected").
 *
 * Al-Asr, at 3 ayat: the shortest complete surah in this build, which makes it
 * the one a learner can carry to the first cold gate fastest — and the gate
 * passing is what proves the mechanism. §17's own default (Al-Mulk) is a
 * ~5-week commitment; picking the longest AVAILABLE surah instead would not
 * honour that intent, it would just be a different bet with worse odds.
 */
export const DEFAULT_SURAH = 103;

/** "103 · Al-Asr · 3 ayat" — the number, the name, and the commitment. */
export function surahLabel(s: OfferedSurah): string {
  return `${s.surah} · ${s.name} · ${s.ayahCount} ayat`;
}
