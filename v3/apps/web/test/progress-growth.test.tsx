/**
 * @vitest-environment jsdom
 */

// RENDER TESTS for /progress — GROWTH (v2-D17/D20's Progress Report growth
// curve, `packages/engine/src/heatmap.ts#growthCurve`).
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
// `growthCurve()` has been unit-tested since the heatmap landed
// (`habit.test.ts`) but had ZERO production callers — v3-D102's sweep found
// it and deliberately left it for a future run, scoped exactly as: "needs an
// actual chart/sparkline on /progress — a genuinely new rendering surface."
// This is that surface. Same shape as v3-D89 through D102: a mechanism built
// and tested at the engine layer, never wired to a route a learner reaches.
//
// Same discipline as `progress-retention.test.tsx`: assertions read the
// RENDERED OUTPUT (numbers and accessible text a learner/screen-reader would
// get), not a helper's return value in isolation. Not one Arabic byte is
// typed here — every event below references a surah/ayah COORDINATE, never
// corpus text.

import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";

import type { DrillEvent } from "@engine/types.ts";
import { learningDayIndex } from "@engine/daybound.ts";

import { buildGrowthSummary, type GrowthSummary } from "@/lib/progress/growth";
import { GrowthPanel } from "@/components/progress/GrowthPanel";

afterEach(cleanup);

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");

const SURAH = 12;
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 11, 9, 0, 0);

function dayMs(n: number): number {
  return n * DAY;
}

function encode(ayah: number, ts: number, structured = true): DrillEvent {
  return { type: "ayah_produced", ts, surah: SURAH, ayah, rung: "S3", structured };
}

// ---------------------------------------------------------------------------
// 1. THE PURE SUMMARY — buildGrowthSummary
// ---------------------------------------------------------------------------

