/**
 * @vitest-environment jsdom
 */

// THE AYAH DETAIL ROUTE — /surah/[surah]/[ayah] (WIREFRAME §4 + §15, v3-D21).
//
// ---------------------------------------------------------------------------
// WHAT IS BEING TESTED, AND WHY IT IS NOT THE PAGE FUNCTION
// ---------------------------------------------------------------------------
// The page is an async React Server Component that calls `loadCorpus`, which
// reads the filesystem. Rendering it under jsdom would exercise the module
// loader and the corpus reader, not the product — and, worse, it would pass
// while asserting nothing, because on this route today `loadCorpus` returns
// null for every surah except 12. A test hitting /surah/112/1 would take the
// `corpus === null` branch, render two designed unavailable notes, and go
// green having proved that a stub is a stub. That is this build's documented
// failure mode and it is named here so nobody re-adds that test.
//
// So the assertions below drive the two ISLANDS the page hands its data to,
// with the SAME inputs the page computes, against the SAME real corpus fixture
// (surah 12, 111 ayat) that `loadCorpus` actually serves. What a learner sees
// on this route is what these components paint; the page's own job is to
// compute `facts`, `ayahCount`, `now` and the highlight coordinate, and a
// separate source-level assertion below pins that wiring.
//
// NOT ONE ARABIC BYTE IS TYPED HERE. Every glyph these assertions touch
// arrives at RUNTIME from the corpus fixture, addressed by COORDINATE
// (surah 12, ayah 4). check-boundaries.mjs clause 4, holding in the tests
// exactly as it holds in the app.
//
// ---------------------------------------------------------------------------
// THE FOUR THINGS A LEARNER MUST GET FROM THIS PAGE
// ---------------------------------------------------------------------------
//   1. THE AYAH, from the corpus, in an rtl/ar island (§15 / #80).
//   2. WHERE IT SITS — the whole memory graph with THIS mark flagged, seams
//      included. Filtering to the current ayah is edge case #90 and is
//      asserted against directly.
//   3. HOW WELL THEY HOLD IT — half-life, next review, time on task, stage.
//      As STRINGS from lib/progress/rows.ts, never computed in a view (B2).
//   4. Never a fabricated number: skeletons while pending (#73), "—" for
//      unmeasured, and the joint out of this ayah shown separately (v3-D03).

import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen, within } from "@testing-library/react";

import type { AtomState } from "@engine/atom.ts";
import { atomKey, initAtom } from "@engine/atom.ts";
import { buildFace } from "@engine/faces.ts";
import { ayahWords, wordGloss } from "@engine/corpus.ts";
import type { Corpus, DrillEvent } from "@engine/types.ts";

import { macroFactsFor } from "@/lib/macro/facts.ts";
import { ayahRow, buildProgressRows, seamRowFrom } from "@/lib/progress/rows";
import { buildGraphNodes, isHighlighted } from "@/components/macro/graphNodes.ts";
import { MacroPanel } from "@/components/macro/MacroPanel";
import { RingDiagram } from "@/components/macro/RingDiagram";
import { FaceText } from "@/components/quiz/FaceText";
import { AyahStatsView } from "@/components/progress/AyahStatsIsland";
import type { LocalEventRow, LogState } from "@/lib/idb";
import type { MacroFacts } from "@/components/macro/facts.ts";
import { classify } from "../../../packages/corpus-compiler/src/macro.ts";

afterEach(cleanup);

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");

/** THE SURAH THIS ROUTE CAN ACTUALLY SERVE TODAY. `lib/corpus/load.ts` exports
 *  AVAILABLE_SURAHS = [12] and reads this exact file — so a test against 12 is
 *  a test against what the route really renders, and a test against 112 would
 *  be a test against the null branch. */
const corpus: Corpus = JSON.parse(
  readFileSync(resolve(WEB, "../../packages/engine/test/fixtures/12.json"), "utf8"),
);
const SURAH = corpus.meta.surah;

