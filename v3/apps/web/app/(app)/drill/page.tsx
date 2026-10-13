// "/drill" — THE CONTINUOUS DRILL PICKER (WIREFRAME §13, build-plan step 20).
//
// This route selects WHAT to drill. It does not drill. The drilling loop, its
// four render shapes and its commit-before-paint discipline live in
// `components/quiz/` and `/session`, and step 20 deliberately does not
// re-implement any of it — a second drill loop is a second place for the
// grading rules to drift.
//
// ---------------------------------------------------------------------------
// THE SHAPE OF THIS ROUTE
// ---------------------------------------------------------------------------
// A SERVER COMPONENT that loads the CORPUS, rendering a CLIENT ISLAND that
// reads the LOG. Corpus is server; log is client (edge case #72). Here the
// split matters more than usual: whether an ayah is READY to drill is a
// log-derived fact, so an SSR'd preview would report every ayah un-learned and
// tell the learner "0 of 10 ayat here are ready" — then hydrate with the truth
// and, in production, keep the lie.
//
// ---------------------------------------------------------------------------
// WHAT THIS BUILD CAN AND CANNOT OFFER
// ---------------------------------------------------------------------------
// The RANGE picker works for any surah the corpus loader can serve.
//
// The MUSHAF PAGE picker requires per-verse page geometry. `CorpusVerse.page`
// is a live field and the compiler populates it (Yusuf spans pages 235–248).
// `lib/corpus/load.ts` now reads that compiled artifact (it used to read
// `packages/engine/test/fixtures/12.json`, which carries `page: null` for all
// 111 verses), so the page picker is genuinely available for every surah in
// `AVAILABLE_SURAHS` once `make compile-corpus` has run. On a checkout that
// has not run it, `loadCorpus` returns null and this route degrades to an
// explanation rather than a crash (edge case #63) — NO page map is ever
// invented to fill the gap.
//
// WHICH SURAH (v3-D310). This route has no in-app link today — reachable
// only by direct URL — but it shared the EXACT defect v3-D303 fixed for
// `/plan`/`/progress`/`/progress/list`: a private `parseSurah` that fell
// back unconditionally to `AVAILABLE_SURAHS[0]` whenever no `?surah=` query
// param was present. `resolveSurah` (lib/enrollment/surahCookie.ts) is the
// ONE place that decision is made, so this route now imports it instead of
// re-deriving a second copy.

import { cookies } from "next/headers";
import { loadCorpus, AVAILABLE_SURAHS } from "@/lib/corpus/load";
import { DrillPicker } from "@/components/drill/DrillPicker";
import { ENROLLED_SURAH_COOKIE, resolveSurah } from "@/lib/enrollment/surahCookie";

export default async function DrillPage({
  searchParams,
}: {
  searchParams: Promise<{ surah?: string }>;
}) {
  const { surah: rawSurah } = await searchParams;
  const cookieStore = await cookies();
  const surah = resolveSurah(rawSurah, cookieStore.get(ENROLLED_SURAH_COOKIE)?.value, AVAILABLE_SURAHS);
  const corpus = await loadCorpus(surah);

  // Resolved ONCE on the server and passed down, so every atom in one render
  // decays to the same instant.
  const now = Date.now();

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Chain a few ayat</h1>
          <p className="caption">
            Pick a stretch to run end to end — a range of ayat, or a page of the
            mushaf. You&apos;ll see exactly what it covers before you start.
          </p>
        </header>

        <section className="card" aria-labelledby="picker-h">
          <div className="card-header">
            <h2 id="picker-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              WHAT TO DRILL
            </h2>
          </div>

          {corpus === null ? (
            <p className="stub-note">
              No corpus is available for surah {surah} in this build.
            </p>
          ) : (
            <DrillPicker corpus={corpus} now={now} />
          )}
        </section>
      </div>
    </div>
  );
}
