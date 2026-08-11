// THE MACRO PANEL — v3-D02 / v3-D21, design §A.
//
// ---------------------------------------------------------------------------
// WHAT THIS COMPONENT DECIDES: NOTHING.
// ---------------------------------------------------------------------------
// It switches on `facts.archetype`, which is a LITERAL STRING computed at
// build time by corpus-compiler/src/macro.ts. There is no ayah-count
// comparison here, no ruku test, no rhyme share, no `<= 8` and no `<= 9`.
// Every threshold v3-D21 and edge case #89 name lives in that one compiler
// module and is expressed exactly once.
//
// That is v3/CLAUDE.md rule 4 taken at its intent rather than at the letter of
// the regex: `ayahCount <= 8` would slip past check-boundaries.mjs clause 5's
// current pattern, and a gate that does not catch a violation does not make
// the violation legal. (Step 19 extends clause 5 for exactly this.)
//
// ---------------------------------------------------------------------------
// TWO PROPS, DELIBERATELY
// ---------------------------------------------------------------------------
// `facts` is corpus-derived and learner-INVARIANT — server, cacheable, in the
// RSC payload. `nodes` is log-derived and PER-LEARNER, so it arrives from a
// client island. Keeping them separate is what stops someone merging them into
// one server fetch and reintroducing edge case #72: an RSC has no log, paints
// 0, and the client then hydrates 4 — "0 ayat due" shown to a learner who has
// four is a retention-honesty violation, not a warning.

import type { MacroFacts } from "./facts.ts";
import type { GraphNode, HighlightRef } from "./graphNodes.ts";
import { RingDiagram } from "./RingDiagram.tsx";

export interface MacroPanelProps {
  surah: number;
  facts: MacroFacts;
  nodes: GraphNode[];
  /** "You are here", for the ayah detail route's bridge (WIREFRAME §4).
   *
   *  A COORDINATE, NEVER A FILTERED `nodes`. The detail page shows the SAME
   *  full graph as the surah page and flags one mark, because filtering to the
   *  current ayah would drop every seam — and a bridge that hides the joints is
   *  a bridge that hides ~40% of a short surah's memory graph (#90). */
  highlight?: HighlightRef;
}

/** The panel's heading id, exported so the page and the tests refer to the
 *  same string rather than to two copies of it. */
export const MACRO_HEADING_ID = "macro-h";

export function MacroPanel({ surah, facts, nodes, highlight = null }: MacroPanelProps) {
  // ---- ATOMIC: NO PANEL. Not hidden, not collapsed, not "no structure
  // available" — ABSENT. v3-D21: "ATOMIC surahs get no panel — at 3-8 ayat the
  // list is already the macro view."
  //
  // What makes that claim TRUE rather than merely asserted is that the ayah
  // list on this page renders the seams between its rows (the surah page's
  // AyahList). A 3-ayah surah then shows 3 ayah rows and 2 joint rows — 5
  // marks, the complete memory graph, exactly what a ring would have shown.
  // Without that, ATOMIC would be the WORST case for edge case #90 rather than
  // an exempt one: no panel AND no seams is 40% of Al-Asr invisible.
  if (facts.archetype === "ATOMIC") return null;

  return (
    <section className="card" aria-labelledby={MACRO_HEADING_ID}>
      <div className="card-header">
        <h2 id={MACRO_HEADING_ID} style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          STRUCTURE
        </h2>
        <span className="caption">{titleFor(facts)}</span>
      </div>

      <RingDiagram
        surah={surah}
        nodes={nodes}
        layout={facts.layout}
        idPrefix={`macro-${surah}`}
        highlight={highlight}
      />

      {/* The archetype-specific reading of the same graph. */}
      {facts.archetype === "RING" && facts.ring ? <RingLegend facts={facts} /> : null}
      {facts.archetype === "LITANY" && facts.litany ? <LitanyLegend facts={facts} /> : null}
      {facts.archetype === "ARC" && facts.arc ? <ArcLegend facts={facts} /> : null}

      {/* ---- THE HONESTY LABEL (edge case #22 / WIREFRAME §10) ----
          ARC's beats are AUTHORED CONTENT, budgeted to M9. Until they land,
          the structure shown is an even partition this app computed, and
          presenting it as though a human had segmented the surah would be the
          structural version of the dishonest number §10 forbids. So the panel
          says what it is. The label is on `authored === false` alone, never on
          the archetype, so it disappears by itself when the beats arrive. */}
      {!facts.authored ? (
        <p className="stub-note graph-derived">
          This outline is <strong>derived</strong> — an even split of the surah,
          not an authored structure. The ayah and joint strengths above are real.
        </p>
      ) : null}
    </section>
  );
}

/** The one-line caption under the heading. A WORD for the shape, so the panel
 *  is identifiable without reading the diagram (§15's never-colour-alone
 *  applied to structure). */
function titleFor(facts: MacroFacts): string {
  switch (facts.archetype) {
    case "RING":
      return `Ring · ${facts.ring?.rukuCount ?? 0} sections`;
    case "LITANY":
      return facts.litany && facts.litany.refrainAyat.length > 0
        ? `Litany · a refrain returns ${facts.litany.refrainAyat.length} times`
        : "Litany · one rhyme carries the surah";
    case "ARC":
      return "Arc · a narrative shape";
    case "ATOMIC":
      return "";
  }
}

function RingLegend({ facts }: { facts: MacroFacts }) {
  const segments = facts.ring?.segments ?? [];
  return (
    <ol className="graph-legend">
      {segments.map((s) => (
        <li key={`${s.from}-${s.to}`}>
          <span className="ltr-island">
            {s.from === s.to ? `Ayah ${s.from}` : `Ayat ${s.from}–${s.to}`}
          </span>
          {s.label ? <span className="graph-legend__label">{s.label}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function LitanyLegend({ facts }: { facts: MacroFacts }) {
  const litany = facts.litany!;
  return (
    <ul className="graph-legend">
      {litany.rhymeShare > 0 ? (
        <li>
          {/* The share is a percentage OF AYAT, and it says so — a bare "78%"
              next to a strength percentage would read as a strength. */}
          {`${Math.round(litany.rhymeShare * 100)}% of ayat share one rhyme`}
        </li>
      ) : null}
      {litany.refrainAyat.length > 0 ? (
        <li>
          <span className="ltr-island">
            {`A refrain returns at ayat ${litany.refrainAyat.join(", ")}`}
          </span>
        </li>
      ) : null}
    </ul>
  );
}

function ArcLegend({ facts }: { facts: MacroFacts }) {
  return (
    <ol className="graph-legend">
      {(facts.arc?.beats ?? []).map((b) => (
        <li key={`${b.from}-${b.to}`}>
          <span className="ltr-island">{`Ayat ${b.from}–${b.to}`}</span>
          <span className="graph-legend__label">{b.label}</span>
        </li>
      ))}
    </ol>
  );
}
