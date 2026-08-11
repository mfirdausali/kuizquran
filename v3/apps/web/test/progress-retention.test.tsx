/**
 * @vitest-environment jsdom
 */

// RENDER TESTS for /progress — RETENTION MONITORING (WIREFRAME §10).
//
// ---------------------------------------------------------------------------
// WHAT THESE ASSERT, AND WHY EACH ONE IS THE OUTPUT AND NOT AN INGREDIENT
// ---------------------------------------------------------------------------
// §10's rule is that the numbers shown are the numbers the scheduler uses. So
// the assertions read the RENDERED TEXT a learner would see — "9.4 days",
// "3 items are slipping", "72% → 64% since Thursday" — rather than checking
// that some helper returned a plausible object. A test over the summary object
// alone would stay green while the panel printed none of it.
//
// THE ONE THAT MATTERS MOST — the slipping count. `currentBand()` can NEVER
// return "lapsed": `bandOf()` returns it only for `strength < 0`, and
// `update.ts` clamps every strength to [0,100]. An atom decayed for 20 days
// reports `currentBand === "learn"` at ~0.0000001%, not "lapsed". So a slipping
// counter written as `band === "lapsed"` is PERMANENTLY ZERO — true, green, and
// constraining nothing, which is this build's documented failure mode. The
// fixture below therefore builds atoms the SCHEDULER would queue for review and
// asserts they are reported as slipping; a band-based implementation fails it.
//
// Not one Arabic byte is typed here. The corpus arrives from the real fixture
// at packages/engine/test/fixtures/12.json and every atom is addressed by
// COORDINATE (surah 12, ayah n) — the sacred-text rule (check-boundaries.mjs
// clause 4) holding in the tests exactly as in the app.

import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";

import type { Corpus } from "@engine/types.ts";
import type { AtomState } from "@engine/atom.ts";
import { atomKey, initAtom } from "@engine/atom.ts";
import { currentBand, forgettingRisk } from "@engine/strength.ts";

import {
  buildRetentionSummary,
  REVIEW_RISK_THRESHOLD,
  type RetentionSummary,
} from "@/lib/progress/retention";
import { RetentionPanel } from "@/components/progress/RetentionPanel";

afterEach(cleanup);

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");
const corpus: Corpus = JSON.parse(
  readFileSync(resolve(WEB, "../../packages/engine/test/fixtures/12.json"), "utf8"),
);

const SURAH = corpus.meta.surah;
const NOW = Date.UTC(2026, 7, 11, 9, 0, 0);
const DAY = 86_400_000;
const WEEK_AGO = NOW - 7 * DAY;

/** A corpus narrowed to ayat [1..n] — the same helper progress-list.test.tsx
 *  uses. Slicing REAL data keeps every glyph runtime-sourced; nothing is
 *  authored here. */
function windowCorpus(n: number): Corpus {
  return {
    ...corpus,
    meta: { ...corpus.meta, ayahCount: n },
    verses: corpus.verses.filter((v) => v.ayah <= n),
    words: corpus.words.filter((w) => w.ayah <= n),
    distractors: corpus.distractors.filter((d) => d.ayah <= n),
  };
}

function put(
  atoms: Map<string, AtomState>,
  kind: "ayah" | "connection",
  ref: number,
  patch: Partial<AtomState>,
): void {
  atoms.set(atomKey(SURAH, kind, ref), { ...initAtom(SURAH, kind, ref), ...patch });
}

/**
 * A memory graph with a DELIBERATE, KNOWN band distribution.
 *
 * Over `windowCorpus(4)` there are 7 atoms (4 ayat + 3 joints). Of those:
 *   - 12:1 and 12:2 are freshly retrieved at high strength  -> Carrying  (2)
 *   - 12:3 is freshly retrieved mid-band                    -> Reinforcing (1)
 *   - the remaining 4 (12:4 and the three joints) are absent -> Not started (4)
 *
 * Every "fresh" atom is retrieved 60s before NOW so decay is negligible and the
 * band is the one the strength names — otherwise the fixture would be asserting
 * the decay curve rather than the distribution.
 */
function bandsFixture(): Map<string, AtomState> {
  const atoms = new Map<string, AtomState>();
  put(atoms, "ayah", 1, { strength: 92, stability: 12, lastRetrieval: NOW - 60_000, reps: 9, encoded: true });
  put(atoms, "ayah", 2, { strength: 85, stability: 10, lastRetrieval: NOW - 60_000, reps: 7, encoded: true });
  put(atoms, "ayah", 3, { strength: 61, stability: 4, lastRetrieval: NOW - 60_000, reps: 4, encoded: true });
  return atoms;
}

