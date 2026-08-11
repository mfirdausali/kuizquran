/**
 * @vitest-environment jsdom
 */

// "/library" — WIREFRAME §2, build-plan route:/library.
//
// ---------------------------------------------------------------------------
// WHAT THESE TESTS ARE FOR, AND WHAT THEY DELIBERATELY DO NOT DO
// ---------------------------------------------------------------------------
// The failure this route shipped as a stub was a DEAD END: one link, to
// `/surah/112`, pointing at a page that renders "no compiled corpus is
// available for this surah yet". Listing all four offered surahs without
// saying which half of the experience is ready would have turned one dead end
// into three while looking finished.
//
// So these tests assert the OUTPUT A LEARNER SEES — the hrefs, the per-row
// text, and the fact that the availability wording DISTINGUISHES a surah the
// app can drill from one it can only show a page for. They do not assert that
// the page imports `OFFERED_SURAHS` (an import proves nothing about what
// renders) and they do not merely count rows: a page rendering surah 112 four
// times has the right count and is completely wrong.
//
// They also do not re-assert what `test/onboarding.test.tsx` already pins —
// that the offered ayah counts match the compiled manifest. That check lives
// there, guarded by an `existsSync` because `output/` is gitignored (v3-D52).
// These tests read the SAME constants the page reads, so they never touch a
// build artifact and are green on a clean checkout.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";

import LibraryPage from "@/app/(app)/library/page";
import { EnrolledMarker } from "@/components/library/EnrolledMarker";
import { OFFERED_SURAHS } from "@/lib/onboarding/surahs";
import { commitOnboarding } from "@/lib/onboarding/choices";
import { DB_NAME, openDb, resetDbForTests, writeLock } from "@/lib/idb";
import { CLIENT_SURAHS } from "@/lib/corpus/staged.ts";
import { AVAILABLE_SURAHS } from "@/lib/corpus/load.ts";
import { libraryRows } from "@/lib/library/rows.ts";

// Without this, each render is APPENDED to the same document and the second
// test onward sees two copies of the nav — which surfaces as "found multiple
// elements" rather than as a product failure. `test/dashboard.test.tsx` carries
// the same line for the same reason.
afterEach(cleanup);

/** The list itself, as a learner's screen reader would find it. */
function renderList() {
  render(<LibraryPage />);
  return screen.getByRole("navigation", { name: /^surahs$/i });
}

describe("the library lists every surah this build offers", () => {
  it("renders one row per OFFERED surah — no more, no fewer", () => {
    const nav = renderList();
    const links = within(nav).getAllByRole("link");
    // Fails if a fifth surah is hardcoded in, or if one is dropped from the map.
    expect(links).toHaveLength(OFFERED_SURAHS.length);
  });

  it("links each row to its OWN surah page, all four distinct", () => {
    const nav = renderList();
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));

    // The assertion that kills "renders the same surah N times": the hrefs are
    // the four real routes, in the offered order, and they are distinct.
    expect(hrefs).toEqual(OFFERED_SURAHS.map((s) => `/surah/${s.surah}`));
    expect(new Set(hrefs).size).toBe(OFFERED_SURAHS.length);
  });

  it("shows each surah's REAL ayah count, not a shared or swapped one", () => {
    const nav = renderList();
    const links = within(nav).getAllByRole("link");

    // Row-by-row, matched by href rather than by position, so this states
    // "surah 103's row says 3 ayat" and not merely "some row says 3 ayat".
    // That distinction is what fails a mutant swapping 103's and 112's counts.
    for (const offered of OFFERED_SURAHS) {
      const row = links.find(
        (a) => a.getAttribute("href") === `/surah/${offered.surah}`,
      );
      expect(row, `no row linked to surah ${offered.surah}`).toBeTruthy();
      expect(row!.textContent).toContain(String(offered.surah));
      expect(row!.textContent).toContain(offered.name);
      expect(row!.textContent).toContain(`${offered.ayahCount} ayat`);
    }
  });
});

