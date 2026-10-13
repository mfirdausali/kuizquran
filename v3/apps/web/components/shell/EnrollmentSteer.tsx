"use client";

// ENROLLMENT STEER — the missing REFRESH for the enrolled-surah cookie hint.
//
// `lib/enrollment/writeSurahCookie.ts`'s own docblock has named this
// component by file path since v3-D303: "mirrored by two callers:
// `lib/onboarding/choices.ts#commitOnboarding` (the moment a fresh
// enrollment is first known) and `components/shell/EnrollmentSteer.tsx`
// (self-healing a device that onboarded before this cookie existed)."
// `lib/enrollment/surahCookie.ts`'s own header makes the same promise. That
// second caller never existed — `grep -rln "EnrollmentSteer"` across
// apps/web returned only the two docblock mentions that promised it.
// `commitOnboarding` writes the cookie exactly ONCE, at onboarding; nothing
// ever refreshed it afterward.
//
// WHY THIS MATTERS, NOT MERELY "SHOULD EXIST". `writeEnrolledSurahCookie`'s
// own `max-age` (180 days) is aspirational — Safari's ITP caps a
// script-written cookie's REAL lifetime at 7 days regardless (both files'
// own headers already say so). A spaced-repetition app's whole premise is
// reviews spaced days-to-weeks apart, so a learner who does not open the
// app for a week is the ORDINARY case, not an edge one. Once the cookie
// expires, `/plan`, `/progress`, `/progress/list`, `/drill` and `/practice`
// (all Server Components, edge case #72) fall back to `AVAILABLE_SURAHS[0]`
// — exactly the "/plan shows the wrong surah" failure v3-D301/D303/D310
// each believed they had closed, reopened by nothing more than a week of
// ordinary use.
//
// Modelled on `OnboardedSteer.tsx`'s own shape (mount effect, renders null,
// never gates paint, never throws into the tree) but reads
// `lib/onboarding/choices.ts#readChoices()` rather than a bare meta key —
// this steer needs the cookie's own VALUE (`choices.surah`), not merely
// whether onboarding happened.

import { useEffect } from "react";
import { readChoices } from "@/lib/onboarding/choices.ts";
import { writeEnrolledSurahCookie } from "@/lib/enrollment/writeSurahCookie.ts";

export function EnrollmentSteer() {
  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const choices = await readChoices();
        if (!alive || choices === null) return;
        writeEnrolledSurahCookie(choices.surah);
      } catch {
        // No real enrollment to refresh, or IndexedDB unreadable (private
        // mode, wedged, blocked upgrade). Losing the refresh costs at most
        // one later visit's render — the page falls back to the build
        // default surah once the cookie finally expires — never the real
        // enrollment, which stays safe in IndexedDB regardless.
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return null;
}
