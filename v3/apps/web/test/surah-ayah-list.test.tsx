/**
 * @vitest-environment jsdom
 */

// THE AYAT LIST on /surah/[surah] (WIREFRAME §3).
//
// Before this fix, the page hardcoded exactly one row — "Ayah 1" — regardless
// of which surah was open or how many ayat it has, which is a real,
// currently-reachable defect: this route is linked from the dashboard's
// "MY SURAHS" list and the library. `lib/progress/rows.ts#rowAtomKey`'s own
// docblock already named the intended caller ("Exported for the surah page's
// own use") that never existed.
//
// These tests drive the exported `SurahAyahListView` — the pure state→view
// mapping, same split as `AyahStatsIsland.tsx#AyahStatsView` — with each
// `LogState` directly, so they see exactly what a learner would see without
// touching real IndexedDB.
//
// Not one Arabic byte is typed here: every glyph is addressed by coordinate
// against a real corpus fixture, loaded at runtime (check-boundaries.mjs
// clause 4).

import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";

import type { Corpus, DrillEvent } from "@engine/types.ts";
import type { AtomState } from "@engine/atom.ts";
import { atomKey, initAtom } from "@engine/atom.ts";

import { SurahAyahListView } from "@/components/surah/SurahAyahListIsland";
import type { LogState } from "@/lib/idb";

afterEach(cleanup);

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");
const corpus: Corpus = JSON.parse(
  readFileSync(resolve(WEB, "../../packages/engine/test/fixtures/12.json"), "utf8"),
);
const SURAH = corpus.meta.surah;

/** A corpus narrowed to ayat [1..n] — real Arabic, just windowed, matching
 *  `progress-list.test.tsx`'s own convention. */
function windowCorpus(n: number): Corpus {
  return {
    ...corpus,
    meta: { ...corpus.meta, ayahCount: n },
    verses: corpus.verses.filter((v) => v.ayah <= n),
    words: corpus.words.filter((w) => w.ayah <= n),
    distractors: corpus.distractors.filter((d) => d.ayah <= n),
  };
}

const NOW = Date.UTC(2026, 7, 26, 9, 0, 0);

function readyState(events: DrillEvent[]): LogState<DrillEvent[]> {
  return { status: "ready", data: events };
}
function pendingState(): LogState<DrillEvent[]> {
  return { status: "pending" };
}
function emptyState(): LogState<DrillEvent[]> {
  return { status: "empty" };
}
function brokenState(reason: string): LogState<DrillEvent[]> {
  return { status: "broken", reason: reason as never };
}

describe("the surah page lists every ayah, not a hardcoded one (§3)", () => {
  it.each([1, 4, 7, 10])("renders exactly N rows for N=%i ayat, never a fixed count", (n) => {
    render(<SurahAyahListView state={emptyState()} corpus={windowCorpus(n)} now={NOW} />);
    const nav = screen.getByRole("navigation", { name: `Ayat of surah ${SURAH}` });
    const links = nav.querySelectorAll("a");
    expect(links.length).toBe(n);
  });

  it("links every row to its own ayah's detail route", () => {
    render(<SurahAyahListView state={emptyState()} corpus={windowCorpus(5)} now={NOW} />);
    for (let ayah = 1; ayah <= 5; ayah++) {
      const link = screen.getByRole("link", { name: new RegExp(`Ayah ${ayah}\\b`) });
      expect(link.getAttribute("href")).toBe(`/surah/${SURAH}/${ayah}`);
    }
  });
});

describe("real per-ayah stage/strength, not a hardcoded 'Not started' (edge case #72)", () => {
  it("reads a carried ayah's real stage and strength, not the default", () => {
    const atoms = new Map<string, AtomState>();
    atoms.set(
      atomKey(SURAH, "ayah", 3),
      { ...initAtom(SURAH, "ayah", 3), strength: 92, stability: 12, lastRetrieval: NOW - 60_000, reps: 9, encoded: true },
    );
    // Build a log that actually produces this atom state through the real
    // fold, so the test proves the WIRING (log -> rows -> paint), not a
    // fixture shortcut.
    const events: DrillEvent[] = Array.from({ length: 9 }, (_, i) => ({
      surah: SURAH,
      ayah: 3,
      ts: NOW - (9 - i) * 86_400_000,
      type: "ayah_produced" as const,
      rung: "S3" as const,
      correct: true,
    }));

    render(<SurahAyahListView state={readyState(events)} corpus={windowCorpus(4)} now={NOW} />);

    const link = screen.getByRole("link", { name: /Ayah 3\b/ });
    // Every stage cell carries a text label AND a number (#87) — never just a
    // dot, and never the hardcoded "Not started" the old stub always showed.
    expect(link.textContent).not.toMatch(/Not started/);
    expect(link.querySelector(".stage-dot")).toBeTruthy();
    expect(link.querySelector(".stage-label__name")?.textContent?.trim()).toBeTruthy();
    expect(link.querySelector(".stage-label__value")?.textContent?.trim()).toBeTruthy();
  });

  it("shows every untouched ayah as honestly 'Not started', not silently omitted", () => {
    render(<SurahAyahListView state={emptyState()} corpus={windowCorpus(3)} now={NOW} />);
    const nav = screen.getByRole("navigation", { name: `Ayat of surah ${SURAH}` });
    expect(nav.querySelectorAll("a").length).toBe(3);
    for (const link of Array.from(nav.querySelectorAll("a"))) {
      expect(link.textContent).toMatch(/Not started/);
    }
  });
});

describe("three states, exhaustively (#73)", () => {
  it("paints skeletons while pending — never a zero-ayah list", () => {
    const { container } = render(
      <SurahAyahListView state={pendingState()} corpus={windowCorpus(4)} now={NOW} />,
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("says so, and names the reason, when the log is broken — never a silent empty state", () => {
    render(<SurahAyahListView state={brokenState("open-failed")} corpus={windowCorpus(4)} now={NOW} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("open-failed")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
