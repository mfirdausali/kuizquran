/**
 * @vitest-environment jsdom
 */

// THE VISIBLE MEMORY GRAPH — build-plan step 19, sections A and B.
//
// ---------------------------------------------------------------------------
// WHY THE INPUTS COME FROM THE REAL ENGINE
// ---------------------------------------------------------------------------
// Every GraphNode[] below is built by `buildGraphNodes`, which delegates its
// ORDER and its seam construction to the engine's own `expand()` and reads
// every strength through `siteToAtomKey()` + `currentBand()`/
// `currentStrength()`. The corpus is the real `12.json` fixture the engine's
// own 391 tests run on.
//
// That matters for one specific reason: hand-built node arrays would let these
// tests keep passing after the engine's site/atom contract drifted, which is
// the single failure a component test exists to catch. If `expand()` ever
// stops emitting a seam between consecutive ayat, the #90 tests below go red
// — which is the point.
//
// NOT ONE ARABIC LITERAL APPEARS HERE. Fixtures are referenced by COORDINATE
// (surah/ayah numbers) — v3/INVARIANTS.md Absolute B and check-boundaries.mjs
// clause 4, holding in the tests exactly as they hold in the app.
//
// ---------------------------------------------------------------------------
// WHAT IS ASSERTED (the four non-negotiables, plus the properties that guard
// each one against the specific way it would regress)
// ---------------------------------------------------------------------------
//   #90 — seams RENDER, as joints between nodes, in both layouts, at 2N-1
//         marks; a seam reads its OWN atom, not its left-hand ayah's; an
//         ineligible seam is dimmed but PRESENT.
//   #89 — a <=9-ayat surah gets the flat strip, a 10-ayat one gets the arc,
//         and both carry IDENTICAL stage semantics.
//   #87 — every stage indicator carries a WORD and a NUMBER; the dot is
//         aria-hidden; lapsed is distinguishable from carry.
//   v3-D21 — an ATOMIC surah renders NO PANEL AT ALL.

import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";

import type { AtomState } from "@engine/atom.ts";
import { atomKey, initAtom } from "@engine/atom.ts";
import { expand, siteToAtomKey } from "@engine/site.ts";
import type { Corpus } from "@engine/types.ts";

import {
  buildGraphNodes,
  stageLabelOf,
  summarize,
  type GraphNode,
} from "@/components/macro/graphNodes.ts";
import { place, placeArc, placeStrip } from "@/components/macro/geometry.ts";
import { MacroPanel } from "@/components/macro/MacroPanel";
import { RingDiagram } from "@/components/macro/RingDiagram";
import type { MacroFacts } from "@/components/macro/facts.ts";
import { classify } from "../../../packages/corpus-compiler/src/macro.ts";

afterEach(cleanup);

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus: Corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../packages/engine/test/fixtures/12.json"), "utf8"),
);

const NOW = Date.UTC(2026, 7, 11, 9, 0, 0);

/** An atom map with the given atoms installed, keyed the way the engine keys
 *  them — through `atomKey`, never a hand-built literal. */
function atomsOf(...entries: AtomState[]): Map<string, AtomState> {
  const m = new Map<string, AtomState>();
  for (const a of entries) m.set(atomKey(a.surah, a.kind, a.ref), a);
  return m;
}

function strongAtom(surah: number, kind: "ayah" | "connection", ref: number, strength: number): AtomState {
  return {
    ...initAtom(surah, kind, ref),
    strength,
    stability: 10,
    lastRetrieval: NOW,
    reps: 3,
    encoded: true,
  };
}

/** MacroFacts built by the REAL classifier, so these render tests and the
 *  compiler's own tests cannot disagree about what a surah is. */
function factsFor(ayahCount: number, rukuCount = 1): MacroFacts {
  return classify({ ayahCount, rukuCount }) as MacroFacts;
}

// ===========================================================================
// EDGE CASE #90 — the seams are half the graph and they must be VISIBLE
// ===========================================================================

