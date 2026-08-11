// "/attribution" — SOURCES AND ATTRIBUTION (build-plan step 30 / M10, v3-D24).
//
// ---------------------------------------------------------------------------
// WHY THIS ROUTE EXISTS AND WHY IT IS UNCONDITIONAL
// ---------------------------------------------------------------------------
// BUILD-PLAN's launch checklist: "QAC/Tanzil attribution page live."
// v3-D24: "Attribution page ships regardless."
//
// "Regardless" means regardless of whether the GPL morphology is stripped from
// the learner bundle. Stripping (now enforced by
// `scripts/check-corpus-morphology.mjs`) narrows the DISTRIBUTION question; it
// does not retire the ATTRIBUTION obligation, because the Quranic Arabic Corpus
// was still used to build the thing being sold. Every distractor in this
// product exists because QAC morphology was consulted at compile time.
//
// ---------------------------------------------------------------------------
// A SERVER COMPONENT, OUTSIDE EVERY ROUTE GROUP
// ---------------------------------------------------------------------------
// It reads no IndexedDB, imports no engine, holds no state, and asks nothing of
// the reader. It sits at the app root rather than inside `(app)` because it
// must be reachable by someone who has never started — a visitor evaluating
// whether to trust the product's handling of religious text is exactly the
// person who reads this page, and they have no tab bar.
//
// ---------------------------------------------------------------------------
// THE PROSE IS DATA
// ---------------------------------------------------------------------------
// Every sentence comes from `lib/legal/attribution.ts`, the same construction
// `app/page.tsx` uses for landing copy. On a page whose entire purpose is to
// make accurate statements about other people's work, the strings need to be
// readable by a test — and a licence name hardcoded into JSX is one nobody can
// check against the vendored source.
//
// ---------------------------------------------------------------------------
// a11y (WIREFRAME §15)
// ---------------------------------------------------------------------------
// A semantic <table> with real column headers, for the same reason the progress
// list is one: a screen reader must announce "Quranic Arabic Corpus, licence,
// GNU General Public License" as a row, not as a wall of cells. Nothing here is
// colour-coded, so there is no colour-alone risk to mitigate. No Arabic is
// rendered on this page, so there is no RTL island — the one place a source
// name could have contained Arabic is deliberately written in Latin script.

import type { Metadata } from "next";
import Link from "next/link";
import {
  BOUNDARIES,
  CORRECTIONS,
  FONTS,
  PAGE,
  SOURCES,
  type AttributionSource,
} from "@/lib/legal/attribution";

export const metadata: Metadata = {
  title: "Sources and attribution — Iman Quiz",
  description:
    "The data and typefaces this product is built on, who made them, and the licence each one carries.",
};

/** One source table. Wide content scrolls inside its own container — the page
 *  body never scrolls horizontally (§15's table rule). */
function SourceTable({
  caption,
  sources,
}: {
  caption: string;
  sources: readonly AttributionSource[];
}) {
  return (
    <div className="table-scroll">
      <table className="progress-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">What we used it for</th>
            <th scope="col">Licence</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.name}>
              {/* A row header, so every other cell in the row announces
                  together with the source's name rather than alone. */}
              <th scope="row">
                <a href={source.url} rel="noreferrer noopener" target="_blank">
                  {source.name}
                </a>
                {source.credit ? <span className="caption">{source.credit}</span> : null}
              </th>
              <td>
                {source.used}
                {source.note ? <span className="caption">{source.note}</span> : null}
              </td>
              <td>{source.licence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AttributionPage() {
  return (
    <main className="screen" id="main">
      <div className="stack">
        <header className="page-head">
          <h1>{PAGE.title}</h1>
          <p className="caption">{PAGE.lead}</p>
          <p className="caption">{PAGE.standing}</p>
        </header>

        <section className="card stack stack--tight" aria-labelledby="data-sources">
          <h2 id="data-sources">Text and data</h2>
          <SourceTable caption="Data sources, what each was used for, and its licence" sources={SOURCES} />
        </section>

        <section className="card stack stack--tight" aria-labelledby="typefaces">
          <h2 id="typefaces">Typefaces</h2>
          <SourceTable caption="Typefaces, what each was used for, and its licence" sources={FONTS} />
        </section>

        <section className="card stack stack--tight" aria-labelledby="boundaries">
          <h2 id="boundaries">What this page does not claim</h2>
          <ul className="stack stack--tight">
            {BOUNDARIES.map((line) => (
              <li key={line} className="caption">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <p className="caption">{CORRECTIONS}</p>

        <div>
          <Link href="/" className="btn btn--ghost hit">
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}
