// "/library" — THE SURAH LIBRARY (WIREFRAME §2).
//
// Browsing, and committing to, a new surah. A SERVER COMPONENT by design: the
// offered set and what this build can serve are both BUILD-TIME facts, and
// "corpus is server, log is client" is the boundary the whole app is built on.
// This file reads no IndexedDB. The one per-learner fact on the page — which
// surah you are already enrolled in — arrives from a client island, because
// that fact lives in the log and an RSC would paint it wrong (edge case #72).
//
// ---------------------------------------------------------------------------
// WHAT CHANGED FROM THE STUB, AND WHY ITS OWN NOTES WERE WRONG
// ---------------------------------------------------------------------------
// The stub promised "the 43-surah launch list, from a MANIFEST". Both halves
// are stale:
//
//   - There is no 43-surah launch list. BUILD-PLAN Q3 was answered on
//     2026-08-11 and the offered set is FOUR, fixed in `lib/onboarding/surahs.ts`.
//   - A manifest now EXISTS at `packages/corpus-compiler/output/manifest.json`,
//     but it is NOT fetchable: `output/` is gitignored (v3-D52) and
//     `stage-corpus.mjs` stages only the per-surah corpus JSONs into
//     `public/corpus/`. A page that fetched it would work on a machine that had
//     run `make compile-corpus` and break on every clean checkout. The static
//     list stays the correct source, exactly as `surahs.ts`'s own header argues.
//
// The stub also shipped ONE link, to `/surah/112` — and that link lands on
// "no compiled corpus is available for this surah yet", because the server
// loader serves only surah 12. That is the dead end this page had to fix, and
// it could not be fixed by simply listing all four: that multiplies one dead
// end into three. See `lib/library/rows.ts` for the per-surface availability
// split and why each row says which half of the experience is ready.
//
// E-07 ("N surahs = N fetches per load, one 404 breaks the page") is satisfied
// by construction: rendering these rows performs ZERO corpus fetches.
//
// The rows are >= 44px by construction (`.row-link`, ext layer), so edge case
// #82 is satisfied without touching the locked file.

import Link from "next/link";
import { StubNote } from "@/components/shell/StubNote";
import { EnrolledMarker } from "@/components/library/EnrolledMarker";
import { libraryRows } from "@/lib/library/rows.ts";

export default function LibraryPage() {
  // Computed on the server from build-time constants. The view below prints
  // these rows and compares nothing — deciding what a learner may do with a
  // surah is a decision, and decisions live in lib/ (v3/CLAUDE.md rule 4).
  const rows = libraryRows();

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Library</h1>
          {/* The stub's caption promised the confirm would say what a surah
              costs per day before you commit. That confirm is NOT built (see
              the StubNote below), and a caption promising a control that does
              not exist is the same dishonesty as a stub that looks finished.
              So this says what the page actually does today. */}
          <p className="caption">
            The surahs this build can teach, shortest first. Each row says what
            is ready for it today.
          </p>
        </header>

        <section className="card" aria-labelledby="lib-list-h">
          <div className="card-header">
            <h2 id="lib-list-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              SURAHS
            </h2>
          </div>
          {/* A surah's NAME is Latin metadata, not Quranic text — every Arabic
              glyph this app paints arrives at runtime from the corpus. */}
          <nav aria-label="Surahs">
            {rows.map((row) => (
              <Link key={row.surah} href={row.href} className="row-link">
                <span>{row.label}</span>
                <span className="meta-line">{row.status}</span>
              </Link>
            ))}
          </nav>
        </section>

        {/* The one per-learner fact on the page, and the only client code here.
            It reads the enrollment out of IndexedDB and names it, so a learner
            who already started a surah is not shown four choices as if they had
            made none. Kept OUT of the list above deliberately: marking a row
            would mean the server-rendered list depended on a client read, which
            is edge case #72's exact shape. */}
        <EnrolledMarker />

        <StubNote step="step 6 (M5/M6) + step 30, WIREFRAME §2">
          Adding a second surah. The confirm that must show the RE-COMPUTED
          daily cost of the surahs you already have — not just the new one&apos;s
          (edge case E-06) — and the recommender that would order this list by
          more than length. Today enrollment is chosen once, during onboarding,
          so these rows link to each surah rather than adding it. Access gating
          for non-trial surahs is build-plan step 28 and is not built either.
        </StubNote>
      </div>
    </div>
  );
}