describe("buildGrowthSummary", () => {
  it("reports unmeasured with no bars when nothing has been encoded", () => {
    const summary = buildGrowthSummary({ surah: SURAH, events: [] });
    expect(summary.unmeasured).toBe(true);
    expect(summary.points).toEqual([]);
    expect(summary.encodedCount).toBe(0);
    expect(summary.encodedLabel).toBe("Nothing encoded yet");
  });

  it("carries the real cumulative count and total, one point per learning-day", () => {
    const events: DrillEvent[] = [
      encode(1, dayMs(10)),
      encode(2, dayMs(10) + 500), // same learning-day as the first
      encode(3, dayMs(12)),
    ];
    const summary = buildGrowthSummary({ surah: SURAH, events });
    expect(summary.unmeasured).toBe(false);
    expect(summary.encodedCount).toBe(3);
    expect(summary.encodedLabel).toBe("3 encoded");
    expect(summary.points).toHaveLength(2);
    expect(summary.points[0]!.cumulativeEncoded).toBe(2);
    expect(summary.points[1]!.cumulativeEncoded).toBe(3);
  });

  it("numbers points 1-based, chronologically, regardless of the raw learning-day index", () => {
    // The raw learningDayIndex is a large, meaningless integer to a learner —
    // the point's ORDINAL is what a caption should read.
    const events: DrillEvent[] = [encode(1, dayMs(500)), encode(2, dayMs(505))];
    const summary = buildGrowthSummary({ surah: SURAH, events });
    expect(summary.points.map((p) => p.ordinal)).toEqual([1, 2]);
    expect(summary.points[0]!.day).toBe(learningDayIndex(dayMs(500)));
    expect(summary.points[1]!.day).toBe(learningDayIndex(dayMs(505)));
  });

  it("scales bar height off the curve's OWN max, never a fixed scale", () => {
    const events: DrillEvent[] = [encode(1, dayMs(1)), encode(2, dayMs(2)), encode(3, dayMs(3)), encode(4, dayMs(4))];
    const summary = buildGrowthSummary({ surah: SURAH, events });
    // cumulative: 1, 2, 3, 4 — max is 4, so heights are 25/50/75/100%.
    expect(summary.points.map((p) => p.heightPct)).toEqual([25, 50, 75, 100]);
  });

  it("floors a nonzero bar's height so it is never visually invisible", () => {
    // One huge day dwarfing a tiny first day must not round the first bar to 0%.
    const events: DrillEvent[] = [
      encode(1, dayMs(1)),
      ...Array.from({ length: 99 }, (_, i) => encode(i + 2, dayMs(2))),
    ];
    const summary = buildGrowthSummary({ surah: SURAH, events });
    expect(summary.points[0]!.heightPct).toBeGreaterThan(0);
  });

  it("gives every point a real, checkable accessible label", () => {
    const events: DrillEvent[] = [encode(1, dayMs(10)), encode(2, dayMs(12))];
    const summary = buildGrowthSummary({ surah: SURAH, events });
    expect(summary.points[0]!.label).toMatch(/^1 encoded by day 1$/);
    expect(summary.points[1]!.label).toMatch(/^2 encoded by day 2$/);
  });

  it("never counts a free-play production — invariant #5", () => {
    // growthCurve() itself already enforces this (habit.test.ts); this test
    // pins that the wiring here does not add its own second implementation
    // that could drift from it.
    const events: DrillEvent[] = [encode(1, dayMs(10), false)];
    const summary = buildGrowthSummary({ surah: SURAH, events });
    expect(summary.unmeasured).toBe(true);
  });

  it("is pure — the same input always returns an equal result", () => {
    const events: DrillEvent[] = [encode(1, dayMs(10)), encode(2, dayMs(11))];
    const a = buildGrowthSummary({ surah: SURAH, events });
    const b = buildGrowthSummary({ surah: SURAH, events });
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// 2. THE PANEL — presentational only, real text alongside every bar
// ---------------------------------------------------------------------------

describe("GrowthPanel", () => {
  function panelFor(events: DrillEvent[]) {
    const summary: GrowthSummary = buildGrowthSummary({ surah: SURAH, events });
    return render(<GrowthPanel summary={summary} />);
  }

  it("prints the real total, not a decorative chart alone", () => {
    panelFor([encode(1, dayMs(1)), encode(2, dayMs(2))]);
    expect(screen.getByText("2 encoded")).toBeTruthy();
  });

  it("shows the designed zero-state, never a bare empty chart", () => {
    panelFor([]);
    expect(screen.getByText(/No ayat encoded yet/)).toBeTruthy();
    expect(screen.getByText("Nothing encoded yet")).toBeTruthy();
  });

  it("hides the decorative bars from the accessibility tree", () => {
    const { container } = panelFor([encode(1, dayMs(1)), encode(2, dayMs(2))]);
    const bars = container.querySelectorAll(".growth-bar");
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of Array.from(bars)) {
      expect(bar.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("carries a real, checkable text label for every bar (never colour/shape alone)", () => {
    const { container } = panelFor([encode(1, dayMs(1)), encode(2, dayMs(2))]);
    const labels = Array.from(container.querySelectorAll(".growth-bar-row__label")).map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(["1 encoded by day 1", "2 encoded by day 2"]);
  });

  it("draws bar height from the data, not a fixed scale", () => {
    const { container } = panelFor([encode(1, dayMs(1)), encode(2, dayMs(2)), encode(3, dayMs(3))]);
    const heights = Array.from(container.querySelectorAll<HTMLElement>(".growth-bar")).map(
      (el) => el.style.height,
    );
    expect(heights).toEqual(["33%", "67%", "100%"]);
  });

  it("makes no engine DECISION in the panel — it prints what it is handed", () => {
    const src = readFileSync(resolve(WEB, "components/progress/GrowthPanel.tsx"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    ).replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bMath\.(round|floor|ceil|max|min)\s*\(/);
    expect(src).not.toMatch(/\bfilter\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// 3. THE ROUTE'S OWN STRUCTURE (edge cases #72 / #73, same as retention)
// ---------------------------------------------------------------------------

describe("the /progress route wires Growth in (v3-D102's deferred half)", () => {
  const read = (rel: string) => readFileSync(resolve(WEB, rel), "utf8");
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("declares the island a client module in its first five lines", () => {
    const island = read("components/progress/GrowthIsland.tsx");
    expect(island.split("\n").slice(0, 5).join("\n")).toMatch(/^\s*"use client"/m);
  });

  it("handles all four log states explicitly", () => {
    const island = strip(read("components/progress/GrowthIsland.tsx"));
    for (const status of ["pending", "empty", "ready", "broken"]) {
      expect(island, `case "${status}" missing`).toMatch(new RegExp(`case "${status}":`));
    }
    expect(island).toMatch(/className="skel"/);
  });

  it("the server page never reads the log itself, and renders GrowthIsland", () => {
    const page = strip(read("app/(app)/progress/page.tsx"));
    expect(page).not.toMatch(/\brebuild\s*\(/);
    expect(page).toMatch(/GrowthIsland/);
  });
});