describe("#90 — connection atoms are rendered", () => {
  it("buildGraphNodes emits 2N-1 nodes: N ayat and N-1 seams", () => {
    for (const n of [3, 7, 9, 10, 111]) {
      const nodes = buildGraphNodes(12, n, new Map(), NOW);
      expect(nodes.length).toBe(2 * n - 1);
      expect(nodes.filter((x) => x.kind === "ayah").length).toBe(n);
      expect(nodes.filter((x) => x.kind === "seam").length).toBe(n - 1);
    }
  });

  it("the node order is expand() order — ayah, seam, ayah, …", () => {
    const nodes = buildGraphNodes(12, 4, new Map(), NOW);
    expect(nodes.map((x) => x.kind)).toEqual(["ayah", "seam", "ayah", "seam", "ayah", "seam", "ayah"]);
  });

  it("Al-Asr's shape: 2 of 5 marks — 40% — are seams", () => {
    // Edge case #90's own number. A 3-ayah surah has 5 atoms; a ring that drew
    // only ayat would render 3 of them.
    const nodes = buildGraphNodes(103, 3, new Map(), NOW);
    const seams = nodes.filter((x) => x.kind === "seam").length;
    expect(seams / nodes.length).toBeGreaterThanOrEqual(0.4);
  });

  it("renders a mark for EVERY node, in both layouts", () => {
    const nodes = buildGraphNodes(12, 7, new Map(), NOW);
    for (const layout of ["arc", "strip"] as const) {
      const placed = place(nodes, layout);
      expect(placed.marks.length).toBe(nodes.length);
      // N-1 connecting segments, one under each seam.
      expect(placed.segments.length).toBe(6);
    }
  });

  it("THE RING DOES NOT CLOSE — no seam from ayah N back to ayah 1", () => {
    // Closing the ring would assert a seam expand() refuses to construct
    // (DEFECTS.md#E-08). There are N-1 joints, never N.
    const n = 12;
    const nodes = buildGraphNodes(12, n, new Map(), NOW);
    const seams = nodes.filter((x): x is Extract<GraphNode, { kind: "seam" }> => x.kind === "seam");
    expect(seams.length).toBe(n - 1);
    expect(seams.some((s) => s.from === n)).toBe(false);
    expect(Math.max(...seams.map((s) => s.from))).toBe(n - 1);
  });

  it("a seam reads its OWN connection atom, never its left-hand ayah's", () => {
    // The silent bug: a seam that mirrors ayah `from` looks right in a
    // screenshot and is wrong in the data (atom.ts:73-78 — "a lookup miss,
    // not a type error"). Ayah 1 is strong; seam 1→2 is weak. They must
    // differ.
    const atoms = atomsOf(
      strongAtom(12, "ayah", 1, 90),
      strongAtom(12, "connection", 1, 20),
    );
    const nodes = buildGraphNodes(12, 3, atoms, NOW);
    const ayah1 = nodes.find((x) => x.kind === "ayah" && x.ayah === 1)!;
    const seam1 = nodes.find((x) => x.kind === "seam" && x.from === 1)!;

    expect(ayah1.strengthPct).toBe(90);
    expect(seam1.strengthPct).toBe(20);
    expect(seam1.strengthPct).not.toBe(ayah1.strengthPct);
    // And the key it read is the CONNECTION key the engine would build.
    expect(seam1.atomKey).toBe(siteToAtomKey({ kind: "seam", surah: 12, ayah: 1 }));
    expect(seam1.atomKey).toBe(atomKey(12, "connection", 1));
  });

  it("an INELIGIBLE seam is still rendered — dimmed, not absent", () => {
    // v3-D03: a seam whose ayat are not both strong is not eligible. Edge
    // case #90 is precisely the bug of confusing "not yet eligible" with
    // "invisible".
    const atoms = atomsOf(strongAtom(12, "ayah", 1, 95), strongAtom(12, "ayah", 2, 10));
    const nodes = buildGraphNodes(12, 2, atoms, NOW);
    const seam = nodes.find((x) => x.kind === "seam")!;
    expect(seam).toBeDefined();
    expect(seam.stage).toBe("learn");
    expect(seam.strengthPct).toBe(0);
    // Rendered: it is one of the marks the geometry places.
    expect(place(nodes, "strip").marks.some((m) => m.node.kind === "seam")).toBe(true);
  });

  it("the rendered SVG contains a mark per node and the joints are BARS", () => {
    const nodes = buildGraphNodes(103, 3, new Map(), NOW);
    const { container } = render(<RingDiagram surah={103} nodes={nodes} layout="strip" />);
    // 3 ayah discs (each with a transparent hit circle) + 2 seam bars.
    expect(container.querySelectorAll(".graph-node").length).toBe(3);
    expect(container.querySelectorAll(".graph-seam").length).toBe(2);
    // A seam is a <rect>, an ayah is a <circle> — distinguishable at 1-bit.
    expect(container.querySelectorAll(".graph-seam rect").length).toBe(2);
    expect(container.querySelectorAll(".graph-node circle").length).toBe(6);
  });

  it("every node is reachable as a real link, joints included", () => {
    const nodes = buildGraphNodes(103, 3, new Map(), NOW);
    render(<RingDiagram surah={103} nodes={nodes} layout="strip" />);
    const nav = screen.getByRole("navigation", { name: /ayat and joints/i });
    const links = nav.querySelectorAll("a");
    expect(links.length).toBe(5);
    // The joints link to their FROM ayah, anchored at the seam.
    const hrefs = Array.from(links).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/surah/103/1#seam");
    expect(hrefs).toContain("/surah/103/2#seam");
  });

  // REGRESSION (adversarial review, 2026-08-11). The test above asserted link
  // COUNT and HREFS but never link TEXT, so deleting the stage word from
  // labelFor() — turning "Ayah 103:1, Carrying, 95%" into "Ayah 103:1, 95%" —
  // left all 205 tests green. That is precisely the regression #87 exists to
  // prevent: a screen-reader user and a deuteranopic user both lose the stage
  // entirely, because for them the colour was never carrying it.
  //
  // Reproduced independently before fixing: stripping ${node.stageLabel} from
  // RingDiagram.tsx#labelFor kept 205/205 passing.
  it("every mark's accessible name carries its STAGE WORD, not just a number (#87)", () => {
    // Mixed states so one label cannot accidentally satisfy every assertion:
    // an encoded ayah, and untouched atoms that must still name a stage.
    const atoms = atomsOf(strongAtom(103, "ayah", 1, 95));
    const nodes = buildGraphNodes(103, 3, atoms, NOW);
    render(<RingDiagram surah={103} nodes={nodes} layout="strip" />);
    const nav = screen.getByRole("navigation", { name: /ayat and joints/i });
    const texts = Array.from(nav.querySelectorAll("a")).map((a) => a.textContent ?? "");

    expect(texts).toHaveLength(5);
    // EVERY mark — ayah and joint alike — names a stage in words.
    const STAGE_WORD = /Not started|Learning|Reinforcing|Carrying|Lapsed/;
    texts.forEach((t, i) => {
      expect(t, `mark ${i} ("${t}") must name its stage in words`).toMatch(STAGE_WORD);
    });
    // And the encoded ayah's label really reflects ITS state, so this cannot be
    // satisfied by hardcoding one stage word for every mark.
    expect(texts.some((t) => /Ayah 103:1,.*Carrying/.test(t))).toBe(true);
  });
});

