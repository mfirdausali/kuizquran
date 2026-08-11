// RING / STRIP GEOMETRY — design §B.4 and §B.5. Pure coordinate math.
//
// ---------------------------------------------------------------------------
// WHY BOTH LAYOUTS LIVE IN ONE MODULE
// ---------------------------------------------------------------------------
// Edge case #89's requirement, verbatim: "flat 1->N strip with IDENTICAL STAGE
// SEMANTICS". "Identical" is enforced BY CONSTRUCTION, not by care: both
// layouts consume the same GraphNode[] and hand it to the same leaf mark.
// ONLY THE (x, y) DIFFERS, and that is all this module produces. A stage that
// renders one way in the ring and another in the strip is not possible unless
// someone forks the leaf — which the tests assert against.
//
// No threshold is decided here. `layout` arrives as a STRING in MacroFacts,
// computed once at build time in corpus-compiler/src/macro.ts. There is no
// `<= 9` anywhere in the app tree.

import type { GraphNode } from "./graphNodes.ts";

/** A positioned mark. `node` is carried through untouched — geometry never
 *  reads or rewrites stage data. */
export interface PlacedMark {
  node: GraphNode;
  x: number;
  y: number;
  /** Rotation in degrees for a seam bar lying tangent to the ring. 0 on the
   *  strip, where the bar is unrotated. */
  rotate: number;
}

/** The segment of ring/strip drawn UNDER each seam, stroked in the SEAM'S OWN
 *  stage colour. The connective tissue is itself the status indicator: a weak
 *  joint shows a pale segment between two strong dots — which is exactly the
 *  "you know 3, you know 4, you cannot go 3->4" failure v3-D03 exists to
 *  model. */
export interface PlacedSegment {
  node: GraphNode;
  /** SVG path `d` for the arc layout, or a straight line for the strip. */
  d: string;
}

export interface Placement {
  marks: PlacedMark[];
  segments: PlacedSegment[];
  viewBox: string;
}

// --- Arc constants. All in viewBox units, so everything scales together. ---
const ARC_CX = 50;
const ARC_CY = 50;
/** Node radius. 38 of 50 leaves 12 units of margin for stroke and focus ring. */
const ARC_R = 38;

function polar(theta: number, r: number): { x: number; y: number } {
  return { x: ARC_CX + r * Math.cos(theta), y: ARC_CY + r * Math.sin(theta) };
}

/** Angle of the i-th ayah of N. Index 0 sits at 12 o'clock and the ring
 *  advances CLOCKWISE.
 *
 *  Clockwise despite the Arabic being RTL: the ring is a PROGRESS DIAGRAM,
 *  not a text run. It is not dir="rtl" and must not be, or the Latin ayah
 *  numbers inside it reorder. iman-ext.css's .rtl-island/.ltr-island pair is
 *  for text runs, not for SVG geometry. Ayah 1 at the top is the only
 *  orientation a learner can map to "the beginning". */
function ayahTheta(i: number, n: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / n;
}

/** Arc layout: N ayah nodes on a circle, N-1 seam joints at the midpoints
 *  BETWEEN them, at the SAME radius.
 *
 *  Same radius is what makes a joint read as PART OF the ring rather than an
 *  annotation floating beside it. A different SHAPE (a tangent bar, not a
 *  disc) is what keeps it distinguishable from an ayah in greyscale and at
 *  1-bit — edge case #87's principle applied to geometry, not just to colour.
 *
 *  THE RING DOES NOT CLOSE. There are N-1 joints, never N: the gap between
 *  the last ayah and the first is left open, because closing it would assert
 *  a seam from ayah N back to ayah 1, which does not exist. `expand()`
 *  refuses to construct that seam, so it never arrives here in the first
 *  place. An open ring is the honest ring. */
export function placeArc(nodes: GraphNode[]): Placement {
  const ayat = nodes.filter((n) => n.kind === "ayah");
  const n = ayat.length;
  const marks: PlacedMark[] = [];
  const segments: PlacedSegment[] = [];
  if (n === 0) return { marks, segments, viewBox: "0 0 100 100" };

  const ayahIndex = new Map<number, number>();
  ayat.forEach((a, i) => ayahIndex.set((a as Extract<GraphNode, { kind: "ayah" }>).ayah, i));

  for (const node of nodes) {
    if (node.kind === "ayah") {
      const i = ayahIndex.get(node.ayah)!;
      const p = polar(ayahTheta(i, n), ARC_R);
      marks.push({ node, x: p.x, y: p.y, rotate: 0 });
    } else {
      const i = ayahIndex.get(node.from);
      if (i === undefined) continue;
      const t0 = ayahTheta(i, n);
      const t1 = ayahTheta(i + 1, n);
      const mid = (t0 + t1) / 2;
      const p = polar(mid, ARC_R);
      // Tangent to the circle: the bar lies ALONG the ring, like a link in a
      // chain. +90deg because the tangent is perpendicular to the radius.
      marks.push({ node, x: p.x, y: p.y, rotate: (mid * 180) / Math.PI + 90 });
      const a = polar(t0, ARC_R);
      const b = polar(t1, ARC_R);
      // sweep-flag 1 = clockwise, matching the node order.
      segments.push({ node, d: `M ${f(a.x)} ${f(a.y)} A ${ARC_R} ${ARC_R} 0 0 1 ${f(b.x)} ${f(b.y)}` });
    }
  }
  return { marks, segments, viewBox: "0 0 100 100" };
}

// --- Strip constants (edge case #89). -------------------------------------
const STRIP_CY = 12;
const STRIP_X0 = 10;
const STRIP_W = 80;

/** Flat 1->N strip, left to right — the same reasoning as clockwise: this is
 *  a diagram, not a text run. Seam joints use the IDENTICAL bar mark,
 *  unrotated, at the midpoint. #90 holds here too: N-1 joints for N ayat. */
export function placeStrip(nodes: GraphNode[]): Placement {
  const ayat = nodes.filter((n) => n.kind === "ayah");
  const n = ayat.length;
  const marks: PlacedMark[] = [];
  const segments: PlacedSegment[] = [];
  if (n === 0) return { marks, segments, viewBox: "0 0 100 24" };

  const ayahIndex = new Map<number, number>();
  ayat.forEach((a, i) => ayahIndex.set((a as Extract<GraphNode, { kind: "ayah" }>).ayah, i));
  // A single ayah sits centred rather than at the left edge.
  const xOf = (i: number) => (n === 1 ? ARC_CX : STRIP_X0 + (i * STRIP_W) / (n - 1));

  for (const node of nodes) {
    if (node.kind === "ayah") {
      marks.push({ node, x: xOf(ayahIndex.get(node.ayah)!), y: STRIP_CY, rotate: 0 });
    } else {
      const i = ayahIndex.get(node.from);
      if (i === undefined) continue;
      const x0 = xOf(i);
      const x1 = xOf(i + 1);
      marks.push({ node, x: (x0 + x1) / 2, y: STRIP_CY, rotate: 0 });
      segments.push({ node, d: `M ${f(x0)} ${STRIP_CY} L ${f(x1)} ${STRIP_CY}` });
    }
  }
  return { marks, segments, viewBox: "0 0 100 24" };
}

/** Round to 2dp so the emitted path is stable across platforms — a snapshot
 *  that differs in float noise is a test that fails for no reason. */
function f(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

/** Dispatch on the LAYOUT STRING from MacroFacts. No numeric comparison, no
 *  threshold — the decision was made at build time. */
export function place(nodes: GraphNode[], layout: "arc" | "strip"): Placement {
  return layout === "strip" ? placeStrip(nodes) : placeArc(nodes);
}
