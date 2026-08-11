/**
 * @vitest-environment jsdom
 */

// RENDER TESTS for /plan — THE PLAN CALENDAR (WIREFRAME §14, v3-D05).
//
// ---------------------------------------------------------------------------
// THE ONE THING THESE TESTS EXIST TO PROTECT
// ---------------------------------------------------------------------------
// §14's honesty mechanic is that CONFIDENCE DECAYS WITH DISTANCE, and that the
// UI SHOWS the decay rather than asserting it. A legend that says "estimated"
// is an assertion. The test for the real thing is: COVER THE LEGEND — can you
// still tell the zones apart?
//
// So these tests do not check that the word "estimated" appears somewhere.
// They check the STRUCTURAL differences that survive with the legend covered:
//
//   - the concrete zone has per-day rows containing NAMED ITEMS;
//   - the estimated zone has per-day rows with NO item list at all — there is
//     nothing to tap open, and absence of affordance is a stronger honesty
//     signal than any styling;
//   - the trajectory zone has NO DAY ROWS WHATSOEVER — days stop existing, so
//     a learner cannot expect item-level detail from a thing with no days;
//   - NO AYAH IS NAMED past +3 days. This is the core mechanic as an
//     assertion: "someone improves the calendar by filling every day" is the
//     exact failure §14 calls a lie;
//   - numeric precision degrades visibly: exact integers, then `~` and
//     rounding, then a half-month rather than a date.
//
// Zone membership is a function of DISTANCE FROM TODAY, never of interaction —
// so marking a far day away can never promote it to concrete.
//
// `now` is FROZEN. A calendar test against the real clock is a test that fails
// once a quarter for reasons no one can reproduce.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { splitBudget } from "@engine/multiSurah.ts";
import { buildForecast, CONCRETE_THROUGH_DAY, ESTIMATED_THROUGH_DAY } from "@/lib/plan/forecast";
import { PlanCalendar } from "@/components/plan/PlanCalendar";

afterEach(cleanup);

// Frozen "now": 2026-08-11T09:00:00Z. Every day offset below is relative to it.
const NOW = Date.UTC(2026, 7, 11, 9, 0, 0);
const TZ = "UTC";

/** Two enrolled surahs, so the multi-surah budget split (E-06) is exercised
 *  rather than accidentally avoided by a single-surah fixture. */
const ENROLLED = [
  { surah: 12, remainingAyat: 40, avgWordsPerAyah: 16 },
  { surah: 112, remainingAyat: 4, avgWordsPerAyah: 5 },
];