// ---------------------------------------------------------------------------
// THE DEAD-END FIX — the assertion that actually constrains this route
// ---------------------------------------------------------------------------
describe("the library says WHICH surface is ready for each surah", () => {
  it("distinguishes a drillable surah from a browse-only one", () => {
    const nav = renderList();
    const links = within(nav).getAllByRole("link");
    const statusOf = (surah: number) =>
      links
        .find((a) => a.getAttribute("href") === `/surah/${surah}`)!
        .textContent!.replace(/^.*ayat/, "");

    // 112 is staged for the browser, so a learner can practise it; 12 is
    // server-only and can only be browsed. If these two ever read the same,
    // the page has stopped telling the learner anything about availability —
    // which is precisely the state the stub was in.
    const practisable = statusOf(112);
    const browseOnly = statusOf(12);
    expect(practisable).not.toBe(browseOnly);

    // And the wording is not empty: each row carries a real phrase.
    expect(practisable.trim().length).toBeGreaterThan(0);
    expect(browseOnly.trim().length).toBeGreaterThan(0);
  });

  it("marks every browser-staged surah as practisable, and surah 12 as not", () => {
    // The page must agree with the two loaders that decide the truth, rather
    // than carrying a third hand-maintained opinion that can drift from them.
    for (const row of libraryRows()) {
      expect(row.practisable, `surah ${row.surah} practisable`).toBe(
        CLIENT_SURAHS.includes(row.surah),
      );
      expect(row.detailed, `surah ${row.surah} detailed`).toBe(
        AVAILABLE_SURAHS.includes(row.surah),
      );
    }
    // Named explicitly so the split is asserted as a FACT about this build and
    // not merely as "whatever the constants happen to say".
    const rows = libraryRows();
    expect(rows.find((r) => r.surah === 12)!.practisable).toBe(false);
    expect(rows.find((r) => r.surah === 112)!.practisable).toBe(true);
  });

  it("does not claim a full experience for any surah in this build", () => {
    // Today no surah is BOTH drillable and backed by a server corpus: the two
    // loaders serve disjoint sets. If that ever changes this test should be
    // updated deliberately — it exists so the change is noticed rather than
    // silently absorbed into a row that overpromises.
    for (const row of libraryRows()) {
      expect(row.practisable && row.detailed).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// HONESTY ABOUT WHAT IS NOT BUILT
// ---------------------------------------------------------------------------
describe("the page does not pretend to do what it cannot", () => {
  it("offers no Add control, because enrollment has nowhere to write", () => {
    render(<LibraryPage />);
    // `meta.onboardingChoices.surah` is a single number and there is no
    // enroll event type. An "Add" button here would either do nothing or
    // silently re-enroll the learner — so it must not exist at all.
    expect(screen.queryByRole("button", { name: /add/i })).toBeNull();
  });

  it("keeps a stub note naming the Add confirm and the recommender", () => {
    render(<LibraryPage />);
    expect(screen.getByText(/not built yet/i)).toBeTruthy();
    // E-06 is the reason the confirm matters: adding a surah silently starves
    // the ones already in progress unless the cost surfaces first.
    expect(screen.getByText(/re-computed/i)).toBeTruthy();
    expect(screen.getByText(/recommender/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// THE ONE PER-LEARNER FACT — run against a REAL (fake-indexeddb) store
// ---------------------------------------------------------------------------
// Through the REAL `commitOnboarding` writer, not a hand-written meta row: the
// point is that this island reads what onboarding actually wrote. Mocking the
// read would assert the component's own shape and prove nothing about the
// enrollment.
describe("the library names the surah you are already learning", () => {
  beforeEach(async () => {
    // `resetDbForTests` drops the memoized CONNECTION, not the stored data, so
    // the database itself must be deleted or one test's enrollment leaks into
    // the next. The open handle must be closed first — `deleteDatabase` blocks
    // indefinitely while a connection is live. Same sequence, and the same two
    // hard-won reasons, as `test/dashboard.test.tsx`.
    try {
      const db = await openDb();
      db.close();
    } catch {
      // No database yet on the first test. Nothing to close.
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

  it("says nothing was started on a device that never onboarded", async () => {
    render(<EnrolledMarker />);
    await waitFor(() =>
      expect(screen.getByText(/have not started a surah/i)).toBeTruthy(),
    );
  });

  it("names the enrolled surah after a real onboarding commit", async () => {
    await commitOnboarding(
      { glossLang: "en", surah: 103, pace: "steady", placement: { kind: "fresh" } },
      Date.now(),
    );
    render(<EnrolledMarker />);
    // The LABEL, so a learner reads "103 · Al-Asr · 3 ayat" and not a bare id.
    await waitFor(() => expect(screen.getByText(/103 · Al-Asr · 3 ayat/)).toBeTruthy());
    // And it must not simultaneously claim they have started nothing.
    expect(screen.queryByText(/have not started a surah/i)).toBeNull();
  });

  it("never paints 'not started' while the read is still in flight (#73)", () => {
    const { container } = render(<EnrolledMarker />);
    // The FIRST paint is a skeleton. Telling an enrolled learner they have
    // nothing, because the read has not resolved, is the same class of lie as
    // painting 0 due — asserted on the element, not the copy.
    expect(container.querySelector(".skel")).toBeTruthy();
    expect(container.textContent).not.toMatch(/have not started/i);
  });
});
