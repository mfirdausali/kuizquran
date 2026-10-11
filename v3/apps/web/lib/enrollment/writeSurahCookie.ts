"use client";

// THE CLIENT-SIDE HALF of surahCookie.ts's hint — see that file's header for
// the full reasoning. This is the ONE place `document.cookie` is written for
// it, mirrored by two callers: `lib/onboarding/choices.ts#commitOnboarding`
// (the moment a fresh enrollment is first known) and
// `components/shell/EnrollmentSteer.tsx` (self-healing a device that
// onboarded before this cookie existed).

import { ENROLLED_SURAH_COOKIE } from "@/lib/enrollment/surahCookie.ts";

/**
 * Mirror the learner's enrolled surah into the hint cookie.
 *
 * `max-age` is long enough to outlive an ordinary session; Safari's ITP caps
 * a script-written cookie at 7 days regardless, and that cap is fine — see
 * surahCookie.ts's own header. Never throws: a locked-down environment
 * (cookies disabled, a private-mode edge case, or no `document` at all in a
 * non-browser test) loses only the hint, never the real enrollment, which
 * stays safe in IndexedDB.
 */
export function writeEnrolledSurahCookie(surah: number): void {
  try {
    const maxAgeSeconds = 180 * 86_400;
    document.cookie = `${ENROLLED_SURAH_COOKIE}=${surah}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
  } catch {
    // See header: losing the hint costs one render's worth of "shows the
    // build default surah until the cookie can be written again", never
    // the learner's real enrollment.
  }
}