/**
 * Three atoms the SCHEDULER would queue for review, and two it would not.
 *
 * `scheduler.ts` step 3 queues an encoded, gate-passed atom when
 * `forgettingRisk * weight > 0.15`. These three are built to clear that bar by
 * having decayed well past their stability; the two "safe" atoms were retrieved
 * moments ago and sit far below it. The test asserts the engine agrees before
 * asserting the UI does — so if the threshold ever moves, this fails loudly
 * rather than silently measuring nothing.
 */
function slippingFixture(): Map<string, AtomState> {
  const atoms = new Map<string, AtomState>();
  // Slipping: encoded, retrieved long ago relative to stability.
  put(atoms, "ayah", 1, { strength: 90, stability: 2, lastRetrieval: NOW - 10 * DAY, reps: 6, encoded: true });
  put(atoms, "ayah", 2, { strength: 88, stability: 3, lastRetrieval: NOW - 12 * DAY, reps: 5, encoded: true });
  put(atoms, "ayah", 3, { strength: 75, stability: 2, lastRetrieval: NOW - 9 * DAY, reps: 4, encoded: true });
  // Safe: retrieved a minute ago.
  put(atoms, "ayah", 4, { strength: 95, stability: 20, lastRetrieval: NOW - 60_000, reps: 12, encoded: true });
  put(atoms, "ayah", 5, { strength: 90, stability: 18, lastRetrieval: NOW - 60_000, reps: 11, encoded: true });
  return atoms;
}

function summarize(
  atoms: Map<string, AtomState>,
  n: number,
  since = WEEK_AGO,
): RetentionSummary {
  return buildRetentionSummary({
    corpus: windowCorpus(n),
    atoms,
    events: [],
    now: NOW,
    since,
  });
}

// ---------------------------------------------------------------------------
// 1. THE HEADLINE IS HALF-LIFE (§10)
// ---------------------------------------------------------------------------

describe("half-life is the headline (§10)", () => {
  it("prints the median half-life of the encoded atoms, in days", () => {
    // stability x ln2: 12 -> 8.3d, 10 -> 6.9d, 4 -> 2.8d. Median = 6.9d.
    const summary = summarize(bandsFixture(), 4);
    render(<RetentionPanel summary={summary} />);
    expect(screen.getByText("6.9 days")).toBeTruthy();
  });

  it("moves when the underlying stability moves", () => {
    // The headline must TRACK the data. A hardcoded string passes the test
    // above and fails this one.
    const weaker = new Map<string, AtomState>();
    put(weaker, "ayah", 1, { strength: 90, stability: 3, lastRetrieval: NOW - 60_000, reps: 5, encoded: true });
    const summary = summarize(weaker, 4);
    // 3 x ln2 = 2.1d.
    expect(summary.headlineHalfLifeLabel).toBe("2.1 days");
    render(<RetentionPanel summary={summary} />);
    expect(screen.getByText("2.1 days")).toBeTruthy();
  });

  it("prints a dash, never '0 days', when nothing has been encoded", () => {
    // An unmeasured graph is not a graph that decays instantly. Same rule as
    // rows.ts's strengthLabel: unmeasured is "—", not zero.
    const summary = summarize(new Map(), 4);
    expect(summary.headlineHalfLifeLabel).toBe("—");
    expect(summary.unmeasured).toBe(true);
    const { container } = render(<RetentionPanel summary={summary} />);
    expect(container.textContent).not.toMatch(/0\.0 days/);
    expect(container.textContent).not.toMatch(/0 days/);
  });

  it("excludes unencoded atoms from the median rather than counting them as zero", () => {
    // windowCorpus(4) has 7 atoms but only 1 encoded. Including the 6 absent
    // ones would pin the median at 0 days on a learner's first week.
    const one = new Map<string, AtomState>();
    put(one, "ayah", 1, { strength: 90, stability: 12, lastRetrieval: NOW - 60_000, reps: 5, encoded: true });
    expect(summarize(one, 4).headlineHalfLifeLabel).toBe("8.3 days");
  });

  it("excludes an ENCODED but never-retrieved atom, whose half-life is 0 by definition", () => {
    // Found by a surviving mutation: dropping the `stability > 0` guard left
    // every test green. An atom encoded in this session but not yet retrieved
    // has stability 0, so halfLifeDays() returns 0 — a number that measures
    // nothing. Averaging it in drags the headline toward zero and reports
    // decay the scheduler does not believe in.
    const mixed = new Map<string, AtomState>();
    put(mixed, "ayah", 1, { strength: 90, stability: 12, lastRetrieval: NOW - 60_000, reps: 5, encoded: true });
    put(mixed, "ayah", 2, { strength: 90, stability: 12, lastRetrieval: NOW - 60_000, reps: 5, encoded: true });
    // Encoded, never retrieved: stability 0, lastRetrieval null.
    put(mixed, "ayah", 3, { strength: 20, stability: 0, lastRetrieval: null, reps: 0, encoded: true });
    // Median of the two REAL measurements is 8.3d. Median of [0, 8.3, 8.3]
    // would still be 8.3 — so a third measured atom is added to make the
    // difference visible: [0, 8.3, 8.3, 8.3] medians to 8.3, but [8.3 x3]
    // also medians to 8.3. Use a spread that separates the two answers.
    put(mixed, "ayah", 4, { strength: 90, stability: 4, lastRetrieval: NOW - 60_000, reps: 5, encoded: true });
    // Measured only: [2.8, 8.3, 8.3] -> median 8.3.
    // With the zero included: [0, 2.8, 8.3, 8.3] -> median 5.5.
    expect(summarize(mixed, 5).headlineHalfLifeLabel).toBe("8.3 days");
  });
});

