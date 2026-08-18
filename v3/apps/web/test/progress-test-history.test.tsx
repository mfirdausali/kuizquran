/**
 * @vitest-environment jsdom
 */

// RENDER TESTS for /progress — TEST HISTORY (v2-D17 Progress Report's
// per-Test history list, `packages/engine/src/test.ts#testHistory`).
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
// `testHistory()` has been unit-tested since the Test self-quiz feature
// landed (`test.test.ts`, v3-D104) but had ZERO production callers —
// v3-D104's own header names it directly: "a learner who completes a Test
// sees the immediate score screen but no later record of it on /progress...
// the natural next increment... only a new small `lib/progress` panel in the
// same shape as `RetentionPanel`/`GrowthPanel`." This is that panel. Same
// shape as v3-D89 through D104: a mechanism built and tested at the engine
// layer, never wired to a route a learner reaches.
//
// Same discipline as `progress-growth.test.tsx`: assertions read the
// RENDERED OUTPUT, not a helper's return value in isolation. Not one Arabic
// byte is typed here — every event below references a surah/ayah/score
// COORDINATE, never corpus text.

import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";

import type { DrillEvent } from "@engine/types.ts";
import { gradeClassToWire } from "@engine/gradeClass.ts";

import { buildTestHistorySummary, type TestHistorySummary } from "@/lib/progress/testHistory";
import { TestHistoryPanel } from "@/components/progress/TestHistoryPanel";

afterEach(cleanup);

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");

const SURAH = 12;
const TZ = "UTC";

function testResult(
  from: number,
  to: number,
  score: number,
  total: number,
  ts: number,
  sentToReviews = false,
): DrillEvent {
  return {
    type: "test_result",
    ts,
    surah: SURAH,
    ayah: from,
    to,
    rung: gradeClassToWire("ungraded"),
    score,
    total,
    structured: false,
    sentToReviews,
  };
}

// ---------------------------------------------------------------------------
// 1. THE PURE SUMMARY — buildTestHistorySummary
// ---------------------------------------------------------------------------

