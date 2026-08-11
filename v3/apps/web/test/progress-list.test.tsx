/**
 * @vitest-environment jsdom
 */

// RENDER TESTS for /progress/list — THE ACCESSIBLE PROGRESS TABLE (§15).
//
// ---------------------------------------------------------------------------
// WHY THESE ARE QUERIED BY ROLE AND NOT BY CLASS
// ---------------------------------------------------------------------------
// §15's requirement is not "a table-looking thing". It is that a screen reader
// announces "Ayah 3, lapsed, 48%" — which is a property of the ACCESSIBILITY
// TREE, not of the DOM. `getByRole("table")` / `getAllByRole("columnheader")`
// read the same tree the screen reader does, so a "modernisation" into a grid
// of <div>s fails here even though it would still look identical and would
// still pass any class-based assertion.
//
// ---------------------------------------------------------------------------
// WHAT IS ASSERTED, AND WHICH REGRESSION EACH ONE PREVENTS
// ---------------------------------------------------------------------------
//   - a REAL <table> with real column headers and a row header per row —
//     the "grid of divs" regression;
//   - every stage cell carries a TEXT LABEL and a NUMBER, not only a coloured
//     dot, and the dot is aria-hidden (edge case #87 — teal and coral are
//     near-indistinguishable to ~8% of men with deuteranopia);
//   - `.stage-dot` is rendered by exactly ONE module (#87's own resolution:
//     "StageBadge is the ONLY stage renderer") — asserted as a source scan,
//     the same shape check-boundaries.mjs uses;
//   - Arabic cells carry dir="rtl" AND lang="ar" while the row stays LTR
//     (#80 / §15's "the classic bug here");
//   - SEAM (connection) rows appear — edge case #90, the bug where ~40% of a
//     short surah's memory graph is unrendered. Asserted as a COUNT identity
//     (2N-1 rows for N ayat) so "seams render" cannot be satisfied by one
//     token seam;
//   - the time column is TIME ON TASK: the sum of kept latencies, never
//     wall-clock. The fixture is built so the two numbers DIFFER, so the test
//     cannot pass by coincidence.
//
// Not one Arabic byte is typed here: every glyph these assertions see arrives
// at RUNTIME from the corpus fixture, which is the sacred-text rule
// (check-boundaries.mjs clause 4) holding in the tests exactly as in the app.

import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen, within } from "@testing-library/react";

import type { Corpus, DrillEvent } from "@engine/types.ts";
import type { AtomState } from "@engine/atom.ts";
import { atomKey, initAtom } from "@engine/atom.ts";

import { buildProgressRows, timeOnTaskMs } from "@/lib/progress/rows";
import { ProgressTable } from "@/components/progress/ProgressTable";
import { StageBadge } from "@/components/progress/StageBadge";

afterEach(cleanup);

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");
const corpus: Corpus = JSON.parse(
  readFileSync(resolve(WEB, "../../packages/engine/test/fixtures/12.json"), "utf8"),
);

/** The corpus fixture is surah 12 (111 ayat). Rendering all 221 atoms in every
 *  test is wasteful, so most tests use a WINDOW of it — a range of ayat, which
 *  is exactly what `expand()` packages. The surah stays real; only the range
 *  is narrowed. */
const SURAH = corpus.meta.surah;

/** A corpus narrowed to ayat [1..n], so a test can assert the 2N-1 identity at
 *  a small N without inventing a corpus. Slicing real data keeps the Arabic
 *  runtime-sourced; nothing is authored here. */
function windowCorpus(n: number): Corpus {
  return {
    ...corpus,
    meta: { ...corpus.meta, ayahCount: n },
    verses: corpus.verses.filter((v) => v.ayah <= n),
    words: corpus.words.filter((w) => w.ayah <= n),
    distractors: corpus.distractors.filter((d) => d.ayah <= n),
  };
}

const NOW = Date.UTC(2026, 7, 11, 9, 0, 0);
const DAY = 86_400_000;

