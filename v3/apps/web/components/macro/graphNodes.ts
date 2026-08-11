// THE MEMORY GRAPH, AS DATA — build-plan step 19, design §B.2.
//
// ---------------------------------------------------------------------------
// EDGE CASE #90: "Connection atoms invisible (40% of Al-Asr's atoms) —
// half the memory graph unrendered."
// ---------------------------------------------------------------------------
// A surah of N ayat has N ayah atoms and N-1 connection atoms (invariant #1).
// For Al-Asr (N=3) that is 3 + 2 = 5 atoms, and a ring that draws only ayat
// renders 3 of 5 — 40% of the graph invisible. This module produces BOTH
// halves, so a renderer cannot draw one without the other.
//
// THE SHAPE IS ONE ORDERED ARRAY, NOT nodes[] + edges[].
// A nodes/edges split makes seams look DERIVABLE from ayat, and a renderer
// that derives its edges from its nodes will drop them the first time someone
// simplifies the component. The engine already models the seam as a
// COORDINATE, not a special case — site.ts: "the seam IS that coordinate, not
// a special case bolted onto ayah n". This inherits that: a seam is a peer in
// the same array, in expand() order (ayah 1, seam 1, ayah 2, ... ayah N).
//
// EVERY FIELD IS PRECOMPUTED. None is derivable in JSX (v3/CLAUDE.md rule 4,
// check-boundaries.mjs clause 5): `stage` comes from the engine's
// currentBand(), `strengthPct` from currentStrength(), `stageLabel` is a
// STRING CARRIED IN THE DATA. That last one is what makes edge case #87
// ("never colour alone") structurally impossible rather than merely observed:
// there is no code path that produces a node without its label, so there is
// no code path that can render colour alone.

import type { AtomState, Stage } from "@engine/atom.ts";
import type { DayConfig } from "@engine/daybound.ts";
import { expand, siteToAtomKey, type Site } from "@engine/site.ts";
import { currentBand, currentStrength } from "@engine/strength.ts";

/** Gate state, precomputed — edge case #101 ("gate-pending lock opacity =>
 *  learner confusion; gate-armed/due states + why-locked explanation").
 *  Re-exported from the progress row builder so the ring and the table cannot
 *  drift into two different vocabularies for the same fact. */
export type { GateState } from "@/lib/progress/rows.ts";
import type { GateState } from "@/lib/progress/rows.ts";

interface GraphNodeBase {
  /** The engine atom key this mark reads from. Always via siteToAtomKey —
   *  never a hand-built template literal (atom.ts: a raw literal is "a lookup
   *  miss, not a type error"). */
  atomKey: string;
  stage: Stage;
  /** The human-readable stage word. IN THE DATA, not in a lookup table in a
   *  component (edge case #87). */
  stageLabel: string;
  strengthPct: number;
  gate: GateState;
  /** False until the atom has been encoded — "Not started" is a genuinely
   *  different state from "Learning" and heatmap.ts already distinguishes it. */
  encoded: boolean;
}

export interface AyahNode extends GraphNodeBase {
  kind: "ayah";
  surah: number;
  ayah: number;
}

export interface SeamNode extends GraphNodeBase {
  kind: "seam";
  surah: number;
  /** The n of the n -> n+1 junction. */
  from: number;
  to: number;
}

export type GraphNode = AyahNode | SeamNode;

/**
 * WHICH MARK IS "YOU ARE HERE" — the ayah detail route's bridge (WIREFRAME §4).
 *
 * A coordinate, not a filtered array. Filtering the graph down to one ayah on
 * the detail page would strip the seam nodes and reintroduce edge case #90 —
 * connection atoms are ~40% of a short surah's graph, and the whole point of
 * showing the map at a closer zoom is that the learner sees the joints they
 * have to cross to get here. So the full graph is always built and exactly one
 * mark is FLAGGED.
 *
 * `null` (the surah route) means no mark is current — not "ayah 0".
 */
export type HighlightRef = { kind: "ayah"; ayah: number } | null;

/**
 * Is this node the current one?
 *
 * A SEAM IS NEVER THE HIGHLIGHT, even the seam leaving the current ayah. The
 * route is `/surah/S/A` — the learner is looking at an ayah, and marking the
 * joint after it as "you are here" would claim they are at a junction they may
 * never have drilled. One coordinate, one mark.
 *
 * Exported and tested rather than inlined in JSX so the rule is stated once:
 * a component that re-derived "am I current?" beside its markup is the shape
 * check-boundaries clause 5 exists to prevent.
 */