// ---------------------------------------------------------------------------
// 2. HONEST SLIPPAGE — the band trap
// ---------------------------------------------------------------------------

describe("slippage is read from the scheduler's own signal, not from a band", () => {
  it("no atom in the slipping fixture is in the 'lapsed' band — the trap, stated", () => {
    // This documents WHY the count cannot be `band === "lapsed"`. If a future
    // engine change makes lapsed reachable, this test fails and whoever reads
    // it learns the constraint rather than inheriting a mystery.
    const atoms = slippingFixture();
    for (const atom of atoms.values()) {
      expect(currentBand(atom, NOW)).not.toBe("lapsed");
    }
  });

  it("the engine agrees these three are due for review", () => {
    // Asserted against the engine BEFORE the UI, so the fixture cannot drift
    // into measuring nothing if the threshold changes.
    const atoms = slippingFixture();
    const due = [...atoms.values()].filter(
      (a) => forgettingRisk(a, NOW) > REVIEW_RISK_THRESHOLD,
    );
    expect(due.length).toBe(3);
  });

  it("reports exactly those three as slipping, in words and a number", () => {
    const summary = summarize(slippingFixture(), 5);
    expect(summary.slippingCount).toBe(3);
    render(<RetentionPanel summary={summary} />);
    expect(screen.getByText(/3 ayat are slipping/)).toBeTruthy();
  });

  it("carries §10's reframe beside the count", () => {
    render(<RetentionPanel summary={summarize(slippingFixture(), 5)} />);
    expect(screen.getByText(/Not a failure — this is what memory does/)).toBeTruthy();
  });

  it("never counts an atom the learner has not reached", () => {
    // A 111-ayah surah on day one would otherwise report 221 items slipping.
    const summary = summarize(new Map(), 8);
    expect(summary.slippingCount).toBe(0);
    render(<RetentionPanel summary={summary} />);
    expect(screen.getByText(/Nothing is slipping/)).toBeTruthy();
  });

  it("drops the reassurance when there is nothing to reframe", () => {
    const summary = summarize(new Map(), 4);
    expect(summary.slippingReassurance).toBeNull();
    const { container } = render(<RetentionPanel summary={summary} />);
    expect(container.textContent).not.toMatch(/Not a failure/);
  });

  it("counts a recorded lapse even when the atom was just retrieved", () => {
    // `update.ts` increments `lapses` on a real miss. An atom reviewed minutes
    // ago has near-zero forgetting risk, so a risk-only rule would call it
    // healthy the moment after the learner got it wrong.
    const atoms = new Map<string, AtomState>();
    put(atoms, "ayah", 1, {
      strength: 55, stability: 6, lastRetrieval: NOW - 60_000, reps: 8, lapses: 2, encoded: true,
    });
    expect(forgettingRisk(atoms.get(atomKey(SURAH, "ayah", 1))!, NOW)).toBeLessThan(
      REVIEW_RISK_THRESHOLD,
    );
    expect(summarize(atoms, 4).slippingCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. THE BAND DISTRIBUTION — never colour alone (§15 / #87)
// ---------------------------------------------------------------------------

describe("the band distribution reads in words and numbers", () => {
  it("counts every atom of the graph, joints included (#90)", () => {
    // 4 ayat + 3 joints = 7. A distribution over ayat alone would total 4 and
    // would be a picture of 60% of the memory graph.
    const summary = summarize(bandsFixture(), 4);
    expect(summary.atomCount).toBe(7);
    expect(summary.bands.reduce((s, b) => s + b.count, 0)).toBe(7);
  });

  it("puts each atom in the band its strength names", () => {
    const byStage = new Map(summarize(bandsFixture(), 4).bands.map((b) => [b.stage, b.count]));
    expect(byStage.get("carry")).toBe(2);
    expect(byStage.get("reinforce")).toBe(1);
    expect(byStage.get("learn")).toBe(4); // 12:4 + three joints, untouched
  });

  it("renders every band with a WORD and a NUMBER, never a bar alone", () => {
    const { container } = render(<RetentionPanel summary={summarize(bandsFixture(), 4)} />);
    const rows = container.querySelectorAll(".dist-row");
    expect(rows.length).toBe(4);
    for (const row of Array.from(rows)) {
      // The word comes from StageBadge, which is the only .stage-dot renderer.
      expect(row.querySelector(".stage-label__name")?.textContent?.trim()).toBeTruthy();
      expect(row.querySelector(".stage-label__value")?.textContent?.trim()).toBeTruthy();
      expect(row.querySelector(".dist-count")?.textContent?.trim()).toBeTruthy();
    }
  });

  it("prints the counts a learner can check against the list", () => {
    render(<RetentionPanel summary={summarize(bandsFixture(), 4)} />);
    expect(screen.getByText("2 of 7")).toBeTruthy(); // carrying
    expect(screen.getByText("1 of 7")).toBeTruthy(); // reinforcing
    expect(screen.getByText("4 of 7")).toBeTruthy(); // not started
  });

  it("hides the decorative bar from the accessibility tree", () => {
    const { container } = render(<RetentionPanel summary={summarize(bandsFixture(), 4)} />);
    const bars = container.querySelectorAll(".dist-bar");
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of Array.from(bars)) {
      expect(bar.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("says 'Not started' rather than 'Learning' for a graph nobody has touched", () => {
    const summary = summarize(new Map(), 4);
    const learn = summary.bands.find((b) => b.stage === "learn");
    expect(learn?.label).toBe("Not started");
    expect(learn?.count).toBe(7);
  });

  it("draws the bar from the DATA, not from a fixed scale", () => {
    // The locked `.bands` component has hardcoded 40/40/20 widths. If the panel
    // ever renders through it, these widths stop tracking the learner.
    const { container } = render(<RetentionPanel summary={summarize(bandsFixture(), 4)} />);
    const widths = Array.from(container.querySelectorAll<HTMLElement>(".dist-bar__fill")).map(
      (el) => el.style.width,
    );
    // 2/7 = 29%, 1/7 = 14%, 4/7 = 57%, 0/7 = 0%.
    expect(widths).toContain("29%");
    expect(widths).toContain("14%");
    expect(widths).toContain("57%");
  });
});

// ---------------------------------------------------------------------------
// 4. DECAY MADE VISIBLE — §10's own sentence
// ---------------------------------------------------------------------------

describe("decay is visible on items that moved (§10)", () => {
  /** One atom that has genuinely declined over the week, so there is a real
   *  "from -> to" to print rather than a manufactured one. */
  function decayed(): Map<string, AtomState> {
    const atoms = new Map<string, AtomState>();
    put(atoms, "ayah", 1, {
      strength: 90, stability: 8, lastRetrieval: NOW - 14 * DAY, reps: 6, encoded: true,
    });
    return atoms;
  }

  it("prints 'X% → Y% since <when>' for an item that declined", () => {
    const summary = summarize(decayed(), 4);
    expect(summary.decayRows.length).toBe(1);
    render(<RetentionPanel summary={summary} />);
    expect(screen.getByText(/^\d+% → \d+% since /)).toBeTruthy();
  });

  it("shows a real DROP — the later number is the smaller one", () => {
    const row = summarize(decayed(), 4).decayRows[0]!;
    const from = Number(row.fromLabel.replace("%", ""));
    const to = Number(row.toLabel.replace("%", ""));
    expect(to).toBeLessThan(from);
  });

  it("reads left-to-right as a DECLINE in the rendered sentence", () => {
    // Found by a surviving mutation: swapping the two numbers inside the
    // assembled sentence left every test green, because the assertions above
    // read the fromLabel/toLabel FIELDS rather than the string a learner sees.
    // "64% → 72% since Thursday" reports improvement on a panel about decay —
    // a §10 honesty violation that renders perfectly. Assert the OUTPUT.
    render(<RetentionPanel summary={summarize(decayed(), 4)} />);
    const sentence = screen.getByText(/% → .*% since /).textContent ?? "";
    const [first, second] = [...sentence.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(second!).toBeLessThan(first!);
  });

  it("omits items that did not decline rather than printing a flat line", () => {
    // A freshly retrieved atom has nothing to report; "72% → 72%" is noise
    // under a heading about decay.
    const fresh = new Map<string, AtomState>();
    put(fresh, "ayah", 1, { strength: 90, stability: 20, lastRetrieval: NOW - 60_000, reps: 5, encoded: true });
    expect(summarize(fresh, 4).decayRows.length).toBe(0);
  });

  it("labels the reference and its kind, so a joint is not mistaken for an ayah", () => {
    const atoms = decayed();
    put(atoms, "connection", 2, {
      strength: 85, stability: 6, lastRetrieval: NOW - 14 * DAY, reps: 4, encoded: true,
    });
    const summary = summarize(atoms, 4);
    const joint = summary.decayRows.find((r) => r.kindLabel === "Joint");
    expect(joint).toBeTruthy();
    expect(joint?.reference).toMatch(/^\d+:\d+→\d+$/);
    render(<RetentionPanel summary={summary} />);
    expect(screen.getByText("Joint")).toBeTruthy();
  });

  it("puts the biggest drop first", () => {
    const atoms = new Map<string, AtomState>();
    // A small drop and a large one, deliberately inserted small-first.
    put(atoms, "ayah", 1, { strength: 90, stability: 40, lastRetrieval: NOW - 8 * DAY, reps: 5, encoded: true });
    put(atoms, "ayah", 2, { strength: 90, stability: 3, lastRetrieval: NOW - 8 * DAY, reps: 5, encoded: true });
    const rows = summarize(atoms, 4).decayRows;
    expect(rows.length).toBe(2);
    expect(rows[0]!.reference).toBe(`${SURAH}:2`);
  });
});

// ---------------------------------------------------------------------------
// 5. THE ROUTE'S OWN STRUCTURE
// ---------------------------------------------------------------------------

describe("the /progress route (edge cases #72 / #73)", () => {
  const read = (rel: string) => readFileSync(resolve(WEB, rel), "utf8");
  const strip = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("is a server component that never reads the log itself", () => {
    // A fold in page.tsx would SSR zeros that React keeps in production — a
    // clean board over a lapsing learner.
    const page = strip(read("app/(app)/progress/page.tsx"));
    expect(page).not.toMatch(/from\s+["'][^"']*lib\/idb/);
    expect(page).not.toMatch(/\brebuild\s*\(/);
    expect(page).toMatch(/RetentionIsland/);
  });

  it("resolves the clock once, on the server", () => {
    const page = strip(read("app/(app)/progress/page.tsx"));
    expect(page.match(/Date\.now\(\)/g)?.length).toBe(1);
  });

  it("declares the island a client module in its first five lines", () => {
    // isClient() only reads the first five lines, so a licence header above the
    // directive would silently defeat the gate and #72 would bite in production.
    const island = read("components/progress/RetentionIsland.tsx");
    expect(island.split("\n").slice(0, 5).join("\n")).toMatch(/^\s*"use client"/m);
  });

  it("handles all four log states explicitly", () => {
    const island = strip(read("components/progress/RetentionIsland.tsx"));
    for (const status of ["pending", "empty", "ready", "broken"]) {
      expect(island, `case "${status}" missing`).toMatch(new RegExp(`case "${status}":`));
    }
    // Skeletons are never zeros: the pending branch paints .skel, not a digit.
    expect(island).toMatch(/className="skel"/);
  });

  it("keeps the link to the full list — the ring's text alternative (§15)", () => {
    expect(read("app/(app)/progress/page.tsx")).toMatch(/href="\/progress\/list"/);
  });

  it("keeps exactly one .voice line (locked file §8 rule 3)", () => {
    const page = read("app/(app)/progress/page.tsx");
    expect(page.match(/className="voice"/g)?.length).toBe(1);
  });

  it("makes no engine DECISION in the panel — it prints what it is handed", () => {
    const panel = strip(read("components/progress/RetentionPanel.tsx"));
    // No thresholds, no band tests, no arithmetic on strengths.
    expect(panel).not.toMatch(/\bstage\s*===/);
    expect(panel).not.toMatch(/strength\s*[<>]/);
    expect(panel).not.toMatch(/\bfilter\s*\(/);
  });

  it("renders .stage-dot only through StageBadge (#87)", () => {
    // The distribution is the most tempting place in the app to hand-roll four
    // coloured dots. progress-list.test.tsx owns the repo-wide scan; this
    // asserts the specific file most likely to break it.
    const panel = strip(read("components/progress/RetentionPanel.tsx"));
    expect(panel).not.toMatch(/stage-dot/);
    expect(panel).toMatch(/StageBadge/);
  });
});
