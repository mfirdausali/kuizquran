// THE ENROLLED-SURAH COOKIE — a HINT, never truth (v3-D14's own pattern,
// here applied to enrollment instead of onboarding completion).
//
// `OnboardingChoices.surah` (lib/onboarding/choices.ts) is the only real
// enrollment record, and it lives in IndexedDB, which a Server Component
// cannot read. `/plan`, `/progress` and `/progress/list` are all Server
// Components (edge case #72: a server render has no log, so painting a
// confident page from the WRONG surah's corpus before any client island
// ever mounts is worse than a skeleton) — but they still have to pick WHICH
// surah's corpus to fetch before that first paint.
//
// Named by v3-D301/v3-D302's own pick list: "B — /plan and
// /progress/.../list hardcode 12 (Yusuf) regardless of which surah the
// learner actually enrolled in... a learner who completed a real session in
// 103 saw both tabs say 'Nothing recorded yet'."
//
// This is exactly v3-D14's own cookie-is-a-hint reasoning, moved one field
// over: Safari's ITP caps a script-written cookie's lifetime at 7 days, so
// this can go stale on a returning device — but staleness here means "the
// page falls back to the build default surah until the cookie is next
// written", never a corrupted log or a wrong learner shown. IndexedDB stays
// the only truth; this cookie only ever decides which corpus a server page
// fetches before a client island mounts and reads the real log.
export const ENROLLED_SURAH_COOKIE = "enrolledSurah";

/**
 * Parse a raw string (a query param, or a cookie value) into one of the
 * surahs this build can actually serve, or `null` when it is absent,
 * malformed, or names a surah nothing is compiled for.
 */
function parseSurahCandidate(raw: string | undefined, availableSurahs: readonly number[]): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  return Number.isInteger(n) && availableSurahs.includes(n) ? n : null;
}

/**
 * Decide which surah a server page should load, in priority order:
 *
 *   1. An explicit query param — a direct link always wins, so a bookmark
 *      or a future "view another surah" link is never overridden by a
 *      stale hint.
 *   2. The enrolled-surah cookie hint — what most visits should resolve to,
 *      once `lib/onboarding/choices.ts#commitOnboarding` has written it.
 *   3. `availableSurahs[0]` — the pre-existing default, unchanged for a
 *      device that has neither (a fresh onboarding, or a cleared cookie
 *      jar with IndexedDB not yet re-synced by `EnrollmentSteer`).
 */
export function resolveSurah(
  querySurah: string | undefined,
  cookieSurah: string | undefined,
  availableSurahs: readonly number[],
): number {
  const fromQuery = parseSurahCandidate(querySurah, availableSurahs);
  if (fromQuery !== null) return fromQuery;
  const fromCookie = parseSurahCandidate(cookieSurah, availableSurahs);
  if (fromCookie !== null) return fromCookie;
  return availableSurahs[0]!;
}