export function isHighlighted(node: GraphNode, highlight: HighlightRef): boolean {
  if (highlight === null) return false;
  return node.kind === "ayah" && node.ayah === highlight.ayah;
}

/** The five states a learner actually experiences. "Not started" is `learn`
 *  with `encoded: false` — heatmap.ts:31 already draws that distinction and a
 *  learner feels it as a different thing from "Learning".
 *
 *  These are the SAME five words `lib/progress/rows.ts` prints in the table,
 *  and a test asserts the two agree. The ring and the list must never call the
 *  same atom by two different names. */
export function stageLabelOf(stage: Stage, encoded: boolean): string {
  switch (stage) {
    case "learn":
      return encoded ? "Learning" : "Not started";
    case "reinforce":
      return "Reinforcing";
    case "carry":
      return "Carrying";
    case "lapsed":
      return "Lapsed";
  }
}

/** Gate state for one atom, precomputed here so no view ever compares a
 *  timestamp. `null` atom => "none": nothing is scheduled for an atom that
 *  does not exist yet. */
export function gateStateOf(atom: AtomState | undefined, now: number): GateState {
  if (!atom) return "none";
  if (atom.gatePassed) return "passed";
  if (atom.gateFails > 0) return "failed";
  if (atom.gateDueAt === null) return "none";
  return atom.gateDueAt <= now ? "due" : "armed";
}

/** Build one mark from a Site. The seam and the ayah go through the SAME
 *  function, so a seam can never accidentally read its left-hand ayah's atom:
 *  the key comes from siteToAtomKey(site), which maps a seam to
 *  `connection:from`. */
function nodeFor(site: Site, atoms: Map<string, AtomState>, now: number, cfg?: DayConfig): GraphNode {
  const key = siteToAtomKey(site);
  const atom = atoms.get(key);
  const stage: Stage = atom ? currentBand(atom, now, cfg) : "learn";
  const strengthPct = atom ? Math.round(currentStrength(atom, now, cfg)) : 0;
  const encoded = atom?.encoded ?? false;
  const base: GraphNodeBase = {
    atomKey: key,
    stage,
    stageLabel: stageLabelOf(stage, encoded),
    strengthPct,
    gate: gateStateOf(atom, now),
    encoded,
  };
  if (site.kind === "seam") {
    return { ...base, kind: "seam", surah: site.surah, from: site.ayah, to: site.ayah + 1 };
  }
  return { ...base, kind: "ayah", surah: site.surah, ayah: site.ayah };
}

/**
 * The whole memory graph for a surah, in reading order, ayat AND seams.
 *
 * Delegates the ORDER and the seam construction to the engine's `expand()`,
 * which never constructs a seam at the last ayah (DEFECTS.md#E-08's
 * by-construction fix). That is why there is no "don't close the ring" check
 * anywhere in the renderer: the closing seam is never built, so it cannot be
 * drawn.
 *
 * A seam whose adjacent ayat are not both strong is NOT ELIGIBLE (v3-D03) —
 * it comes back at stage "learn", 0%. IT IS STILL RETURNED. Invisible is not
 * the same as not-yet-eligible, and #90 is precisely the bug of confusing the
 * two.
 */
export function buildGraphNodes(
  surah: number,
  ayahCount: number,
  atoms: Map<string, AtomState>,
  now: number,
  cfg?: DayConfig,
): GraphNode[] {
  if (ayahCount < 1) return [];
  return expand(surah, 1, ayahCount, ayahCount).map((site) => nodeFor(site, atoms, now, cfg));
}

/** Aggregate counts for the diagram's text alternative (<desc>). Computed
 *  here, not in the component, for the same reason everything else is. */
export interface GraphSummary {
  ayahCount: number;
  seamCount: number;
  byStage: { label: string; count: number }[];
}

export function summarize(nodes: GraphNode[]): GraphSummary {
  const byLabel = new Map<string, number>();
  for (const n of nodes) byLabel.set(n.stageLabel, (byLabel.get(n.stageLabel) ?? 0) + 1);
  return {
    ayahCount: nodes.filter((n) => n.kind === "ayah").length,
    seamCount: nodes.filter((n) => n.kind === "seam").length,
    byStage: [...byLabel.entries()].map(([label, count]) => ({ label, count })),
  };
}
