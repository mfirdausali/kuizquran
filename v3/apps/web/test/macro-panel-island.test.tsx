/**
 * @vitest-environment jsdom
 */

// THE "broken" LOG STATE on MacroPanelIsland (v3-D234).
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
// DECISIONS.md v3-D232 named this exactly: `MacroPanelIsland.tsx` is the ONE
// of nine log-reading islands whose `broken` branch discarded `state.reason`.
// Every sibling (`PlanIsland`, `ProgressListIsland`, `AyahStatsIsland`,
// `GrowthIsland`, `RetentionIsland`, `TestHistoryIsland`,
// `SurahAyahListIsland`, `MySurahs`) renders `Reason: <code>{state.reason}</code>`
// — this island printed a fixed sentence with no reason at all. Real, but
// low-consequence, since a page mounting the macro panel also mounts a
// sibling island that does name the reason; still, "you're in private
// browsing" and "another tab is mid-upgrade" are not the same problem
// (`ProgressListIsland`'s own comment), and this panel owed the learner that
// distinction too.
//
// These tests drive the exported `MacroPanelView` — the pure state -> view
// mapping, the same split `AyahStatsIsland.tsx#AyahStatsView` and
// `SurahAyahListIsland.tsx#SurahAyahListView` already established — with each
// `LogState` handed directly, so they see exactly what a learner would see
// without touching real IndexedDB.
//
// Not one Arabic byte is typed here: `facts` is a synthetic, hand-built
// MacroFacts object (never loaded from a real corpus), and every string is
// English test prose.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { DrillEvent } from "@engine/types.ts";

import { MacroPanelView } from "@/components/macro/MacroPanelIsland";
import type { MacroFacts } from "@/components/macro/facts.ts";
import type { LogState } from "@/lib/idb";

afterEach(cleanup);

const FACTS: MacroFacts = {
  archetype: "ARC",
  reason: "default",
  layout: "strip",
  authored: false,
};

function pendingState(): LogState<DrillEvent[]> {
  return { status: "pending" };
}
function brokenState(reason: string): LogState<DrillEvent[]> {
  return { status: "broken", reason: reason as never };
}

describe("MacroPanelIsland's broken branch names the reason (v3-D234)", () => {
  it("says so, and NAMES the reason — never a silent generic failure", () => {
    render(
      <MacroPanelView
        state={brokenState("private-mode")}
        surah={12}
        ayahCount={4}
        facts={FACTS}
        now={0}
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("private-mode")).toBeTruthy();
  });

  it("two different reasons get two different renders — not one hardcoded string", () => {
    const { container, unmount } = render(
      <MacroPanelView
        state={brokenState("another-tab-mid-upgrade")}
        surah={12}
        ayahCount={4}
        facts={FACTS}
        now={0}
      />,
    );
    expect(container.textContent).toContain("another-tab-mid-upgrade");
    expect(container.textContent).not.toContain("private-mode");
    unmount();
  });

  it("pending still renders the skeleton, never a number — unaffected by this fix", () => {
    render(
      <MacroPanelView state={pendingState()} surah={12} ayahCount={4} facts={FACTS} now={0} />,
    );
    expect(screen.getByText(/Reading your progress/i)).toBeTruthy();
  });
});