/** The ayah under test. A MIDDLE ayah on purpose: ayah 1 has no incoming
 *  joint and the last has no outgoing one, so either would let a bug about
 *  seams hide behind a legitimate absence. */
const AYAH = 4;

const NOW = Date.UTC(2026, 7, 11, 9, 0, 0);
const DAY = 86_400_000;

/** A corpus narrowed to ayat [1..n]. Slicing REAL data keeps every glyph
 *  runtime-sourced; nothing is authored. */
function windowCorpus(n: number): Corpus {
  return {
    ...corpus,
    meta: { ...corpus.meta, ayahCount: n },
    verses: corpus.verses.filter((v) => v.ayah <= n),
    words: corpus.words.filter((w) => w.ayah <= n),
    distractors: corpus.distractors.filter((d) => d.ayah <= n),
  };
}

/** Atoms in DELIBERATELY DIFFERENT states, so an assertion about ayah 4 cannot
 *  be satisfied by a value that happens to be right for everything. Ayah 4 is
 *  carried and its outgoing joint is weak — v3-D03's own shape: "you know 4,
 *  you cannot yet go 4→5". */
function atomsFixture(): Map<string, AtomState> {
  const atoms = new Map<string, AtomState>();
  const put = (kind: "ayah" | "connection", ref: number, patch: Partial<AtomState>) => {
    atoms.set(atomKey(SURAH, kind, ref), { ...initAtom(SURAH, kind, ref), ...patch });
  };
  put("ayah", 1, { strength: 92, stability: 12, lastRetrieval: NOW - 60_000, reps: 9, encoded: true });
  // THE ONE UNDER TEST. stability 9 => halfLifeDays is a distinctive number, so
  // "9.4 days" cannot be confused with a neighbour's value.
  put("ayah", AYAH, { strength: 88, stability: 9, lastRetrieval: NOW - 60_000, reps: 7, encoded: true });
  // The joint LEAVING ayah 4, deliberately far weaker than the ayah itself.
  put("connection", AYAH, { strength: 21, stability: 1.5, lastRetrieval: NOW - 60_000, reps: 2, encoded: true });
  // A decoy in a different band at a neighbouring coordinate.
  put("ayah", 5, { strength: 70, stability: 1, lastRetrieval: NOW - 20 * DAY, reps: 5, lapses: 2, encoded: true });
  return atoms;
}

/** Graded taps on 12:4 where WALL-CLOCK and TIME-ON-TASK differ enormously —
 *  the third arrives 40 minutes later, so `resumePolicy` discards its latency.
 *  Kept: 3000 + 5000 = 8s. Wall clock: ~40 minutes. */
function eventsFixture(): DrillEvent[] {
  const base = { surah: SURAH, ayah: AYAH, rung: "S2" as const, type: "tap" as const };
  const start = NOW - 3600_000;
  return [
    { ...base, ts: start, correct: true, latency: 3_000 },
    { ...base, ts: start + 6_000, correct: true, latency: 5_000 },
    { ...base, ts: start + 40 * 60_000, correct: true, latency: 900_000 },
  ];
}

function rowsFixture(n = 8) {
  return buildProgressRows({
    corpus: windowCorpus(n),
    atoms: atomsFixture(),
    events: eventsFixture(),
    now: NOW,
  });
}

// ===========================================================================
// 1. THE AYAH ITSELF — every byte from the corpus, in an rtl/ar island
// ===========================================================================

