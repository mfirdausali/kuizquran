// "/practice" — FR6 DOOR 3, THE OPEN-PRACTICE PICKER (build-plan step 18's
// own "three doors after session complete", the one that needed a route of
// its own — see `lib/session/run.ts#startOpenPractice`'s header for why
// `openPracticePick` had zero production callers until now).
//
// This route selects WHICH ayah and HOW HARD. It does not drill — mirrors
// `/drill/page.tsx`'s own split exactly: a SERVER COMPONENT loads the CORPUS
// (content-addressed, static for the life of the process), rendering a CLIENT
// ISLAND. Unlike `/drill`, this picker never reads the log — open practice has
// no readiness precondition, so there is nothing log-derived to get wrong
// between SSR and hydration here (edge case #72 does not apply).
//
// WHICH SURAH (v3-D310). `SessionIsland.tsx`'s own "Practice any ayah
// freely" link (FR6 Door 3) is a bare `href="/practice"` — no `?surah=`
// param — so this route's private `parseSurah`, falling back
// unconditionally to `AVAILABLE_SURAHS[0]`, is what every real tap of that
// button actually hit: a learner enrolled in 67/103/112 who finished a
// session and tapped "Practice any ayah freely" landed on surah 12's own
// picker instead of their own. The exact defect v3-D303 fixed for
// `/plan`/`/progress`/`/progress/list`; `resolveSurah`
// (lib/enrollment/surahCookie.ts) is the one shared resolver, imported here
// instead of a second private copy.

import { cookies } from "next/headers";
import { loadCorpus, AVAILABLE_SURAHS } from "@/lib/corpus/load";
import { PracticePicker } from "@/components/practice/PracticePicker";
import { ENROLLED_SURAH_COOKIE, resolveSurah } from "@/lib/enrollment/surahCookie";

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ surah?: string }>;
}) {
  const { surah: rawSurah } = await searchParams;
  const cookieStore = await cookies();
  const surah = resolveSurah(rawSurah, cookieStore.get(ENROLLED_SURAH_COOKIE)?.value, AVAILABLE_SURAHS);
  const corpus = await loadCorpus(surah);

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Practice any ayah</h1>
          <p className="caption">
            Try any ayah — taught or not — at the difficulty you choose. Free
            practice is evidence, never a grade: nothing here can be damaged.
          </p>
        </header>

        <section className="card" aria-labelledby="picker-h">
          <div className="card-header">
            <h2 id="picker-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              WHAT TO PRACTICE
            </h2>
          </div>

          {corpus === null ? (
            <p className="stub-note">
              No corpus is available for surah {surah} in this build.
            </p>
          ) : (
            <PracticePicker corpus={corpus} />
          )}
        </section>
      </div>
    </div>
  );
}