// ===========================================================================
// EDGE CASE #89 — the <=9 strip, with IDENTICAL stage semantics
// ===========================================================================

describe("#89 — the flat strip on short surahs", () => {
  it("the threshold is DATA: N=9 is strip, N=10 is arc", () => {
    // Asserted against the classifier's output, never against a component.
    expect(classify({ ayahCount: 9, rukuCount: 4 }).layout).toBe("strip");
    expect(classify({ ayahCount: 10, rukuCount: 4 }).layout).toBe("arc");
  });

  it("the strip is FLAT — every mark shares one y", () => {
    const nodes = buildGraphNodes(12, 6, new Map(), NOW);
    const ys = new Set(placeStrip(nodes).marks.map((m) => m.y));
    expect(ys.size).toBe(1);
    // And it is left-to-right, ascending in x, in reading order.
    const xs = placeStrip(nodes).marks.map((m) => m.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it("the arc is NOT flat — marks occupy many y values", () => {
    const nodes = buildGraphNodes(12, 12, new Map(), NOW);
    expect(new Set(placeArc(nodes).marks.map((m) => m.y)).size).toBeGreaterThan(1);
  });

  it("the strip carries SEAMS too — #90 ∩ #89 is Al-Asr", () => {
    const nodes = buildGraphNodes(103, 3, new Map(), NOW);
    expect(placeStrip(nodes).marks.filter((m) => m.node.kind === "seam").length).toBe(2);
  });

  it("IDENTICAL STAGE SEMANTICS: same nodes, same tuples, only coordinates differ", () => {
    // Edge case #89's own word, made a test. If the leaf ever forks so a
    // stage means one thing in the ring and another in the strip, this fails.
    const atoms = atomsOf(
      strongAtom(12, "ayah", 1, 90),
      strongAtom(12, "ayah", 2, 50),
      strongAtom(12, "connection", 1, 20),
    );
    const nodes = buildGraphNodes(12, 5, atoms, NOW);
    const tuple = (m: { node: GraphNode }) =>
      `${m.node.kind}|${m.node.stage}|${m.node.stageLabel}|${m.node.strengthPct}`;

    const arcTuples = placeArc(nodes).marks.map(tuple);
    const stripTuples = placeStrip(nodes).marks.map(tuple);
    expect(stripTuples).toEqual(arcTuples);
  });

  it("no .tsx under components/ compares against an ayah count", () => {
    // Belt and braces for v3/CLAUDE.md rule 4: the <=8 / <=9 thresholds live
    // in the compiler and must appear in NO view. This is the source scan the
    // boundaries gate's clause 5 does not currently perform.
    const dir = resolve(HERE, "../components/macro");
    const files = readdirSyncRecursive(dir).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = stripComments(readFileSync(f, "utf8"));
      expect(src, `${f} compares an ayah count in a view`).not.toMatch(
        /ayahCount\s*[<>]=?|[<>]=?\s*(?:8|9)\b/,
      );
    }
  });
});

// ===========================================================================
// EDGE CASE #87 — never colour alone
// ===========================================================================

describe("#87 — every stage carries a word and a number", () => {
  it("every node carries a non-empty stage WORD in its data", () => {
    const atoms = atomsOf(
      strongAtom(12, "ayah", 1, 90),
      strongAtom(12, "ayah", 2, 50),
      strongAtom(12, "ayah", 3, 10),
    );
    const nodes = buildGraphNodes(12, 5, atoms, NOW);
    for (const n of nodes) {
      expect(n.stageLabel.length).toBeGreaterThan(0);
      expect(typeof n.strengthPct).toBe("number");
    }
  });

  it("the five stage words are pairwise distinct — greyscale-safe", () => {
    // If two stages collapse to the same words, colour becomes the only
    // differentiator, which is exactly #87.
    const words = [
      stageLabelOf("learn", false),
      stageLabelOf("learn", true),
      stageLabelOf("reinforce", true),
      stageLabelOf("carry", true),
      stageLabelOf("lapsed", true),
    ];
    expect(new Set(words).size).toBe(words.length);
  });

  it("the ring's stage words match the progress table's, exactly", () => {
    // The ring and the list must never call the same atom by two different
    // names. Both read the same five-word vocabulary.
    expect(stageLabelOf("learn", false)).toBe("Not started");
    expect(stageLabelOf("learn", true)).toBe("Learning");
    expect(stageLabelOf("reinforce", true)).toBe("Reinforcing");
    expect(stageLabelOf("carry", true)).toBe("Carrying");
    expect(stageLabelOf("lapsed", true)).toBe("Lapsed");
  });

  it("every shape in the SVG is aria-hidden — the diagram is ONE image", () => {
    const nodes = buildGraphNodes(103, 3, new Map(), NOW);
    const { container } = render(<RingDiagram surah={103} nodes={nodes} layout="strip" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    // Not one circle/rect is exposed or focusable: 5 marks must not become 5
    // tab stops (§15 — the text alternative is the list, not aria-labels
    // bolted onto <circle> elements).
    for (const el of Array.from(svg.querySelectorAll("circle, rect, path"))) {
      expect(el.closest("[aria-hidden='true']")).not.toBeNull();
      expect(el.hasAttribute("tabindex")).toBe(false);
      expect(el.getAttribute("aria-label")).toBeNull();
    }
  });

  it("the SVG's text alternative names counts and stages IN WORDS", () => {
    const atoms = atomsOf(strongAtom(12, "ayah", 1, 90));
    const nodes = buildGraphNodes(103, 3, atoms, NOW);
    const { container } = render(<RingDiagram surah={103} nodes={nodes} layout="strip" />);
    const desc = container.querySelector("desc")!.textContent ?? "";
    expect(desc).toMatch(/3 ayat/);
    expect(desc).toMatch(/2 joints/);
    // A stage word, not a colour name.
    expect(desc.toLowerCase()).toMatch(/carrying|learning|not started/);
    expect(desc.toLowerCase()).not.toMatch(/teal|coral|green|red/);
  });

  it("the visible list link is always present, never a hover", () => {
    const nodes = buildGraphNodes(103, 3, new Map(), NOW);
    render(<RingDiagram surah={103} nodes={nodes} layout="strip" />);
    const alt = screen.getByRole("link", { name: /see every ayah and joint as a list/i });
    expect(alt.getAttribute("href")).toBe("/progress/list?surah=103");
  });

  it("summarize counts both halves for the alternative text", () => {
    const s = summarize(buildGraphNodes(12, 4, new Map(), NOW));
    expect(s.ayahCount).toBe(4);
    expect(s.seamCount).toBe(3);
  });
});

// ===========================================================================
// v3-D21 — the panel itself
// ===========================================================================

describe("v3-D21 — the macro panel", () => {
  it("an ATOMIC surah renders NO PANEL — absent, not hidden", () => {
    const facts = factsFor(3);
    expect(facts.archetype).toBe("ATOMIC");
    const { container } = render(
      <MacroPanel surah={103} facts={facts} nodes={buildGraphNodes(103, 3, new Map(), NOW)} />,
    );
    // Absence, not display:none — v3-D21 exists to avoid the empty box.
    expect(container.innerHTML).toBe("");
    expect(container.querySelector("[aria-labelledby='macro-h']")).toBeNull();
    expect(screen.queryByText(/no structure available/i)).toBeNull();
  });

  it("a RING surah renders the panel and its diagram", () => {
    const facts = factsFor(30, 4);
    expect(facts.archetype).toBe("RING");
    render(<MacroPanel surah={12} facts={facts} nodes={buildGraphNodes(12, 30, new Map(), NOW)} />);
    expect(screen.getByRole("heading", { name: /structure/i })).toBeDefined();
    expect(screen.getByRole("img", { name: /memory graph/i })).toBeDefined();
  });

  it("a derived ARC panel carries a VISIBLE honesty label (edge case #22)", () => {
    const facts = factsFor(40, 1);
    expect(facts.archetype).toBe("ARC");
    expect(facts.authored).toBe(false);
    render(<MacroPanel surah={12} facts={facts} nodes={buildGraphNodes(12, 40, new Map(), NOW)} />);
    // Visible text, not a title attribute — the structural version of §10's
    // honesty rule.
    expect(screen.getByText(/derived/i)).toBeDefined();
  });

  it("an AUTHORED panel carries no derived label", () => {
    const facts: MacroFacts = { ...factsFor(40, 1), authored: true };
    render(<MacroPanel surah={12} facts={facts} nodes={buildGraphNodes(12, 40, new Map(), NOW)} />);
    expect(screen.queryByText(/this outline is/i)).toBeNull();
  });

  it("the panel renders the FULL graph for its surah — seams included", () => {
    const nodes = buildGraphNodes(12, 30, new Map(), NOW);
    const { container } = render(<MacroPanel surah={12} facts={factsFor(30, 4)} nodes={nodes} />);
    expect(container.querySelectorAll(".graph-node").length).toBe(30);
    expect(container.querySelectorAll(".graph-seam").length).toBe(29);
  });
});

// ===========================================================================
// The engine contract these tests ride on
// ===========================================================================

describe("the engine contract", () => {
  it("buildGraphNodes agrees with expand() one-for-one", () => {
    // If expand() ever changes its packaging, this fails FIRST and says why.
    const sites = expand(12, 1, 8, 8);
    const nodes = buildGraphNodes(12, 8, new Map(), NOW);
    expect(nodes.length).toBe(sites.length);
    nodes.forEach((n, i) => {
      expect(n.atomKey).toBe(siteToAtomKey(sites[i]!));
    });
  });

  it("runs against the real corpus fixture's ayah count", () => {
    // The fixture is surah 12, 111 ayat => 221 atoms (invariant #1's own
    // bound: 111 ayat + 110 connections).
    expect(corpus.meta.ayahCount).toBe(111);
    const nodes = buildGraphNodes(corpus.meta.surah, corpus.meta.ayahCount, new Map(), NOW);
    expect(nodes.length).toBe(221);
  });
});

// --- tiny local helpers (kept at the bottom; they are not the subject) -----

function readdirSyncRecursive(dir: string): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = resolve(dir, e);
    if (statSync(p).isDirectory()) out.push(...readdirSyncRecursive(p));
    else out.push(p);
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
