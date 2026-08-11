// THE SHARED LEAF — one mark, both layouts. Design §B.5.
//
// Edge case #89 requires the strip to have "identical stage semantics" to the
// ring. This component is HOW that is guaranteed: the arc and the strip both
// render this, and only the (x, y) they pass differs. A stage cannot mean one
// thing in the ring and another in the strip unless someone forks this file,
// which the tests assert against.
//
// An ayah is a DISC; a seam is a BAR. The shape difference is deliberate and
// is not decoration: it keeps the two kinds distinguishable in greyscale and
// at 1-bit, which colour alone would not (#87 applied to geometry). The seam
// bar sits at the SAME radius as the ayah discs so it reads as part of the
// ring, not as an annotation beside it.

import type { Stage } from "@engine/atom.ts";
import type { PlacedMark } from "./geometry.ts";

/** Stage -> the locked colour token. These are CSS custom properties from
 *  iman-ui.css:124-127, referenced by name; no hex is written here. `lapsed`
 *  uses the additive token defined in iman-ext.css alongside
 *  .stage-dot--lapsed, for the coral-500 collision reason documented there. */
const STAGE_FILL: Record<Stage, string> = {
  learn: "var(--stage-learn)",
  reinforce: "var(--stage-reinforce)",
  carry: "var(--stage-carry)",
  lapsed: "var(--stage-lapsed)",
};

/** Painted radius of an ayah disc, in viewBox units. */
const AYAH_R = 4.5;
/** Transparent hit area. 11 viewBox units is ~44 CSS px at a 400px render —
 *  edge case #82's floor met WITHOUT changing the painted radius, the same
 *  trick .tile-hit uses for the locked .tile. */
const HIT_R = 11;

export interface GraphNodeMarkProps {
  mark: PlacedMark;
}

/**
 * One mark. Every element here is aria-hidden and non-focusable: the diagram
 * is ONE IMAGE with one text alternative (the <title>/<desc> on the <svg> and
 * the real link list beside it), not N tab stops. §15's rule, verbatim: "the
 * ring's text alternative is this list, documented as such — not aria-labels
 * bolted onto <circle> elements."
 */
export function GraphNodeMark({ mark }: GraphNodeMarkProps) {
  const { node, x, y, rotate } = mark;
  const fill = STAGE_FILL[node.stage];
  // A node with no encoding yet is drawn hollow rather than filled: "not
  // started" and "started but weak" must not look the same.
  const started = node.encoded || node.strengthPct > 0;

  if (node.kind === "seam") {
    // The bar. Width along the ring, height across it.
    const w = 5;
    const h = 2.4;
    return (
      <g aria-hidden="true" className="graph-seam" transform={`rotate(${round(rotate)} ${round(x)} ${round(y)})`}>
        <rect
          x={round(x - w / 2)}
          y={round(y - h / 2)}
          width={w}
          height={h}
          rx={h / 2}
          fill={started ? fill : "var(--surface-2)"}
          stroke="var(--border-stronger)"
          strokeWidth={0.4}
        />
      </g>
    );
  }

  return (
    <g aria-hidden="true" className="graph-node">
      <circle
        cx={round(x)}
        cy={round(y)}
        r={AYAH_R}
        fill={started ? fill : "var(--surface-2)"}
        stroke="var(--border-stronger)"
        strokeWidth={0.5}
      />
      {/* Transparent, painted last, never focusable. */}
      <circle cx={round(x)} cy={round(y)} r={HIT_R} fill="transparent" className="graph-hit" />
    </g>
  );
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

export { AYAH_R, HIT_R, STAGE_FILL };
