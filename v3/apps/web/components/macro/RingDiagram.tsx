// THE RING (and the strip) — design §B.4-§B.6.
//
// Renders the WHOLE memory graph: N ayah discs AND N-1 seam joints. Edge case
// #90 is the reason this component takes GraphNode[] rather than a list of
// ayat — for a 3-ayah surah, 2 of the 5 marks here are seams, and a ring that
// drew only ayat would leave 40% of the graph unrendered.
//
// It chooses NOTHING about geometry. `layout` arrives as a string from
// MacroFacts (built at compile time in corpus-compiler/src/macro.ts), so
// edge case #89's <=9 threshold appears in no .tsx file anywhere.
//
// ACCESSIBILITY (§15)
//   - The <svg> is role="img" with a <title> and a <desc> carrying the
//     AGGREGATE. Every shape inside is aria-hidden and non-focusable: this is
//     one image, not 2N-1 tab stops.
//   - The documented text alternative is the progress list, linked visibly
//     beneath the diagram — "not aria-labels bolted onto <circle> elements."
//     The link is visible to everyone, because a sighted learner on a phone
//     reads the list more easily than the ring too.
//   - Navigation is real <a>s in a sibling list, never SVG click handlers.
//     That is what makes the diagram keyboard-operable without making it 200
//     tab stops.
//   - No animation is added. iman-ui.css:185-187 already kills all animation
//     and transition globally under prefers-reduced-motion, and iman-ext.css
//     explicitly declines to add a weaker duplicate. Same precedent here.

import Link from "next/link";
import type { MacroLayout } from "./facts.ts";
import { place } from "./geometry.ts";
import { isHighlighted, summarize, type GraphNode, type HighlightRef } from "./graphNodes.ts";
import { GraphNodeMark } from "./GraphNodeMark.tsx";

export interface RingDiagramProps {
  surah: number;
  nodes: GraphNode[];
  layout: MacroLayout;
  /** Distinguishes the two id-scopes when more than one diagram is on a page. */
  idPrefix?: string;
  /** "You are here" on the ayah detail route (§4). OPTIONAL and `null` by
   *  default, so the surah route and every existing test render unchanged.
   *
   *  NEVER COLOUR ALONE (#87) applies to this too, and it is the reason the
   *  highlight is not only a ring on a circle: the current mark's link text
   *  says so IN WORDS, and the <desc> names the ayah the map is centred on. A
   *  learner who cannot see the ring outline still learns where they are. */
  highlight?: HighlightRef;
}

export function RingDiagram({
  surah,
  nodes,
  layout,
  idPrefix = "ring",
  highlight = null,
}: RingDiagramProps) {
  const { marks, segments, viewBox } = place(nodes, layout);
  const summary = summarize(nodes);
  const titleId = `${idPrefix}-t`;
  const descId = `${idPrefix}-d`;

  // The aggregate sentence, e.g. "Surah 103. 3 ayat, 2 joints. 2 carrying,
  // 1 learning, 2 not started." Built from data, never from a colour.
  const stageSentence = summary.byStage
    .map((s) => `${s.count} ${s.label.toLowerCase()}`)
    .join(", ");
  // The "you are here" sentence is APPENDED rather than woven in, so the
  // existing aggregate sentence is byte-identical when there is no highlight
  // and the surah route's assertions keep meaning what they meant.
  const hereSentence = highlight === null ? "" : ` You are on ayah ${highlight.ayah}.`;
  const desc =
    `Surah ${surah}. ${summary.ayahCount} ${summary.ayahCount === 1 ? "ayah" : "ayat"}, ` +
    `${summary.seamCount} ${summary.seamCount === 1 ? "joint" : "joints"}. ${stageSentence}.` +
    hereSentence;

  return (
    <div className="graph">
      <svg
        className="graph-svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
      >
        <title id={titleId}>{`Memory graph for surah ${surah}`}</title>
        <desc id={descId}>{desc}</desc>
        {/* Segments first so the marks paint on top of them. Each segment is
            stroked in the SEAM'S OWN stage colour — the connective tissue is
            itself the status indicator. */}
        <g aria-hidden="true">
          {segments.map((seg) => (
            <path
              key={`seg-${seg.node.atomKey}`}
              className="graph-seg"
              d={seg.d}
              fill="none"
              stroke={segStroke(seg.node)}
              strokeWidth={1.2}
              strokeLinecap="round"
            />
          ))}
        </g>
        {marks.map((mark) => (
          <GraphNodeMark
            key={mark.node.atomKey}
            mark={mark}
            current={isHighlighted(mark.node, highlight)}
          />
        ))}
      </svg>

      {/* The documented text alternative. Always present — never a hover,
          never a modal. */}
      <p className="graph-alt">
        <Link href={`/progress/list?surah=${surah}`}>See every ayah and joint as a list</Link>
      </p>

      {/* Real links, so the graph is keyboard-operable and every mark is
          reachable. Visually hidden because the visible affordance is the
          diagram plus the list link above; the a11y tree still gets all of
          it, each entry naming its stage IN WORDS (#87). */}
      <nav className="sr-only" aria-label={`Ayat and joints of surah ${surah}`}>
        <ul>
          {nodes.map((node) => (
            <li key={node.atomKey}>
              <Link href={hrefFor(node)} aria-current={isHighlighted(node, highlight) ? "page" : undefined}>
                {labelFor(node, isHighlighted(node, highlight))}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** A seam links to its FROM ayah, anchored at the seam. */
function hrefFor(node: GraphNode): string {
  return node.kind === "seam"
    ? `/surah/${node.surah}/${node.from}#seam`
    : `/surah/${node.surah}/${node.ayah}`;
}

/** The accessible name of a mark. Carries the reference, the KIND AS A WORD,
 *  the stage AS A WORD and the number — never a colour.
 *
 *  `current` appends "you are here" IN WORDS. On the detail route the ring
 *  outline around the current disc is a purely visual cue, and a purely visual
 *  cue is exactly what #87 forbids as the sole carrier of a fact. */
function labelFor(node: GraphNode, current = false): string {
  const ref =
    node.kind === "seam"
      ? `Joint ${node.surah}:${node.from}→${node.to}`
      : `Ayah ${node.surah}:${node.ayah}`;
  const value = node.encoded ? `${node.strengthPct}%` : "not started";
  return `${ref}, ${node.stageLabel}, ${value}${current ? ", you are here" : ""}`;
}

/** A not-yet-started seam is drawn in the neutral border colour rather than
 *  its stage colour: at 0% the stage is "learn", and painting it teal would
 *  claim progress that has not happened. It is still DRAWN — invisible is not
 *  the same as not-yet-eligible (v3-D03 / #90). */
function segStroke(node: GraphNode): string {
  if (!node.encoded && node.strengthPct === 0) return "var(--border)";
  return `var(--stage-${node.stage})`;
}
