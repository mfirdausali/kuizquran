/**
 * @vitest-environment jsdom
 */

// THE DASHBOARD SURFACES step 22 owns — edge cases #97, #98 and #104.
//
// These run against a REAL (fake-indexeddb) store through the REAL append path,
// because every one of these components is a three-or-four-stated log read and
// the states are the whole point. A mocked store would let `empty` and `ready`
// be asserted without ever proving they are DISTINGUISHED, which is exactly the
// conflation #73 is about.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { DB_NAME, append, currentTz, openDb, resetDbForTests, writeLock } from "@/lib/idb";
import type { DrillEvent } from "@engine/types.ts";
import { MySurahs } from "@/components/home/MySurahs";
import { DeviceReset } from "@/components/home/DeviceReset";

afterEach(cleanup);

beforeEach(async () => {
  // `resetDbForTests` drops the MEMOIZED CONNECTION, not the stored data — so
  // the database itself must be deleted, or one test's events leak into the
  // next and a "zero state" assertion silently runs against a populated store.
  // (Found the hard way: these tests passed individually and failed as a file.)
  //
  // The OPEN handle must be closed first. `deleteDatabase` blocks indefinitely
  // while a connection is live, which surfaces as a 10s timeout rather than an
  // error — the second thing found the hard way here.
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
  // The writer lock guards every commit (edge case #75). These tests are the
  // only tab, and this is the same seam lib/idb/append.test.ts uses.
  writeLock.resetForTests();
  writeLock.forceForTests({ role: "writer" });
});

const DAY = 24 * 60 * 60 * 1000;

/** Append a graded event. Fields mirror the engine's DrillEvent so this is the
 *  real ingestion path, not a hand-written row put straight into the store. */
async function addEvent(surah: number, ts: number): Promise<void> {
  const event = {
    type: "tap",
    surah,
    ayah: 1,
    ts,
  } as unknown as DrillEvent;
  await append(event, { now: ts, tz: currentTz() });
}

describe("#97 — the zero-state dashboard leads with somewhere to go", () => {
  it("offers real surah links instead of an empty box", async () => {
    render(<MySurahs />);
    await waitFor(() => expect(screen.getByText(/nothing on this device yet/i)).toBeTruthy());
    // The requirement is "leads with recommender + library" — i.e. the next
    // action. Assert that real, navigable choices exist.
    const nav = screen.getByRole("navigation", { name: /surahs you can start/i });
    expect(nav.querySelectorAll("a").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /browse the library/i })).toBeTruthy();
  });

  it("shows NO continue CTA when there is nothing to continue (§12)", async () => {
    render(<MySurahs />);
    await waitFor(() => expect(screen.getByText(/nothing on this device yet/i)).toBeTruthy());
    // A "Continue" that starts nothing is the dashboard lying about what it
    // has. Asserted as an absence, which is the only way to express it.
    expect(screen.queryByText(/continue/i)).toBeNull();
  });

  it("never paints a zero while the log is still being read (#73)", async () => {
    const { container } = render(<MySurahs />);
    // The FIRST paint is a skeleton, not a digit. Asserted on the skeleton
    // ELEMENT rather than its text: the copy is deliberately split across a
    // visual span and an `sr-only` span, so a text matcher would be asserting
    // the wording rather than the state.
    expect(container.querySelector(".skel")).toBeTruthy();
    // And no number is on screen at all — "0 ayat due" shown to a learner who
    // has four is the retention-honesty violation this rule exists for.
    expect(container.textContent).not.toMatch(/\d/);
  });
});

describe("#98 — returning after weeks says what was deferred", () => {
  it("says nothing about a backlog after a normal recent session", async () => {
    await addEvent(112, Date.now() - 1 * DAY);
    render(<MySurahs />);
    await waitFor(() => expect(screen.getByText(/1 event recorded/i)).toBeTruthy());
    expect(screen.queryByText(/it has been about/i)).toBeNull();
  });

  it("names the gap and says the backlog is spread, not dumped", async () => {
    await addEvent(112, Date.now() - 30 * DAY);
    render(<MySurahs />);
    // The silent failure this prevents: a capped queue with no explanation.
    await waitFor(() => expect(screen.getByText(/it has been about 30 days/i)).toBeTruthy());
    expect(screen.getByText(/a piece at a time/i)).toBeTruthy();
    // And it must say nothing was lost for being late — the message exists to
    // protect trust, not to scold.
    expect(screen.getByText(/nothing was deleted for being late/i)).toBeTruthy();
  });
});

describe("#104 — device reset enumerates what would be lost", () => {
  it("names the NUMBER OF SURAHS and the surahs themselves, not 'some data'", async () => {
    await addEvent(112, Date.now() - 2 * DAY);
    await addEvent(103, Date.now() - 1 * DAY);
    render(<DeviceReset />);
    await waitFor(() => expect(screen.getByText(/2 surahs of history/i)).toBeTruthy());
    // The enumeration itself — "N surahs" is the requirement's own wording.
    expect(screen.getByText(/103, 112/)).toBeTruthy();
    expect(screen.getByText(/2 recorded events/i)).toBeTruthy();
  });

  it("distinguishes what is UNRECOVERABLE from what is backed up", async () => {
    await addEvent(112, Date.now());
    render(<DeviceReset />);
    // Unsynced events exist nowhere else. Saying "you can sign in again later"
    // without this distinction would be the damaging half-truth.
    await waitFor(() =>
      expect(screen.getByText(/cannot be recovered by anyone/i)).toBeTruthy(),
    );
  });

  it("offers nothing to clear when there is nothing on the device", async () => {
    render(<DeviceReset />);
    await waitFor(() =>
      expect(screen.getByText(/nothing recorded on this device/i)).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: /clear this device/i })).toBeNull();
  });

  it("does not offer a working destructive action before a recovery path exists", async () => {
    await addEvent(112, Date.now());
    render(<DeviceReset />);
    const button = await screen.findByRole("button", { name: /clear this device/i });
    // A destructive control that works before its recovery path exists is worse
    // than one that waits, and the screen says why rather than hiding it.
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/no account to restore from yet/i)).toBeTruthy();
  });
});