describe("the ayah (§15 / #80)", () => {
  it("paints the verse the corpus holds at this coordinate, not text a caller supplied", () => {
    const face = buildFace(corpus, { kind: "verse", ayah: AYAH })!;
    expect(face).not.toBeNull();
    const { container } = render(<FaceText face={face} className="ayah" as="bdi" />);
    const el = container.querySelector(".ayah")!;

    // THE OUTPUT: the rendered text is byte-identical to the corpus verse.
    // Provenance is not claimed, it is checked against the source of truth.
    const fromCorpus = corpus.verses.find((v) => v.ayah === AYAH)!.text_uthmani;
    expect(el.textContent).toBe(fromCorpus);
    expect(el.textContent!.length).toBeGreaterThan(0);
  });

  it("carries dir=rtl AND lang=ar on the island, both — not one", () => {
    const face = buildFace(corpus, { kind: "verse", ayah: AYAH })!;
    const { container } = render(<FaceText face={face} className="ayah" as="bdi" />);
    const el = container.querySelector(".ayah")!;
    // `dir` orders the glyphs; `lang` is what makes a screen reader switch to
    // an Arabic voice instead of spelling Arabic out in English phonemes.
    expect(el.getAttribute("dir")).toBe("rtl");
    expect(el.getAttribute("lang")).toBe("ar");
    expect(el.className).toContain("rtl-island");
  });

  it("returns null for an ayah beyond the surah — the page says so rather than 404ing", () => {
    // /surah/12/200 passes parseAyah's 286 sanity bound, reaches buildFace and
    // gets null. That is a deliberate decision documented on parseAyah: a real
    // sentence naming the surah and the number beats a blank 404.
    expect(buildFace(corpus, { kind: "verse", ayah: 200 })).toBeNull();
    expect(ayahWords(corpus, 200)).toEqual([]);
  });

  it("glosses every word through the ms → en → surface chain", () => {
    const words = ayahWords(corpus, AYAH);
    expect(words.length).toBeGreaterThan(0);
    for (const w of words) {
      // A gloss is never empty: the chain's last link is the word itself.
      expect(wordGloss(w).length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// 2. POSITION — the WHOLE graph, with THIS mark flagged (#90 + #87)
// ===========================================================================

describe("position: the bridge (§4)", () => {
  const N = 12;
  const facts = (): MacroFacts => classify({ ayahCount: N, rukuCount: 4 }) as MacroFacts;
  const nodes = () => buildGraphNodes(SURAH, N, atomsFixture(), NOW);

  it("shows the FULL memory graph, seams included — never filtered to one ayah (#90)", () => {
    // THE REGRESSION THIS EXISTS FOR: a detail page that "zooms in" by slicing
    // nodes down to the current ayah drops all N-1 joints, which for a short
    // surah is ~40% of the memory graph. The page must pass a COORDINATE, not
    // a narrowed array.
    const { container } = render(
      <MacroPanel
        surah={SURAH}
        facts={facts()}
        nodes={nodes()}
        highlight={{ kind: "ayah", ayah: AYAH }}
      />,
    );
    expect(container.querySelectorAll(".graph-node").length).toBe(N);
    expect(container.querySelectorAll(".graph-seam").length).toBe(N - 1);
  });

  it("flags exactly ONE mark as current, and it is the ayah in the URL", () => {
    const { container } = render(
      <MacroPanel
        surah={SURAH}
        facts={facts()}
        nodes={nodes()}
        highlight={{ kind: "ayah", ayah: AYAH }}
      />,
    );
    // Exactly one — not zero (the highlight never arrived) and not N (every
    // mark ringed is the same as none).
    expect(container.querySelectorAll(".graph-current").length).toBe(1);
    expect(container.querySelectorAll(".graph-node--current").length).toBe(1);
  });

  it("says 'you are here' IN WORDS, so the ring is not the only carrier (#87)", () => {
    // The dashed outline is a purely visual cue and reaches nobody using a
    // screen reader. THE OUTPUT a non-sighted learner gets is this link text.
    render(
      <MacroPanel
        surah={SURAH}
        facts={facts()}
        nodes={nodes()}
        highlight={{ kind: "ayah", ayah: AYAH }}
      />,
    );
    const nav = screen.getByRole("navigation", { name: /ayat and joints/i });
    const links = Array.from(nav.querySelectorAll("a"));
    const here = links.filter((a) => /you are here/i.test(a.textContent ?? ""));
    expect(here).toHaveLength(1);
    // And it is the RIGHT one — naming the ayah, its stage word, and its number.
    expect(here[0]!.textContent).toMatch(new RegExp(`Ayah ${SURAH}:${AYAH},`));
    expect(here[0]!.textContent).toMatch(/Carrying/);
    expect(here[0]!.getAttribute("aria-current")).toBe("page");
  });

  it("names the current ayah in the diagram's text alternative", () => {
    const { container } = render(
      <RingDiagram
        surah={SURAH}
        nodes={nodes()}
        layout="arc"
        highlight={{ kind: "ayah", ayah: AYAH }}
      />,
    );
    expect(container.querySelector("desc")!.textContent).toMatch(
      new RegExp(`You are on ayah ${AYAH}\\.`),
    );
  });

  it("marks NO seam as current, even the one leaving this ayah", () => {
    // The route is /surah/S/A — the learner is at an ayah. Ringing the joint
    // after it would claim they are at a junction they may never have drilled.
    const highlight = { kind: "ayah" as const, ayah: AYAH };
    const seams = nodes().filter((n) => n.kind === "seam");
    expect(seams.length).toBe(N - 1);
    for (const s of seams) expect(isHighlighted(s, highlight)).toBe(false);
  });

  it("renders identically to the surah route when there is no highlight", () => {
    // The sibling route passes nothing. Its output must be unchanged — the
    // prop is additive, and an additive prop that alters the default render is
    // not additive.
    const { container } = render(<RingDiagram surah={SURAH} nodes={nodes()} layout="arc" />);
    expect(container.querySelectorAll(".graph-current").length).toBe(0);
    expect(container.querySelector("desc")!.textContent).not.toMatch(/you are here|You are on/i);
    for (const a of Array.from(container.querySelectorAll("nav a"))) {
      expect(a.textContent).not.toMatch(/you are here/i);
      expect(a.hasAttribute("aria-current")).toBe(false);
    }
  });

  it("an ATOMIC surah renders no panel at all — absence, not an empty box (v3-D21)", () => {
    // A 3-ayah surah's ayah page shows no STRUCTURE card. The list already is
    // the macro view at that size.
    const atomicFacts = classify({ ayahCount: 3 }) as MacroFacts;
    expect(atomicFacts.archetype).toBe("ATOMIC");
    const { container } = render(
      <MacroPanel
        surah={SURAH}
        facts={atomicFacts}
        nodes={buildGraphNodes(SURAH, 3, new Map(), NOW)}
        highlight={{ kind: "ayah", ayah: 2 }}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("classifies from the REAL corpus the route loads, not a hand-made facts object", () => {
    // The page calls macroFactsFor(corpus). If that ever stopped producing a
    // usable archetype for the one surah this route serves, the panel would
    // silently vanish in production and every component test above would stay
    // green.
    const facts = macroFactsFor(corpus);
    expect(["ATOMIC", "RING", "LITANY", "ARC"]).toContain(facts.archetype);
    expect(facts.archetype).not.toBe("ATOMIC"); // 111 ayat
    expect(["arc", "strip"]).toContain(facts.layout);
  });
});

// ===========================================================================
// 3. HOW WELL YOU HOLD IT — the strings a learner reads
// ===========================================================================

describe("how well you hold it (§10 + §15)", () => {
  it("selects the row for THIS ayah — not the first row, not a neighbour's", () => {
    const rows = rowsFixture();
    const row = ayahRow(rows, AYAH)!;
    expect(row).toBeDefined();
    expect(row.id).toBe(`${SURAH}:ayah:${AYAH}`);
    expect(row.kind).toBe("ayah");
    expect(row.ayah).toBe(AYAH);
    // And it is NOT ayah 1's row, whose atom is deliberately in a different
    // state — the mistake a `rows[0]` or an off-by-one selector would make.
    expect(row.id).not.toBe(ayahRow(rows, 1)!.id);
    expect(row.strengthPct).not.toBe(ayahRow(rows, 1)!.strengthPct);
  });

  // REGRESSION, found by mutation. Dropping the `kind === "ayah"` guard from
  // `ayahRow` — leaving a bare `r.ayah === ayah` — left all 28 tests GREEN,
  // because `expand()` emits ayah-before-seam and `.find` therefore happened to
  // land on the right row anyway. The guard was doing nothing that any test
  // could see, which is a guard that will be deleted as dead code and will take
  // the correctness with it the first time rows arrive in any other order (a
  // sort by strength interleaves them; `sortRows` in this very module does
  // exactly that). A seam and its left-hand ayah SHARE the `ayah` field — that
  // is the field's documented meaning for a seam — so kind is the only thing
  // separating them.
  //
  // Asserted against REVERSED rows: same data, order that no longer rescues a
  // kind-blind selector.
  it("selects by KIND, not by position — a reversed row list still finds the ayah", () => {
    const rows = rowsFixture();
    const reversed = [...rows].reverse();
    const row = ayahRow(reversed, AYAH)!;
    expect(row.kind).toBe("ayah");
    expect(row.id).toBe(`${SURAH}:ayah:${AYAH}`);
    // The seam that shares this `ayah` number must NOT be what comes back: it
    // is a different atom with a different strength, and reporting it as the
    // ayah's own would tell a carried learner they are at 21%.
    expect(row.id).not.toBe(`${SURAH}:seam:${AYAH}`);

    // And the mirror: seamRowFrom must be equally kind-blind-proof.
    const seam = seamRowFrom(reversed, AYAH)!;
    expect(seam.kind).toBe("seam");
    expect(seam.id).toBe(`${SURAH}:seam:${AYAH}`);
  });

  it("prints a REAL half-life — a number and the word 'days', never a bare zero", () => {
    const row = ayahRow(rowsFixture(), AYAH)!;
    // THE OUTPUT: what the learner reads in the "Half-life" cell.
    expect(row.halfLifeLabel).toMatch(/^\d+\.\d days$/);
    expect(row.halfLifeLabel).not.toBe("—");
    expect(row.halfLifeLabel).not.toBe("0.0 days");
  });

  it("prints time on task, not wall clock — the two differ by 40 minutes here", () => {
    const row = ayahRow(rowsFixture(), AYAH)!;
    // Kept latencies 3000 + 5000 = 8s. The 900s latency straddles a
    // resumePolicy-discarded interruption and must not be counted. A learner
    // who took a phone call must not look 100x slower than they were.
    expect(row.timeOnTask).toBe("8s");
    const events = eventsFixture();
    const wallClockMin = Math.round((events.at(-1)!.ts - events[0]!.ts) / 60_000);
    expect(wallClockMin).toBe(40);
    expect(row.timeOnTask).not.toMatch(/m /); // never "40m 0s"
  });

  it("prints a next review the scheduler would agree with", () => {
    const row = ayahRow(rowsFixture(), AYAH)!;
    expect(row.nextLabel).toMatch(/^(Today|in \d+ days?|Gate .*)$/);
    expect(row.nextLabel).not.toBe("Not scheduled"); // this atom HAS been retrieved
  });

  it("names the stage in a WORD and pairs it with a number (#87)", () => {
    const row = ayahRow(rowsFixture(), AYAH)!;
    expect(row.stageLabel).toBe("Carrying");
    expect(row.strengthLabel).toMatch(/^\d+%$/);
  });

  it("says '—' and 'Not started' for an untouched ayah — never 0% (#73's sibling)", () => {
    // A new learner. "0% strong" is a CLAIM about their memory; "unmeasured"
    // is the truth. The block still renders, because "you have not started
    // this" is information they came for.
    const rows = buildProgressRows({
      corpus: windowCorpus(8),
      atoms: new Map(),
      events: [],
      now: NOW,
    });
    const row = ayahRow(rows, AYAH)!;
    expect(row.stageLabel).toBe("Not started");
    expect(row.strengthLabel).toBe("—");
    expect(row.halfLifeLabel).toBe("—");
    expect(row.timeOnTask).toBe("—");
    expect(row.strengthLabel).not.toBe("0%");
  });

  it("reports the JOINT out of this ayah separately, and it disagrees with the ayah (v3-D03 / #90)", () => {
    const rows = rowsFixture();
    const row = ayahRow(rows, AYAH)!;
    const seam = seamRowFrom(rows, AYAH)!;
    expect(seam).toBeDefined();
    expect(seam.id).toBe(`${SURAH}:seam:${AYAH}`);
    expect(seam.reference).toBe(`${SURAH}:${AYAH}→${AYAH + 1}`);
    // THE POINT: "you know 4, you cannot yet go 4→5". If the seam silently
    // mirrored its left-hand ayah, this is the only thing that would notice.
    expect(seam.strengthPct).not.toBe(row.strengthPct);
    expect(seam.strengthPct).toBeLessThan(row.strengthPct);
    expect(seam.stageLabel).not.toBe(row.stageLabel);
  });

  it("has no joint at the LAST ayah — expand() never builds one (E-08)", () => {
    const n = 8;
    const rows = rowsFixture(n);
    expect(seamRowFrom(rows, n)).toBeUndefined();
    // …but every earlier ayah has one, so "undefined" is not the universal answer.
    for (let a = 1; a < n; a++) expect(seamRowFrom(rows, a)).toBeDefined();
  });

  it("returns undefined for an ayah outside the surah, rather than a fabricated row", () => {
    const rows = rowsFixture(8);
    expect(ayahRow(rows, 200)).toBeUndefined();
    expect(ayahRow(rows, 0)).toBeUndefined();
  });
});

// ===========================================================================
// 3b. THE FOUR STATES, AS RENDERED OUTPUT — edge case #73
// ===========================================================================
//
// WRITTEN BECAUSE A SOURCE SCAN WAS NOT ENOUGH, and the gap was found by
// mutation, not by review. The first version of these assertions checked that
// AyahStatsIsland.tsx CONTAINED the string "StatsSkeleton" and a `case
// "pending":`. Collapsing the pending branch into the empty one — so a learner
// mid-read is shown "Not started" and "—" for an ayah they may have carried for
// weeks — kept all 29 tests GREEN. The scan asserted that a skeleton existed,
// never that `pending` rendered it. That is precisely the distinction #73 is
// about, and it is why these drive the real component with real LogStates and
// read what a learner would actually see on screen.

describe("the four states, as a learner sees them (#73)", () => {
  const view = (state: LogState<LocalEventRow[]>) =>
    render(
      <AyahStatsView state={state} corpus={windowCorpus(8)} ayah={AYAH} now={NOW} />,
    );

  it("pending: paints skeletons and claims NO number — not 0%, not '—'", () => {
    const { container } = view({ status: "pending" });
    expect(container.querySelectorAll(".skel").length).toBeGreaterThan(0);
    const text = container.textContent ?? "";
    // A pending read that paints 0 is the same lie as an SSR'd 0. And "—" is
    // itself a claim (this atom is unmeasured) that is not yet known to be true.
    expect(text).not.toMatch(/\d+%/);
    expect(text).not.toContain("—");
    expect(text).not.toMatch(/Not started|Carrying|Learning|Reinforcing|Lapsed/);
    expect(text).not.toMatch(/days/);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("empty: a REAL answer for a new learner — the block appears, reading 'Not started'", () => {
    // Not a skeleton and not a blank: "you have not started this yet" is
    // information the learner came for, and it is TRUE.
    const { container } = view({ status: "empty" });
    expect(container.querySelectorAll(".skel").length).toBe(0);
    const text = container.textContent ?? "";
    expect(text).toContain("Not started");
    expect(text).toContain("—");
    expect(text).not.toMatch(/\d+%/); // never "0%"
  });

  it("ready: prints the real figures — the stage word, the half-life, the time", () => {
    const events = eventsFixture();
    const { container } = view({ status: "ready", data: events as LocalEventRow[] });
    const text = container.textContent ?? "";
    expect(container.querySelectorAll(".skel").length).toBe(0);
    // The labelled figures a learner reads. Driven through the REAL fold:
    // these events are graded taps, so rebuild() produces an encoded atom.
    expect(text).toMatch(/Half-life/);
    expect(text).toMatch(/Next review/);
    expect(text).toMatch(/Time on task/);
    // Time on task counts the two uninterrupted latencies (3s + 5s) and drops
    // the one straddling the 40-minute gap.
    expect(text).toContain("8s");
    expect(text).not.toMatch(/40m/);
  });

  it("broken: says so and NAMES the reason — never a silent fall-back to empty", () => {
    // A silent fall-back would be indistinguishable from `empty`, i.e. a lie
    // about a failure: the learner would read "Not started" for an ayah whose
    // record simply could not be opened.
    const { container } = view({ status: "broken", reason: "private-mode" });
    expect(screen.getByRole("alert")).toBeTruthy();
    const text = container.textContent ?? "";
    expect(text).toMatch(/could not be read/i);
    // The REASON, named. "you're in private browsing" and "another tab is
    // mid-upgrade" are not the same problem and must not get the same message.
    expect(text).toContain("private-mode");
    expect(text).not.toContain("Not started");
    expect(text).toMatch(/nothing has been lost/i);
  });

  it("every state pairs each figure with its NAME — a <dl>, not a row of bare numbers", () => {
    // What makes a screen reader announce "Half-life, 9.4 days" instead of an
    // undifferentiated wall of numbers. The same requirement §15 puts on the
    // progress table, at this zoom.
    const { container } = view({ status: "ready", data: eventsFixture() as LocalEventRow[] });
    const dl = container.querySelector("dl")!;
    expect(dl).not.toBeNull();
    const terms = Array.from(dl.querySelectorAll("dt")).map((t) => t.textContent);
    expect(terms).toContain("Half-life");
    expect(terms).toContain("Next review");
    expect(terms).toContain("Time on task");
    expect(terms).toContain("Stage");
    // Each name has a value beside it.
    expect(dl.querySelectorAll("dd").length).toBe(dl.querySelectorAll("dt").length);
  });

  it("shows the JOINT out of this ayah on screen, not only in the data (#90)", () => {
    const { container } = view({ status: "ready", data: eventsFixture() as LocalEventRow[] });
    const text = container.textContent ?? "";
    // The reference of the junction the learner has to cross, as a visible
    // LTR island beside the ayah's own figures.
    expect(text).toContain(`${SURAH}:${AYAH}→${AYAH + 1}`);
    expect(container.querySelector(".ltr-island")).not.toBeNull();
    expect(text).toMatch(/Joint stage/);
  });

  it("shows NO joint at the last ayah — there is none to show (E-08)", () => {
    const { container } = render(
      <AyahStatsView
        state={{ status: "empty" }}
        corpus={windowCorpus(8)}
        ayah={8}
        now={NOW}
      />,
    );
    expect(container.textContent).not.toMatch(/Joint stage/);
    expect(container.textContent).not.toContain("→");
  });

  it("an ayah outside the surah gets a designed sentence, not a row of zeros", () => {
    const { container } = render(
      <AyahStatsView
        state={{ status: "empty" }}
        corpus={windowCorpus(8)}
        ayah={200}
        now={NOW}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toMatch(/has no ayah 200/);
    expect(text).not.toMatch(/\d+%/);
    expect(container.querySelector("dl")).toBeNull();
  });
});

// ===========================================================================
// 4. THE WIRING — the assertions the component tests above cannot make
// ===========================================================================
//
// Every test above drives a component with inputs a test constructed. That
// proves the components are right and proves NOTHING about whether the page
// hands them those inputs — which is precisely how a route ships with two stub
// notes while its component suite is green. These read the page's source.

describe("the route is actually wired (not two stubs behind a green suite)", () => {
  const pageSrc = () =>
    readFileSync(resolve(WEB, "app/(app)/surah/[surah]/[ayah]/page.tsx"), "utf8");

  it("renders the macro island and the stats island — no StubNote remains", () => {
    const src = pageSrc();
    expect(src).toMatch(/<MacroPanelIsland/);
    expect(src).toMatch(/<AyahStatsIsland/);
    // The two placeholders this route shipped with are gone, and the import
    // with them — a StubNote left importable is a StubNote that comes back.
    expect(src).not.toMatch(/StubNote/);
  });

  it("passes a highlight COORDINATE, and never narrows ayahCount to the current ayah (#90)", () => {
    const src = pageSrc();
    expect(src).toMatch(/highlight=\{\{\s*kind:\s*"ayah",\s*ayah\s*\}\}/);
    // The graph is sized by the SURAH, not by the ayah. `ayahCount={ayah}`
    // would render a one-mark graph and no seams at all.
    expect(src).toMatch(/ayahCount=\{ayahCount\}/);
    expect(src).not.toMatch(/ayahCount=\{ayah\}/);
  });

  it("captures `now` ONCE, so every figure decays to the same instant", () => {
    const src = pageSrc();
    expect(src.match(/Date\.now\(\)/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/now=\{now\}/);
  });

  it("stays a SERVER component: it never imports lib/idb (clause 2 / #72)", () => {
    // The islands own that import. A server component reaching for the log
    // renders 0% and production React keeps it.
    expect(pageSrc()).not.toMatch(/lib\/idb/);
  });

  it("the stats island IS a client island and owns the log read", () => {
    const src = readFileSync(resolve(WEB, "components/progress/AyahStatsIsland.tsx"), "utf8");
    expect(src.split("\n")[0]!.trim()).toBe('"use client";');
    expect(src).toMatch(/getEventsForSurah/);
    expect(src).toMatch(/useLogState/);
  });

  it("the stats island computes nothing — it prints the row builder's strings", () => {
    const src = stripComments(
      readFileSync(resolve(WEB, "components/progress/AyahStatsIsland.tsx"), "utf8"),
    );
    // It PRINTS these.
    for (const field of ["halfLifeLabel", "nextLabel", "timeOnTask", "stageLabel"]) {
      expect(src, `does not render ${field}`).toContain(`row.${field}`);
    }
    // And it never RE-DERIVES them. A half-life or a duration computed beside
    // the JSX is DEFECTS.md#B2's exact shape.
    expect(src).not.toMatch(/halfLifeDays|currentStrength|currentBand|formatDuration|86_?400/);
  });

  it("renders the stage through StageBadge — the app's only stage renderer (#87)", () => {
    const src = readFileSync(resolve(WEB, "components/progress/AyahStatsIsland.tsx"), "utf8");
    expect(src).toMatch(/<StageBadge/);
    // And the sole-renderer rule still holds across the whole tree after this
    // change: the new island must not have drawn its own dot.
    const offenders = sources().filter(
      (f) => /stage-dot/.test(stripComments(readFileSync(f, "utf8"))) && !f.endsWith("StageBadge.tsx"),
    );
    expect(offenders.map((f) => f.replace(WEB, ""))).toEqual([]);
  });
});

// --- tiny local helpers (not the subject) ----------------------------------

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === "node_modules") continue;
    const p = resolve(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

function sources(): string[] {
  return [...walk(resolve(WEB, "app")), ...walk(resolve(WEB, "components"))].filter(
    (f) => !f.endsWith(".test.tsx") && !f.endsWith(".test.ts"),
  );
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
