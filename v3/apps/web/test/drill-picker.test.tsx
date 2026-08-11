// @vitest-environment jsdom
//
// The picker's RENDER contract. These tests assert the things a learner can
// actually see and act on — the consequence of each mode, the honest
// denominator, and the page picker's degradation — because those are the
// promises step 20 makes.
//
// The log is faked at the module boundary (`@/lib/idb`) rather than through a
// real IndexedDB, so a test can hold the component in each of the four log
// states deliberately, including `pending` and `broken`.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Corpus } from "@engine/types.ts";
import { YUSUF_GEOMETRY } from "./fixtures/geometry";

type LogState =
  | { status: "pending" }
  | { status: "empty" }
  | { status: "ready"; data: unknown[] }
  | { status: "broken"; reason: string };

let logState: LogState = { status: "empty" };

vi.mock("@/lib/idb", () => ({
  useLogState: () => logState,
  getEventsForSurah: () => Promise.resolve([]),
}));

const { DrillPicker } = await import("@/components/drill/DrillPicker");

/** A corpus carrying only what the picker reads. No Arabic is written here;
 *  the picker renders no verse text, so none is needed. */
function corpusWith(geometry: { ayah: number; page: number | null }[]): Corpus {
  return {
    meta: { surah: 12, ayahCount: 111, wordCount: 0, generatedFrom: [] },
    verses: geometry.map((g) => ({
      ayah: g.ayah,
      text_uthmani: "",
      page: g.page,
      line: null,
    })),
    words: [],
    distractors: [],
    connections: [],
    lookalikes: [],
    sceneBeats: [],
  } as unknown as Corpus;
}

const WITH_GEOMETRY = corpusWith(YUSUF_GEOMETRY);
const WITHOUT_GEOMETRY = corpusWith(
  YUSUF_GEOMETRY.map((g) => ({ ayah: g.ayah, page: null })),
);

beforeEach(() => {
  logState = { status: "empty" };
});

// Unmount between tests. Without this, renders accumulate in the same document
// and every `getByText` finds N copies — which fails loudly here, but in a
// laxer assertion would pass while testing the wrong tree.
afterEach(cleanup);

describe("the mode choice is exposed honestly", () => {
  // MUTATION: delete either consequence line from the JSX, leaving only the
  // mode NAME. Confirmed RED — a learner could no longer tell what a slip
  // costs, which is precisely what the brief forbids.
  //
  // The graded sentence legitimately appears TWICE: once on the radio option
  // and once in the summary for the mode actually selected. That is deliberate
  // reinforcement at the moment of commitment, so the test asserts the count
  // rather than papering over it with a loose matcher.
  it("states the consequence of BOTH modes, not just the name", () => {
    render(<DrillPicker corpus={WITH_GEOMETRY} now={0} />);
    // Graded is selected, so its consequence is on the option AND in the summary.
    expect(screen.getAllByText("Slips will lower your strength.")).toHaveLength(2);
    // The unselected mode still states its consequence, on the option.
    expect(
      screen.getAllByText(
        "Nothing can be damaged; this still counts toward your streak.",
      ),
    ).toHaveLength(1);
  });

  it("offers both modes as real, selectable controls", () => {
    render(<DrillPicker corpus={WITH_GEOMETRY} now={0} />);
    const graded = screen.getByRole("radio", { name: /graded/i }) as HTMLInputElement;
    const lap = screen.getByRole("radio", { name: /victory lap/i }) as HTMLInputElement;
    expect(graded.checked).toBe(true);
    expect(lap.checked).toBe(false);
  });
});

describe("the mushaf page picker", () => {
  it("offers all 14 of Yusuf's pages when geometry is present", () => {
    render(<DrillPicker corpus={WITH_GEOMETRY} now={0} />);
    const buttons = screen.getAllByRole("button", { name: /^Page \d+/ });
    expect(buttons).toHaveLength(14);
  });

  // Edge case #11 — a shared page is LABELLED, never silently cropped.
  it("labels the page the surah shares with its neighbour", () => {
    render(<DrillPicker corpus={WITH_GEOMETRY} now={0} />);
    expect(screen.getAllByText("shares this page").length).toBeGreaterThan(0);
  });

  // G9 / edge case #63. MUTATION: render the page list unconditionally — with
  // no geometry it renders zero buttons and no explanation, so the feature
  // silently vanishes instead of explaining itself. Confirmed RED.
  it("degrades with an explanation, not a crash, when geometry is absent", () => {
    expect(() => render(<DrillPicker corpus={WITHOUT_GEOMETRY} now={0} />)).not.toThrow();
    expect(screen.queryAllByRole("button", { name: /^Page \d+/ })).toHaveLength(0);
    expect(screen.getByText(/Page drills aren't available/i)).toBeDefined();
  });
});

describe("log states", () => {
  // Edge case #73: a pending read must never paint a number.
  it("paints no counts while the log is still loading", () => {
    logState = { status: "pending" };
    render(<DrillPicker corpus={WITH_GEOMETRY} now={0} />);
    expect(screen.getByText(/reading your progress/i)).toBeDefined();
    expect(screen.queryByText(/ayat ·/)).toBeNull();
  });

  // A broken log means we do not KNOW what is learned. Claiming "0 ready"
  // would be a guess presented as a fact.
  it("refuses to guess a denominator when the log cannot be read", () => {
    logState = { status: "broken", reason: "private-browsing" };
    render(<DrillPicker corpus={WITH_GEOMETRY} now={0} />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByText(/ayat ·/)).toBeNull();
  });

  // The first-run state: an empty log is READABLE, so the honest answer is
  // "nothing learned yet", not a skeleton and not an error.
  it("says there is nothing to drill yet when the log is empty", () => {
    logState = { status: "empty" };
    render(<DrillPicker corpus={WITH_GEOMETRY} now={0} />);
    expect(screen.getByText(/Nothing here has been learned yet/i)).toBeDefined();
  });
});