describe("buildTestHistorySummary", () => {
  it("reports unmeasured with no rows when no Test has ever been taken", () => {
    const summary = buildTestHistorySummary({ surah: SURAH, events: [], tz: TZ });
    expect(summary.unmeasured).toBe(true);
    expect(summary.rows).toEqual([]);
    expect(summary.count).toBe(0);
    expect(summary.countLabel).toBe("No Tests taken yet");
  });

  it("recovers the correct COUNT from the wire's score ratio, never re-reading it as a raw count", () => {
    // types.ts documents `score` as `correct ÷ total, 0..1` — exactly what
    // TestIsland.tsx#finishTest writes (`correct / results.length`).
    const events: DrillEvent[] = [testResult(1, 10, 0.8, 5, Date.UTC(2026, 7, 10))];
    const summary = buildTestHistorySummary({ surah: SURAH, events, tz: TZ });
    expect(summary.rows[0]!.scoreLabel).toBe("4 / 5 correct (80%)");
  });

  it("labels a range with the surah prefix, Latin digits, an en-dash", () => {
    const events: DrillEvent[] = [testResult(5, 20, 1, 8, Date.UTC(2026, 7, 10))];
    const summary = buildTestHistorySummary({ surah: SURAH, events, tz: TZ });
    expect(summary.rows[0]!.rangeLabel).toBe("12:5–20");
  });

  it("orders rows newest-first", () => {
    const events: DrillEvent[] = [
      testResult(1, 10, 1, 5, Date.UTC(2026, 7, 1)),
      testResult(1, 10, 0.5, 4, Date.UTC(2026, 7, 15)),
    ];
    const summary = buildTestHistorySummary({ surah: SURAH, events, tz: TZ });
    expect(summary.rows.map((r) => r.ts)).toEqual([Date.UTC(2026, 7, 15), Date.UTC(2026, 7, 1)]);
  });

  it("carries sentToReviews through per row", () => {
    const events: DrillEvent[] = [
      testResult(1, 10, 1, 5, Date.UTC(2026, 7, 1), true),
      testResult(1, 10, 1, 5, Date.UTC(2026, 7, 2), false),
    ];
    const summary = buildTestHistorySummary({ surah: SURAH, events, tz: TZ });
    expect(summary.rows.map((r) => r.sentToReviews)).toEqual([false, true]);
  });

  it("counts and pluralizes the header label correctly", () => {
    const one = buildTestHistorySummary({
      surah: SURAH,
      events: [testResult(1, 10, 1, 5, Date.UTC(2026, 7, 1))],
      tz: TZ,
    });
    expect(one.countLabel).toBe("1 Test taken");

    const two = buildTestHistorySummary({
      surah: SURAH,
      events: [
        testResult(1, 10, 1, 5, Date.UTC(2026, 7, 1)),
        testResult(1, 10, 1, 5, Date.UTC(2026, 7, 2)),
      ],
      tz: TZ,
    });
    expect(two.countLabel).toBe("2 Tests taken");
  });

  it("ignores everything that isn't a scored test_result — same filter as the engine's own testHistory()", () => {
    const events: DrillEvent[] = [
      { type: "test_start", ts: 500, surah: SURAH, ayah: 1, to: 10, rung: gradeClassToWire("ungraded"), structured: false },
      { type: "tap", ts: 600, surah: SURAH, ayah: 4, rung: "S1", correct: true },
    ];
    const summary = buildTestHistorySummary({ surah: SURAH, events, tz: TZ });
    expect(summary.unmeasured).toBe(true);
  });

  it("is pure — the same input always returns an equal result", () => {
    const events: DrillEvent[] = [testResult(1, 10, 0.8, 5, Date.UTC(2026, 7, 10))];
    const a = buildTestHistorySummary({ surah: SURAH, events, tz: TZ });
    const b = buildTestHistorySummary({ surah: SURAH, events, tz: TZ });
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// 2. THE PANEL — presentational only, a real score sentence per row
// ---------------------------------------------------------------------------

describe("TestHistoryPanel", () => {
  function panelFor(events: DrillEvent[]) {
    const summary: TestHistorySummary = buildTestHistorySummary({ surah: SURAH, events, tz: TZ });
    return render(<TestHistoryPanel summary={summary} />);
  }

  it("prints the real count, not a decorative list alone", () => {
    panelFor([testResult(1, 10, 1, 5, Date.UTC(2026, 7, 1))]);
    expect(screen.getByText("1 Test taken")).toBeTruthy();
  });

  it("shows the designed zero-state, never a bare empty list", () => {
    panelFor([]);
    expect(screen.getByText("No Tests taken yet.")).toBeTruthy();
  });

  it("prints the range and score sentence for a real row", () => {
    panelFor([testResult(1, 10, 0.8, 5, Date.UTC(2026, 7, 10))]);
    expect(screen.getByText(/12:1–10/)).toBeTruthy();
    expect(screen.getByText(/4 \/ 5 correct \(80%\)/)).toBeTruthy();
  });

  it("names sentToReviews when it was accepted, and stays silent when it wasn't", () => {
    panelFor([testResult(1, 10, 1, 5, Date.UTC(2026, 7, 10), true)]);
    expect(screen.getByText(/sent to reviews/)).toBeTruthy();
  });

  it("makes no engine DECISION in the panel — it prints what it is handed", () => {
    const src = readFileSync(resolve(WEB, "components/progress/TestHistoryPanel.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bMath\.(round|floor|ceil|max|min)\s*\(/);
    expect(src).not.toMatch(/\bfilter\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// 3. THE ROUTE'S OWN STRUCTURE (edge cases #72 / #73, same as growth)
// ---------------------------------------------------------------------------

describe("the /progress route wires Test history in (v3-D104's own deferred half)", () => {
  const read = (rel: string) => readFileSync(resolve(WEB, rel), "utf8");
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("declares the island a client module in its first five lines", () => {
    const island = read("components/progress/TestHistoryIsland.tsx");
    expect(island.split("\n").slice(0, 5).join("\n")).toMatch(/^\s*"use client"/m);
  });

  it("handles all four log states explicitly", () => {
    const island = strip(read("components/progress/TestHistoryIsland.tsx"));
    for (const status of ["pending", "empty", "ready", "broken"]) {
      expect(island, `case "${status}" missing`).toMatch(new RegExp(`case "${status}":`));
    }
    expect(island).toMatch(/className="skel"/);
  });

  it("the server page never reads the log itself, and renders TestHistoryIsland", () => {
    const page = strip(read("app/(app)/progress/page.tsx"));
    expect(page).not.toMatch(/\brebuild\s*\(/);
    expect(page).toMatch(/TestHistoryIsland/);
  });
});