/** An atoms map with a few atoms deliberately in DIFFERENT stages, so a test
 *  asserting "the four stages read differently" has four stages to read. */
function atomsFixture(): Map<string, AtomState> {
  const atoms = new Map<string, AtomState>();
  const put = (kind: "ayah" | "connection", ref: number, patch: Partial<AtomState>) => {
    const a: AtomState = { ...initAtom(SURAH, kind, ref), ...patch };
    atoms.set(atomKey(SURAH, kind, ref), a);
  };
  // Carrying: high strength, retrieved moments ago so decay is negligible.
  put("ayah", 1, { strength: 92, stability: 12, lastRetrieval: NOW - 60_000, reps: 9, encoded: true });
  // Reinforcing.
  put("ayah", 2, { strength: 61, stability: 4, lastRetrieval: NOW - 60_000, reps: 4, encoded: true });
  // Lapsed-shaped: encoded, but decayed far below the learn band.
  put("ayah", 3, { strength: 70, stability: 1, lastRetrieval: NOW - 20 * DAY, reps: 5, lapses: 2, encoded: true });
  // A SEAM whose strength deliberately differs from its left-hand ayah's, so
  // "the seam mirrors ayah `from`" is a detectable bug rather than invisible.
  put("connection", 1, { strength: 30, stability: 2, lastRetrieval: NOW - 60_000, reps: 2, encoded: true });
  return atoms;
}

/** An event log where WALL-CLOCK and TIME-ON-TASK are different numbers.
 *
 *  Three graded taps on 12:1. The first two are seconds apart — an
 *  uninterrupted run, so both latencies count. The THIRD arrives 40 minutes
 *  later, because the learner took a phone call: `resumePolicy()` classifies
 *  that gap as a `restart` and reports `discardLatency`, so the 900-second
 *  latency straddling the interruption is thrown away.
 *
 *  Time on task  = 1500 + 2500      = 4 s.
 *  Wall clock    = last.ts - first.ts ≈ 40 min.
 *
 *  The two numbers are deliberately far apart, so a test asserting the honest
 *  one cannot pass by coincidence if someone swaps in the wall-clock formula. */
function eventsFixture(): DrillEvent[] {
  const base = { surah: SURAH, ayah: 1, rung: "S2" as const, type: "tap" as const };
  const start = NOW - 3600_000;
  return [
    { ...base, ts: start, correct: true, latency: 1_500 },
    { ...base, ts: start + 4_000, correct: true, latency: 2_500 },
    // The interrupted item: 40 minutes after the previous tap, so its measured
    // latency is an artefact of the learner walking away and must be DISCARDED.
    { ...base, ts: start + 40 * 60_000, correct: true, latency: 900_000 },
  ];
}

// ---------------------------------------------------------------------------
// 1. A REAL SEMANTIC TABLE
// ---------------------------------------------------------------------------

