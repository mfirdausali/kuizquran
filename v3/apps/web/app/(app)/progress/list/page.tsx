// "/progress/list" — THE ACCESSIBLE PROGRESS LIST (WIREFRAME §15).
//
// §15 reads "ensure the progress list is accessible" BOTH ways, and both are
// requirements:
//
//   1. REACHABLE. The ring (§3) and the heatmap are pictures. A plain,
//      sortable, searchable list of every ayah must exist AS ITS OWN ROUTE —
//      it is the only view that scales to a learner with five surahs, and the
//      only one you can search. That is why this is /progress/list and not a
//      tab inside a component.
//
//   2. ACCESSIBLE. This is where a colour-coded ring fails hardest, and §15
//      names five rules. Every one of them is applied in the markup below:
//
//      - NEVER COLOUR ALONE. Every stage carries a TEXT LABEL and a NUMBER.
//        Teal and coral are near-indistinguishable to the ~8% of men with
//        deuteranopia. The `.stage-dot` is decoration ON TOP of the words; it
//        is never the information itself, and it is aria-hidden so a screen
//        reader is not told about a colour it cannot convey. It is rendered
//        by exactly ONE component — `StageBadge` (edge case #87's own
//        resolution), and a test scans the tree to keep it that way.
//      - SEMANTIC <table> with real <th scope=...>, NOT a grid of <div>s — so
//        a screen reader announces "Ayah 3, lapsed, 48%" rather than reading
//        an undifferentiated wall of cells. The tests query by ROLE for
//        exactly this reason: a div grid can be made to look identical and
//        would still pass any class-based assertion.
//      - ARABIC IS dir="rtl" lang="ar"; UI CHROME STAYS ltr. Mixed-direction
//        rows are the classic bug here: a reference like 12:4 sitting beside
//        an Arabic phrase reorders unless it is its own LTR island.
//      - TAP TARGETS >= 44px — supplied by `.row-link`/`.hit`/`.th-sort` in
//        the EXT layer (edge case #82). The locked file is byte-gated and
//        untouched.
//      - RESPECT prefers-reduced-motion — the locked file already kills all
//        animation and transition globally, so there is nothing to add and a
//        weaker duplicate here would only invite someone to "fix" the strong
//        rule.
//
//      And: THIS LIST IS THE RING'S DOCUMENTED TEXT ALTERNATIVE. Not
//      aria-labels bolted onto <circle> elements — a real, navigable page.
//
// ---------------------------------------------------------------------------
// BOTH HALVES OF THE MEMORY GRAPH (edge case #90)
// ---------------------------------------------------------------------------
// The rows are built from the engine's `expand()`, which emits
// `ayah 1, seam 1, ayah 2, …` — so CONNECTION (joint) rows are peers of ayah
// rows rather than an afterthought. #90 is the bug where they are unrendered:
// "connection atoms are ~40% of a short surah's memory graph", so a table of
// ayat alone is half a memory graph wearing the costume of a whole one. The
// `Kind` column carries the word "Joint", because after a sort by strength the
// rows interleave and the arrow inside a reference is easy to miss.
//
// ---------------------------------------------------------------------------
// THE SHAPE OF THIS ROUTE
// ---------------------------------------------------------------------------
// A SERVER COMPONENT that loads the CORPUS and renders a CLIENT ISLAND that
// reads the LOG. That split is edge case #72: a server render has no
// IndexedDB, so it would paint 0% for every atom and the client would hydrate
// with the truth — React keeps the server's number in production and the
// learner is shown a zero for an ayah they are carrying.

import { loadCorpus, AVAILABLE_SURAHS } from "@/lib/corpus/load";
import { ProgressListIsland } from "@/components/progress/ProgressListIsland";

/** Which surah this page lists. A query param today; when a learner can enrol
 *  in several, this becomes the enrolment set and the table gains a surah
 *  column (the row builder is already surah-keyed for it — E-01). */
function parseSurah(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && AVAILABLE_SURAHS.includes(n) ? n : AVAILABLE_SURAHS[0]!;
}

export default async function ProgressListPage({
  searchParams,
}: {
  searchParams: Promise<{ surah?: string }>;
}) {
  const { surah: rawSurah } = await searchParams;
  const surah = parseSurah(rawSurah);
  const corpus = await loadCorpus(surah);

  // `now` is resolved ONCE, on the server, and passed down — so every row in
  // one render decays to the same instant. Reading a clock per row would let
  // two rows disagree about what day it is, which is how a half-life column
  // starts flickering between "9.4 days" and "9.3 days" mid-table.
  const now = Date.now();

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Every ayah</h1>
          <p className="caption">
            The text alternative to the ring: every ayah and every joint, as a
            list you can search and sort.
          </p>
        </header>

        <section className="card" aria-labelledby="list-h">
          <div className="card-header">
            <h2 id="list-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              ALL ITEMS
            </h2>
          </div>

          {corpus === null ? (
            // A designed empty state, never a crash and never a table of
            // fabricated zeros for a surah we have no text for (E-07).
            <p className="stub-note">
              No corpus is available for surah {surah} in this build.
            </p>
          ) : (
            <ProgressListIsland corpus={corpus} now={now} />
          )}
        </section>
      </div>
    </div>
  );
}
