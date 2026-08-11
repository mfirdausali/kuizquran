// "/library" — THE SURAH LIBRARY (WIREFRAME §2).
//
// Browsing, and committing to, a new surah. A SERVER COMPONENT by design: the
// library is corpus-shaped content, and "corpus is server, log is client" is
// the boundary the whole app is built on. It reads no IndexedDB.
//
// TODO(build-plan step 6 → M5/M6, WIREFRAME §2): the real library.
//   - The 43-surah launch list, from a MANIFEST — not N corpus fetches
//     (edge case E-07: N surahs = N fetches per load, one 404 breaks the page;
//     a missing corpus must degrade to a DISABLED row, never a crash).
//   - The "Add" confirm, which is the single most important control on this
//     page: it must show the RE-COMPUTED ETAs of the surahs the learner
//     ALREADY has, not just the new one's (edge case E-06). With N surahs
//     there are N independent decay curves competing for one daily budget;
//     adding a third surah silently starves the first two unless that cost
//     surfaces BEFORE the commitment.
//   - Entitlement gating for non-trial surahs (build-plan step 28 / M7).
//
// The list rows are already >= 44px by construction (`.row-link`, ext layer),
// so edge case #82 is satisfied without touching the locked file.

import Link from "next/link";
import { StubNote } from "@/components/shell/StubNote";

export default function LibraryPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Library</h1>
          <p className="caption">
            Choose a surah to memorise. Adding one costs daily time — the
            confirm will say how much, before you commit.
          </p>
        </header>

        <section className="card" aria-labelledby="lib-list-h">
          <div className="card-header">
            <h2 id="lib-list-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              SURAHS
            </h2>
          </div>
          {/* One real link so the route tree is navigable end-to-end today.
              The surah's NAME is Latin metadata, not Quranic text — every
              Arabic glyph this app paints arrives at runtime from the corpus. */}
          <nav aria-label="Surahs">
            <Link href="/surah/112" className="row-link">
              <span>112 · Al-Ikhlas</span>
              <span className="meta-line">4 ayat</span>
            </Link>
          </nav>
        </section>

        <StubNote step="step 6 (M5/M6), WIREFRAME §2">
          The full launch library from a manifest, per-surah metadata, the
          recommender ordering, and the Add confirm showing re-computed ETAs
          for the surahs you already have (edge case E-06).
        </StubNote>
      </div>
    </div>
  );
}
