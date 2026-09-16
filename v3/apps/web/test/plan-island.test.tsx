/**
 * @vitest-environment jsdom
 */

// PlanIsland wires the "mark a day away" write path end to end (v3-D207).
// `lib/plan/forecast.ts` has read an `awayDays: number[]` input since it was
// built (WIREFRAME §14 "Planned absences"), but the read side had no real
// producer and the write side (a new event type, an outbox row) did not
// exist at all (DECISIONS.md v3-D190). This proves both halves are now real,
// through the ACTUAL component a learner sees — not just the pure functions
// underneath it.

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Corpus } from "@engine/types.ts";
import { dayIndexOf } from "@engine/awayDays.ts";
import { DB_NAME, openDb, resetDbForTests, writeLock } from "@/lib/idb";
import { setDayAway } from "@/lib/plan/awayDay";
import { PlanIsland } from "@/components/plan/PlanIsland";

afterEach(cleanup);

const HERE = dirname(fileURLToPath(import.meta.url));
const SURAH = 112;
const STAGED = resolve(HERE, `../public/corpus/${SURAH}.json`);
const COMPILED = resolve(HERE, `../../../packages/corpus-compiler/output/${SURAH}/corpus.json`);

let corpus: Corpus;

beforeAll(() => {
  const path = existsSync(STAGED) ? STAGED : COMPILED;
  if (!existsSync(path)) {
    throw new Error(
      `No corpus for surah ${SURAH}. Run \`make compile-corpus\` — this test ` +
        `runs against the real corpus on purpose.`,
    );
  }
  corpus = JSON.parse(readFileSync(path, "utf8")) as Corpus;
});

const NOW = Date.UTC(2026, 8, 12, 9, 0, 0);
const TZ = "UTC";
const TODAY = dayIndexOf(NOW);

beforeEach(async () => {
  try {
    const db = await openDb();
    db.close();
  } catch {
    // No database yet on the first test.
  }
  resetDbForTests();
  await new Promise<void>((done) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => done();
    req.onerror = () => done();
    req.onblocked = () => done();
  });
  writeLock.resetForTests();
  writeLock.forceForTests({ role: "writer" });
});

async function renderReady() {
  render(<PlanIsland corpus={corpus} now={NOW} tz={TZ} minutesPerDay={8} />);
  await waitFor(() => expect(screen.queryByText(/working out your plan/i)).toBeNull());
}

describe("PlanIsland — the plan calendar's own log", () => {
  it("renders a future day already marked away in the log, before any interaction", async () => {
    await setDayAway(SURAH, TODAY + 2, true, { now: NOW, tz: TZ });
    await renderReady();
    expect(document.querySelector('[data-day-row][data-offset="2"][data-away="true"]')).toBeTruthy();
  });

  it("marks a day away by clicking the control, and the log actually carries it", async () => {
    // A harmless past-day toggle just to reach the "ready" state (a log with
    // zero events shows the honest zero-state instead of a forecast — this
    // test is about the away-day wiring, not the zero-state).
    await setDayAway(SURAH, TODAY - 100, true, { now: NOW, tz: TZ });
    await renderReady();

    expect(document.querySelector('[data-day-row][data-offset="2"][data-away="true"]')).toBeNull();
    const row = document.querySelector('[data-day-row][data-offset="2"]') as HTMLElement;
    const btn = within(row).getByRole("button", { name: /mark.*away/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(document.querySelector('[data-day-row][data-offset="2"][data-away="true"]')).toBeTruthy();
    });
  });

  it("un-marks a day by clicking the control again — a new event, not an edit in place", async () => {
    await setDayAway(SURAH, TODAY + 2, true, { now: NOW, tz: TZ });
    await renderReady();
    await waitFor(() => {
      expect(document.querySelector('[data-day-row][data-offset="2"][data-away="true"]')).toBeTruthy();
    });

    const away = document.querySelector('[data-day-row][data-offset="2"]') as HTMLElement;
    const btn = within(away).getByRole("button", { name: /unmark|back/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(document.querySelector('[data-day-row][data-offset="2"][data-away="true"]')).toBeNull();
    });
  });
});

describe("PlanIsland — marking a day away before any session exists (v3-D220)", () => {
  // HANDOVER.md/DECISIONS.md v3-D207's own closing note: "the 'empty' log
  // zero-state still shows no calendar at all, so a learner who has not yet
  // completed a first session cannot pre-mark a future travel date away."
  // These prove the fix without ever fabricating a forecast from zero
  // events — no item, no load, no zone, only the toggle itself.

  it("still shows the honest zero-state sentence — this is not a forecast", async () => {
    render(<PlanIsland corpus={corpus} now={NOW} tz={TZ} minutesPerDay={8} />);
    await waitFor(() => expect(screen.queryByText(/working out your plan/i)).toBeNull());
    expect(screen.getByText(/nothing recorded yet/i)).toBeTruthy();
  });

  it("offers 'Mark this day away' for a future day with zero events recorded", async () => {
    render(<PlanIsland corpus={corpus} now={NOW} tz={TZ} minutesPerDay={8} />);
    await waitFor(() => expect(screen.queryByText(/working out your plan/i)).toBeNull());

    const row = document.querySelector('[data-day-row][data-offset="5"]') as HTMLElement;
    expect(row).toBeTruthy();
    expect(within(row).getByRole("button", { name: /mark.*away/i })).toBeTruthy();
  });

  it("never offers today — a day already underway is not a planned absence", async () => {
    render(<PlanIsland corpus={corpus} now={NOW} tz={TZ} minutesPerDay={8} />);
    await waitFor(() => expect(screen.queryByText(/working out your plan/i)).toBeNull());
    expect(document.querySelector('[data-day-row][data-offset="0"]')).toBeNull();
  });

  it("marking a day away from the empty state actually commits — the real calendar takes over, showing it away", async () => {
    render(<PlanIsland corpus={corpus} now={NOW} tz={TZ} minutesPerDay={8} />);
    await waitFor(() => expect(screen.queryByText(/working out your plan/i)).toBeNull());

    const row = document.querySelector('[data-day-row][data-offset="5"]') as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: /mark.*away/i }));

    await waitFor(() => {
      expect(document.querySelector('[data-day-row][data-offset="5"][data-away="true"]')).toBeTruthy();
    });
    // The log is no longer empty, so the honest zero-state sentence is gone
    // — a real (if still nearly empty) forecast now exists.
    expect(screen.queryByText(/nothing recorded yet/i)).toBeNull();
  });
});