function forecast(overrides: Partial<Parameters<typeof buildForecast>[0]> = {}) {
  return buildForecast({
    now: NOW,
    tz: TZ,
    minutesPerDay: 8,
    enrolled: ENROLLED,
    dueToday: { gates: [{ surah: 12, ayah: 13 }], reviews: 6, learn: [{ surah: 12, ayah: 14 }] },
    awayDays: [],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 1. ZONE BOUNDARIES
// ---------------------------------------------------------------------------

describe("the three fidelity zones (§14)", () => {
  it("puts day +3 in concrete and day +4 in estimated — the near edge", () => {
    const f = forecast();
    expect(f.days.find((d) => d.offset === 3)?.zone).toBe("concrete");
    expect(f.days.find((d) => d.offset === 4)?.zone).toBe("estimated");
  });

  it("puts day +14 in estimated and stops emitting days past it — the far edge", () => {
    const f = forecast();
    expect(f.days.find((d) => d.offset === 14)?.zone).toBe("estimated");
    // Day +15 onward is the trajectory, which is NOT a day row (see below).
    expect(f.days.find((d) => d.offset === 15)).toBeUndefined();
  });

  it("states its boundaries once, as named constants rather than scattered literals", () => {
    expect(CONCRETE_THROUGH_DAY).toBe(3);
    expect(ESTIMATED_THROUGH_DAY).toBe(14);
  });

  it("includes today as the first concrete day", () => {
    const f = forecast();
    expect(f.days[0]?.offset).toBe(0);
    expect(f.days[0]?.zone).toBe("concrete");
  });
});

// ---------------------------------------------------------------------------
// 2. THE HONESTY MECHANIC — SHOWN, NOT ASSERTED
// ---------------------------------------------------------------------------

describe("decreasing confidence is shown structurally, not merely asserted", () => {
  it("names specific ayat in the concrete zone", () => {
    render(<PlanCalendar forecast={forecast()} />);
    const zone = screen.getByTestId("zone-concrete");
    // A reference like "12:13" — the thing the learner can act on today.
    expect(zone.textContent).toMatch(/\d+:\d+/);
  });

  it("names NO ayah anywhere past +3 days — the core mechanic", () => {
    render(<PlanCalendar forecast={forecast()} />);
    for (const id of ["zone-estimated", "zone-trajectory"]) {
      const zone = screen.getByTestId(id);
      // No `surah:ayah` reference may appear. Populating a far-future day with
      // specific ayat would look more satisfying and would be a LIE.
      expect(zone.textContent ?? "", `${id} names an ayah`).not.toMatch(/\b\d+:\d+\b/);
    }
  });

  it("gives concrete days a real item list and estimated days none at all", () => {
    render(<PlanCalendar forecast={forecast()} />);
    const concrete = screen.getByTestId("zone-concrete");
    const estimated = screen.getByTestId("zone-estimated");
    // Absence of affordance: there is nothing to tap open in the estimated
    // zone, so it cannot be mistaken for the concrete one.
    expect(within(concrete).getAllByRole("list").length).toBeGreaterThan(0);
    expect(within(estimated).queryAllByRole("list").length).toBe(0);
  });

  it("renders NO day rows in the trajectory zone — days stop existing", () => {
    render(<PlanCalendar forecast={forecast()} />);
    const traj = screen.getByTestId("zone-trajectory");
    expect(traj.querySelectorAll("[data-day-row]").length).toBe(0);
    // And the other two zones DO have them, so the assertion above is not
    // passing merely because nothing anywhere is a day row.
    expect(screen.getByTestId("zone-concrete").querySelectorAll("[data-day-row]").length).toBeGreaterThan(0);
    expect(screen.getByTestId("zone-estimated").querySelectorAll("[data-day-row]").length).toBeGreaterThan(0);
  });

  it("degrades numeric precision visibly across the zones", () => {
    render(<PlanCalendar forecast={forecast()} />);
    const concrete = screen.getByTestId("zone-concrete").textContent ?? "";
    const estimated = screen.getByTestId("zone-estimated").textContent ?? "";
    // Concrete counts are exact: no tilde on a number we actually know.
    expect(concrete).not.toMatch(/~\s*\d/);
    // Estimated numbers are explicitly approximate.
    expect(estimated).toMatch(/~\s*\d/);
  });

  it("dates the trajectory to a half-month, never to a day", () => {
    render(<PlanCalendar forecast={forecast()} />);
    const traj = screen.getByTestId("zone-trajectory").textContent ?? "";
    // "mid-March" / "early March" / "late March" — never "March 14".
    expect(traj).toMatch(/\b(early|mid|late)-[A-Z][a-z]+/);
    expect(traj).not.toMatch(/[A-Z][a-z]+ \d{1,2}\b/);
  });

  it("carries the fidelity as a WORD in each zone heading (§15 applied to time)", () => {
    render(<PlanCalendar forecast={forecast()} />);
    // A zone that is styling-only vanishes in greyscale and for a screen
    // reader. Each heading says what it is.
    expect(screen.getByRole("heading", { name: /exact/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /estimated/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /trajectory/i })).toBeTruthy();
  });

  it("explains WHY the detail stops, at the boundary where it stops", () => {
    render(<PlanCalendar forecast={forecast()} />);
    // The app narrating its own limits — the same move §10 makes with
    // "3 ayat are slipping. Not a failure — this is what memory does."
    expect(screen.getByTestId("zone-estimated").textContent).toMatch(/stop naming|depends on/i);
    expect(screen.getByTestId("zone-trajectory").textContent).toMatch(/too far out|stays fixed/i);
  });
});

// ---------------------------------------------------------------------------
// 3. PLANNED ABSENCES
// ---------------------------------------------------------------------------

describe("planned absences (§14)", () => {
  it("marks a day away and says so plainly", () => {
    const f = forecast({ awayDays: [2] });
    render(<PlanCalendar forecast={f} />);
    expect(screen.getByTestId("zone-concrete").textContent).toMatch(/Away/);
  });

  it("never styles an away day as a miss, and never as a streak pill (#95)", () => {
    const f = forecast({ awayDays: [2] });
    const { container } = render(<PlanCalendar forecast={f} />);
    const away = container.querySelector("[data-away='true']");
    expect(away).toBeTruthy();
    // Amber is streak/consistency semantics. An away day is neither a streak
    // nor a break in one — the calendar must not punish life.
    expect(away?.querySelector(".pill-streak")).toBeNull();
    expect(away?.className ?? "").not.toMatch(/miss|warn|fail/);
  });

  it("expects no review on an away day", () => {
    const f = forecast({ awayDays: [2] });
    const day = f.days.find((d) => d.offset === 2);
    expect(day?.away).toBe(true);
    expect(day?.items.length).toBe(0);
  });

  it("keeps zone membership a function of distance, not of interaction", () => {
    // Marking a far day away must not promote it to concrete.
    const f = forecast({ awayDays: [9] });
    expect(f.days.find((d) => d.offset === 9)?.zone).toBe("estimated");
  });
});

// ---------------------------------------------------------------------------
// 4. E-06 — THE BUDGET IS SPLIT ACROSS ENROLLED SURAHS
// ---------------------------------------------------------------------------

describe("the finish date is honest across multiple surahs (E-06)", () => {
  // E-06: "planFor() gives every surah the full daily budget — every ETA
  // lies." Closed at build-plan step 9 by `multiSurah.ts#splitBudget()`. The
  // defect was never in planFor (which honours whatever minutesPerDay it is
  // handed) — it was that nothing existed to compute a surah's FAIR SHARE, so
  // every caller passed the full total to each surah. These tests assert that
  // THIS CALLER passes a split share, which is where the lie would come back.
  //
  // A NOTE ON WHAT CANNOT BE ASSERTED HERE. `planFor` floors `ayahPerDay` at
  // 1 ("Math.max(1, ...)"), so for a surah whose ayat cost more than the whole
  // budget, the split and the unsplit budget both yield one ayah a day and the
  // same ETA. Asserting "two surahs finish later than one" would therefore
  // fail against a CORRECT implementation — the floor absorbs the difference.
  // That floor is engine behaviour and is not this task's to change, so the
  // tests below assert the split at the point where it is observable instead
  // of at a point where the engine deliberately flattens it.

  it("hands each surah a share of the budget, never the raw total", () => {
    const total = 8;
    const shares = splitBudget(
      total,
      ENROLLED.map((e) => ({ surah: e.surah, weight: e.remainingAyat })),
    );
    // Every share is strictly less than the total, and they sum back to it —
    // "each surah gets the whole day" is exactly what E-06 named as the lie.
    for (const [, share] of shares) expect(share).toBeLessThan(total);
    expect([...shares.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(total, 6);
  });

  it("weights the split by work remaining, so the longer surah gets more day", () => {
    const shares = splitBudget(
      8,
      ENROLLED.map((e) => ({ surah: e.surah, weight: e.remainingAyat })),
    );
    // An equal split would starve the longer surah and inflate its ETA.
    expect(shares.get(12)!).toBeGreaterThan(shares.get(112)!);
  });

  it("takes the finish horizon from the SLOWEST surah, not the fastest", () => {
    // The learner is working on all of them, so they finish when the last one
    // does. A min (or a sum) would be a different, wrong promise.
    const f = forecast();
    const solo12 = buildForecast({
      now: NOW,
      tz: TZ,
      minutesPerDay: 8,
      enrolled: [ENROLLED[0]!],
      dueToday: { gates: [], reviews: 0, learn: [] },
      awayDays: [],
    });
    const solo112 = buildForecast({
      now: NOW,
      tz: TZ,
      minutesPerDay: 8,
      enrolled: [ENROLLED[1]!],
      dueToday: { gates: [], reviews: 0, learn: [] },
      awayDays: [],
    });
    expect(solo112.etaDays).toBeLessThan(solo12.etaDays);
    expect(f.etaDays).toBe(Math.max(solo12.etaDays, solo112.etaDays));
  });

  it("reports one finish horizon for the learner, not one per surah", () => {
    const f = forecast();
    expect(typeof f.finishLabel).toBe("string");
    expect(f.finishLabel).toMatch(/\b(early|mid|late)-/);
  });
});