describe("the progress table is a real table (§15)", () => {
  const rows = () =>
    buildProgressRows({
      corpus: windowCorpus(4),
      atoms: atomsFixture(),
      events: eventsFixture(),
      now: NOW,
    });

  it("exposes role=table — not a grid of divs", () => {
    render(<ProgressTable rows={rows()} />);
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("has a real column header for every column", () => {
    render(<ProgressTable rows={rows()} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent?.trim());
    // The §15 column set. `Kind` is load-bearing: without it a seam row is
    // distinguishable only by a single arrow glyph, which is lost the moment
    // the table is sorted by strength and the rows interleave.
    for (const label of ["Item", "Text", "Kind", "Stage", "Strength", "Half-life", "Next", "Time on task"]) {
      expect(headers, `missing column header ${label}`).toContain(label);
    }
  });

  it("names the time column honestly — time on task, never wall-clock", () => {
    render(<ProgressTable rows={rows()} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent?.trim());
    expect(headers).toContain("Time on task");
    expect(headers).not.toContain("Time");
    expect(headers).not.toContain("Duration");
  });

  it("gives every row a row header, so the reference is announced with each cell", () => {
    render(<ProgressTable rows={rows()} />);
    const table = screen.getByRole("table");
    const bodyRows = within(table).getAllByRole("row").slice(1); // drop the header row
    expect(bodyRows.length).toBeGreaterThan(0);
    for (const row of bodyRows) {
      // A <th scope="row"> is exposed as role=rowheader. This is what produces
      // §15's target utterance "Ayah 3, lapsed, 48%".
      expect(within(row).getAllByRole("rowheader").length, row.textContent ?? "").toBe(1);
    }
  });

  it("carries a caption naming what the numbers mean", () => {
    render(<ProgressTable rows={rows()} />);
    const table = screen.getByRole("table");
    const caption = table.querySelector("caption");
    expect(caption).toBeTruthy();
    expect(caption?.textContent).toMatch(/time on task/i);
  });
});

// ---------------------------------------------------------------------------
// 2. NEVER COLOUR ALONE — edge case #87
// ---------------------------------------------------------------------------

describe("never colour alone (#87)", () => {
  const rows = () =>
    buildProgressRows({
      corpus: windowCorpus(4),
      atoms: atomsFixture(),
      events: eventsFixture(),
      now: NOW,
    });

  it("gives every stage cell a text label AND a number, not just a class", () => {
    const { container } = render(<ProgressTable rows={rows()} />);
    const dots = container.querySelectorAll(".stage-dot");
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of Array.from(dots)) {
      const label = dot.parentElement?.querySelector(".stage-label__name");
      const value = dot.parentElement?.querySelector(".stage-label__value");
      expect(label?.textContent?.trim(), "a dot with no word").toBeTruthy();
      expect(value?.textContent?.trim(), "a dot with no number").toBeTruthy();
    }
  });

  it("hides the dot from the accessibility tree — it is decoration, not information", () => {
    const { container } = render(<ProgressTable rows={rows()} />);
    for (const dot of Array.from(container.querySelectorAll(".stage-dot"))) {
      expect(dot.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("distinguishes the five stages by TEXT, so greyscale loses nothing", () => {
    // Colour-independent by construction: if two stages collapse to the same
    // words, colour is the only differentiator left and #87 is back.
    const words = new Set<string>();
    for (const stage of ["learn", "reinforce", "carry", "lapsed"] as const) {
      for (const encoded of [true, false]) {
        cleanup();
        const { container } = render(
          <StageBadge stage={stage} stageLabel={labelFor(stage, encoded)} strengthPct={48} />,
        );
        words.add(container.querySelector(".stage-label__name")?.textContent?.trim() ?? "");
      }
    }
    // learn+unencoded is "Not started"; the other four are their own words.
    expect(words.size).toBe(5);
  });

  it("gives lapsed its own mark, distinct from carry", () => {
    // iman-ui.css sets --stage-carry to coral, the same family the locked
    // file's §8 reserves for slips — so a naive lapsed dot would be
    // indistinguishable from the STRONGEST band. Guarded here.
    const { container: lapsed } = render(
      <StageBadge stage="lapsed" stageLabel="Lapsed" strengthPct={12} />,
    );
    const lapsedClass = lapsed.querySelector(".stage-dot")?.className ?? "";
    cleanup();
    const { container: carry } = render(
      <StageBadge stage="carry" stageLabel="Carrying" strengthPct={92} />,
    );
    const carryClass = carry.querySelector(".stage-dot")?.className ?? "";
    expect(lapsedClass).not.toBe(carryClass);
  });
});

/** The stage words, mirrored from lib/progress/rows so the test states the
 *  expectation independently rather than importing the answer it is checking. */
function labelFor(stage: string, encoded: boolean): string {
  if (stage === "learn") return encoded ? "Learning" : "Not started";
  if (stage === "reinforce") return "Reinforcing";
  if (stage === "carry") return "Carrying";
  return "Lapsed";
}

// ---------------------------------------------------------------------------
// 3. DIRECTION — §15's "classic bug"
// ---------------------------------------------------------------------------

describe("mixed direction (#80 / §15)", () => {
  const rows = () =>
    buildProgressRows({
      corpus: windowCorpus(4),
      atoms: atomsFixture(),
      events: eventsFixture(),
      now: NOW,
    });

  it("gives every Arabic cell dir=rtl AND lang=ar", () => {
    const { container } = render(<ProgressTable rows={rows()} />);
    const arabicCells = container.querySelectorAll(".rtl-island");
    expect(arabicCells.length).toBeGreaterThan(0);
    for (const cell of Array.from(arabicCells)) {
      // CSS direction alone does not tell a screen reader which language it
      // is reading. The class is the paint; the attributes are the meaning.
      expect(cell.getAttribute("dir")).toBe("rtl");
      expect(cell.getAttribute("lang")).toBe("ar");
    }
  });

  it("keeps the row and the table LTR — only the Arabic cell flips", () => {
    const { container } = render(<ProgressTable rows={rows()} />);
    expect(container.querySelector("table")?.getAttribute("dir")).not.toBe("rtl");
    for (const tr of Array.from(container.querySelectorAll("tr"))) {
      expect(tr.getAttribute("dir")).not.toBe("rtl");
    }
  });

  it("wraps the Latin reference in an LTR island so it never reorders", () => {
    const { container } = render(<ProgressTable rows={rows()} />);
    const refs = container.querySelectorAll("th[scope='row'] .ltr-island");
    expect(refs.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. SEAMS ARE RENDERED — edge case #90
// ---------------------------------------------------------------------------

describe("seam rows are present (#90)", () => {
  it.each([3, 4, 7, 9, 10])(
    "renders 2N-1 rows for N=%i ayat — N ayah rows plus N-1 joints",
    (n) => {
      const rows = buildProgressRows({
        corpus: windowCorpus(n),
        atoms: atomsFixture(),
        events: [],
        now: NOW,
      });
      expect(rows.length).toBe(2 * n - 1);
      expect(rows.filter((r) => r.kind === "seam").length).toBe(n - 1);
    },
  );

  it("labels a joint with a WORD, so it survives sorting and colour-blindness", () => {
    const rows = buildProgressRows({
      corpus: windowCorpus(4),
      atoms: atomsFixture(),
      events: [],
      now: NOW,
    });
    render(<ProgressTable rows={rows} />);
    const table = screen.getByRole("table");
    const cells = within(table)
      .getAllByRole("cell")
      .map((c) => c.textContent?.trim());
    expect(cells.filter((c) => c === "Joint").length).toBe(3);
    expect(cells.filter((c) => c === "Ayah").length).toBe(4);
  });

  it("never constructs a seam at the last ayah (E-08, by construction)", () => {
    const n = 5;
    const rows = buildProgressRows({
      corpus: windowCorpus(n),
      atoms: atomsFixture(),
      events: [],
      now: NOW,
    });
    const seams = rows.filter((r) => r.kind === "seam");
    // Every seam is n->n+1 for n in 1..N-1. A seam AT the last ayah would
    // assert a junction to an ayah that does not exist.
    expect(Math.max(...seams.map((s) => s.ayah))).toBe(n - 1);
  });

  it("keeps seams at 40% of a 3-ayah surah's rows — #90's own number", () => {
    const rows = buildProgressRows({
      corpus: windowCorpus(3),
      atoms: atomsFixture(),
      events: [],
      now: NOW,
    });
    const share = rows.filter((r) => r.kind === "seam").length / rows.length;
    expect(share).toBeGreaterThanOrEqual(0.4);
  });

  it("reads a seam's strength from its OWN connection atom, not its left ayah", () => {
    const rows = buildProgressRows({
      corpus: windowCorpus(4),
      atoms: atomsFixture(),
      events: [],
      now: NOW,
    });
    const ayah1 = rows.find((r) => r.kind === "ayah" && r.ayah === 1);
    const seam1 = rows.find((r) => r.kind === "seam" && r.ayah === 1);
    // The fixture set these deliberately apart (92 vs 30). If a seam silently
    // mirrors its left-hand ayah, this is the only thing that notices.
    expect(seam1?.strengthPct).not.toBe(ayah1?.strengthPct);
    expect(seam1?.strengthPct).toBeGreaterThan(0);
  });

  it("renders a not-yet-eligible seam rather than omitting it", () => {
    // v3-D03: a seam whose adjacent ayat are not both strong is not ELIGIBLE.
    // Ineligible is not the same as invisible — conflating the two IS #90.
    const rows = buildProgressRows({
      corpus: windowCorpus(4),
      atoms: new Map(), // nothing learned at all
      events: [],
      now: NOW,
    });
    const seams = rows.filter((r) => r.kind === "seam");
    expect(seams.length).toBe(3);
    for (const s of seams) {
      expect(s.stage).toBe("learn");
      expect(s.strengthPct).toBe(0);
    }
  });

  it("shows both sides of the junction in a seam's text cell", () => {
    // The seam's memory content IS the transition: showing only ayah `from`
    // would misrepresent what the learner is asked to produce.
    const rows = buildProgressRows({
      corpus: windowCorpus(4),
      atoms: atomsFixture(),
      events: [],
      now: NOW,
    });
    const seam = rows.find((r) => r.kind === "seam");
    expect(seam?.reference).toMatch(/^\d+:\d+→\d+$/);
    expect(seam?.text).toContain("·");
  });
});

// ---------------------------------------------------------------------------
// 5. TIME ON TASK — never wall-clock
// ---------------------------------------------------------------------------

describe("time on task (§15)", () => {
  it("sums kept latencies and excludes the interrupted one", () => {
    const events = eventsFixture();
    const ms = timeOnTaskMs(events, SURAH, "ayah", 1);
    // 1500 + 2500. The 900_000ms latency straddles a resumePolicy-discarded
    // interruption and must not be counted.
    expect(ms).toBe(4_000);
  });

  it("is NOT the wall-clock span — the two differ by 40 minutes, not by rounding", () => {
    const events = eventsFixture();
    const wallClock = events[events.length - 1]!.ts - events[0]!.ts;
    const onTask = timeOnTaskMs(events, SURAH, "ayah", 1);
    expect(onTask).not.toBe(wallClock);
    // The gap is enormous on purpose: a learner who took a call must not look
    // 600x slower than they were.
    expect(wallClock).toBeGreaterThan(onTask * 100);
  });

  it("renders a dash, never a zero, for an atom with no measured time", () => {
    const rows = buildProgressRows({
      corpus: windowCorpus(4),
      atoms: atomsFixture(),
      events: [],
      now: NOW,
    });
    for (const r of rows) expect(r.timeOnTask).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// 6. THE SOLE-RENDERER RULE — #87 / #95, asserted as a source scan
// ---------------------------------------------------------------------------

describe("stage and pill tokens have exactly one consumer each", () => {
  const walk = (dir: string): string[] => {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
      if (e === "node_modules") continue;
      const p = resolve(dir, e);
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (/\.tsx?$/.test(e)) out.push(p);
    }
    return out;
  };
  const strip = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const sources = () =>
    [...walk(resolve(WEB, "app")), ...walk(resolve(WEB, "components"))].filter(
      (f) => !f.endsWith(".test.tsx") && !f.endsWith(".test.ts"),
    );

  it("renders .stage-dot from StageBadge and nowhere else (#87)", () => {
    const offenders = sources().filter(
      (f) => /stage-dot/.test(strip(readFileSync(f, "utf8"))) && !f.endsWith("StageBadge.tsx"),
    );
    expect(offenders.map((f) => f.replace(WEB, ""))).toEqual([]);
  });
});
