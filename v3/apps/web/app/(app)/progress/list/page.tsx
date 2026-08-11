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
//      names five rules. Every one of them is applied in the markup below,
//      even though the rows are still placeholders — because retro-fitting
//      a11y onto a shipped table is how it never happens:
//
//      - NEVER COLOUR ALONE. Every stage carries a TEXT LABEL and a NUMBER.
//        Teal and coral are near-indistinguishable to the ~8% of men with
//        deuteranopia. The `.stage-dot` is decoration ON TOP of the words; it
//        is never the information itself, and it is aria-hidden so a screen
//        reader is not told about a colour it cannot convey.
//      - SEMANTIC <table> with real <th scope=...>, NOT a grid of <div>s — so
//        a screen reader announces "Ayah 3, lapsed, 48%" rather than reading
//        an undifferentiated wall of cells.
//      - ARABIC IS dir="rtl" lang="ar"; UI CHROME STAYS ltr. Mixed-direction
//        rows are the classic bug here: a reference like 12:4 sitting beside
//        an Arabic phrase reorders unless it is its own LTR island.
//      - TAP TARGETS >= 44px — supplied by `.row-link`/`.hit` in the EXT
//        layer (edge case #82). The locked file is byte-gated and untouched.
//      - RESPECT prefers-reduced-motion — the locked file already kills all
//        animation and transition globally, so there is nothing to add and a
//        weaker duplicate here would only invite someone to "fix" the strong
//        rule.
//
//      And: THIS LIST IS THE RING'S DOCUMENTED TEXT ALTERNATIVE. Not
//      aria-labels bolted onto <circle> elements — a real, navigable page.
//
// TODO(build-plan step 10 → M5, WIREFRAME §15): fill the rows.
//   - Every ayah across every enrolled surah, from the engine as data.
//   - CONNECTION ROWS too (edge case #90): connection atoms are ~40% of a
//     short surah's memory graph and are currently unrendered — half the
//     memory graph invisible.
//   - Sort and search, client-side over the rebuilt atoms.
//   - The TIME-ON-TASK column (§15): cumulative per-ayah, reported as time on
//     task and NEVER wall-clock — interrupted latencies are discarded by
//     design (`resume.ts`), so a learner who took a phone call must not look
//     slower than they were. It is also the most motivating honest number the
//     app has: "ayah 1 took you 48 seconds this week, down from 3 minutes."

import { StubNote } from "@/components/shell/StubNote";

export default function ProgressListPage() {
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

          {/* A real semantic table, with the shape the finished one keeps. */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <caption className="sr-only">
                Every ayah and connection you are memorising, with its stage,
                strength, half-life and time on task.
              </caption>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left" }}>
                    Item
                  </th>
                  <th scope="col" style={{ textAlign: "left" }}>
                    Stage
                  </th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Strength
                  </th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Half-life
                  </th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Time on task
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {/* A reference is Latin digits: an LTR island, so it never
                      reorders beside Arabic when the real rows land. */}
                  <th scope="row" style={{ textAlign: "left", fontWeight: 400 }}>
                    <span className="ltr-island">112:1</span>
                  </th>
                  <td>
                    {/* Never colour alone: dot (aria-hidden) + word. */}
                    <span className="stage-label">
                      <span
                        className="stage-dot stage-dot--learn"
                        aria-hidden="true"
                      />
                      <span className="stage-label__name">Not started</span>
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="stage-label__value">0%</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="stage-label__value">—</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="stage-label__value">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <StubNote step="step 10 (M5), WIREFRAME §15">
          Every ayah and every connection across every enrolled surah, sortable
          and searchable, with the time-on-task column. Rows arrive from the
          engine as data — this table never computes a band.
        </StubNote>
      </div>
    </div>
  );
}
