/**
 * @vitest-environment jsdom
 */

// The "N pending" indicator — edge case #103.
//
//     | 103 | Outbox growth offline-for-days | fe | invisible risk | quiet
//       'N pending' indicator; NEVER BLOCKS A SESSION | M6 |
//
// TWO PROPERTIES, and each has its own mutation:
//
//   1. SKELETONS ARE NEVER ZEROS (#73). While the count is still being read
//      the component must paint a SKELETON, never "0 waiting". Painting a
//      number the app has not established is the same retention-honesty
//      violation as "0 ayat due" shown to a learner who has four. The
//      mutation: make `pending` render `0`.
//   2. IT NEVER BLOCKS. It is a PASSIVE OBSERVER — it must never trigger a
//      flush. The mutation: have it call pushOutbox() on mount. Asserted by
//      spying on the network: a passive indicator makes no requests at all.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { append } from "@/lib/idb/append";
import { openDb, resetDbForTests } from "@/lib/idb/db";
import { writeLock } from "@/lib/idb/writeLock";
import { resetSyncSummaryForTests, syncSummary } from "@/lib/sync/summary";
import { SyncStatus } from "@/components/shell/SyncStatus";

const CTX = { now: 1_700_000_000_000, tz: "UTC" };

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  writeLock.forceForTests({ role: "writer" });
  resetSyncSummaryForTests();
  vi.unstubAllGlobals();
});

/** Append at fixture COORDINATES. No Arabic, ever. */
async function appendEvents(n: number) {
  for (let i = 0; i < n; i++) {
    await append(
      { type: "tap", ts: CTX.now + i, surah: 112, ayah: 1, rung: "S1", id: `e-${i}` },
      CTX,
    );
  }
}

describe("#73 — skeletons are never zeros", () => {
  it("paints a SKELETON, not a digit, before the count is read", () => {
    render(<SyncStatus />);
    // Synchronously after mount the read has not resolved. The accessible
    // name says we are checking; there is NO number on screen.
    expect(screen.getByText(/checking what still needs to sync/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d/);
  });
});

describe("the three states the count can be in", () => {
  it("says ALL SYNCED when nothing is pending (the designed zero-state)", async () => {
    await openDb();
    render(<SyncStatus />);
    await waitFor(() => expect(screen.getByText(/all synced/i)).toBeTruthy());
  });

  it("reports the pending COUNT when rows are waiting", async () => {
    await appendEvents(3);
    render(<SyncStatus />);
    await waitFor(() => expect(screen.getByText(/3 waiting to sync/i)).toBeTruthy());
  });

  it("distinguishes 'cannot sync' from 'waiting' — different facts, different numbers", async () => {
    await appendEvents(2);
    render(<SyncStatus cannotSync={1} />);
    await waitFor(() => expect(screen.getByText(/2 waiting to sync/i)).toBeTruthy());
    // A quarantined event is NOT folded into the pending count: "waiting" and
    // "cannot" must never share a number, or an unsyncable event looks like a
    // transient backlog forever.
    expect(screen.getByText(/1 cannot sync/i)).toBeTruthy();
  });

  it("surfaces #50 divergences as a review count", async () => {
    await appendEvents(1);
    render(<SyncStatus divergences={2} />);
    await waitFor(() => expect(screen.getByText(/2 need review/i)).toBeTruthy());
  });

  // v3-D240: #111's own "accept + flag" — a far-future-timestamp event is
  // NOT a #50 divergence (its payload agrees with the server) and NOT a
  // #110 quarantine (it synced fine) — its own distinct fact, its own
  // distinct number.
  it("surfaces #111 far-future timestamps as their own count, distinct from divergences", async () => {
    // Scoped to this render, not the ambient `screen` — this file never
    // unmounts between tests, and an earlier case already renders its own
    // "2 need review" text into the accumulated DOM.
    await appendEvents(1);
    const { container } = render(<SyncStatus futureTs={3} divergences={4} />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/3 future-dated/i)).toBeTruthy());
    // Both counts render side by side — neither absorbs the other.
    expect(scoped.getByText(/4 need review/i)).toBeTruthy();
  });

  // v3-D243: #111's own device-level clock-skew measurement (as opposed to
  // v3-D240's own PER-EVENT futureTs count above) — a fifth, distinct fact.
  // Escalates only PAST CLOCK_SKEW_ALERT_MS; an ordinary few seconds of
  // transport noise must never paint an alarming message on every sync.
  it("escalates a badly-skewed device clock, distinct from every other fact", async () => {
    await appendEvents(1);
    // 20 minutes is comfortably past CLOCK_SKEW_ALERT_MS (5 min).
    const { container } = render(<SyncStatus clockSkewMs={20 * 60 * 1000} />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/1 waiting to sync/i)).toBeTruthy());
    expect(scoped.getByText(/clock off by 20m/i)).toBeTruthy();
  });

  it("says nothing about a small, ordinary clock skew — transport noise, not a real problem", async () => {
    // A count no other UNSCOPED query in this file uses (this file never
    // unmounts between tests, so an accumulated render from an earlier or
    // later test using the same count would make an unscoped query elsewhere
    // in the suite ambiguous — see the v3-D161 block's own comment on this).
    await appendEvents(9);
    // 30 seconds is well under CLOCK_SKEW_ALERT_MS.
    const { container } = render(<SyncStatus clockSkewMs={30_000} />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/9 waiting to sync/i)).toBeTruthy());
    expect(scoped.queryByText(/clock off by/i)).toBeNull();
  });

  it("escalates a NEGATIVE skew (this device's clock is BEHIND the server) by its magnitude, not its sign", async () => {
    await appendEvents(1);
    const { container } = render(<SyncStatus clockSkewMs={-15 * 60 * 1000} />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/1 waiting to sync/i)).toBeTruthy());
    expect(scoped.getByText(/clock off by 15m/i)).toBeTruthy();
  });

  it("says nothing when the skew could not be measured at all (null, never a fabricated 0)", async () => {
    await appendEvents(1);
    const { container } = render(<SyncStatus clockSkewMs={null} />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/1 waiting to sync/i)).toBeTruthy());
    expect(scoped.queryByText(/clock off by/i)).toBeNull();
  });

  // v3-D162: a dead token is a THIRD, distinct fact — not folded into
  // "cannot sync" (a quarantined event never syncs at all; a dead token
  // recovers on its own once a re-mint succeeds) and not silently absorbed
  // into the ordinary pending count.
  it("distinguishes a dead token from both 'cannot sync' and 'waiting' — a third fact", async () => {
    // Scoped to this render, not the ambient `screen`: this file never
    // unmounts between tests, and an earlier case already renders its own
    // "1 cannot sync" text into the accumulated DOM — the same discipline
    // the v3-D161 live-summary tests below already use.
    await appendEvents(4);
    const { container } = render(<SyncStatus authDead={true} cannotSync={1} />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/4 waiting to sync/i)).toBeTruthy());
    expect(scoped.getByText(/sync paused, reconnecting/i)).toBeTruthy();
    expect(scoped.getByText(/1 cannot sync/i)).toBeTruthy();
  });
});

describe("v3-D161 — a REAL mount (no props) escalates from the live SyncTrigger summary", () => {
  // This file's other tests never unmount between cases, so a query must be
  // SCOPED to this test's own render (not the ambient `screen`, which would
  // also see every earlier test's leftover DOM) and use counts no other test
  // in this file happens to render, or a collision would be a false
  // negative rather than proof of anything.
  it("renders the cannot-sync count from lib/sync/summary.ts when unprompted by a prop", async () => {
    await appendEvents(6);
    // This is exactly how a real `<SyncStatus />` is mounted from
    // `home/page.tsx` — no props at all. Before v3-D161 this could never
    // paint an escalation outside a test that hand-fed a literal.
    syncSummary.report(
      {
        quarantined: [
          { id: "oversize-1", bytes: 9_000 },
          { id: "oversize-2", bytes: 9_500 },
          { id: "oversize-3", bytes: 10_000 },
        ],
        divergences: [],
      },
      false,
    );
    const { container } = render(<SyncStatus />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/6 waiting to sync/i)).toBeTruthy());
    expect(scoped.getByText(/3 cannot sync/i)).toBeTruthy();
  });

  it("an explicit prop still overrides the live summary", async () => {
    await appendEvents(5);
    syncSummary.report({ quarantined: [{ id: "oversize-1", bytes: 9_000 }], divergences: [] }, false);
    const { container } = render(<SyncStatus cannotSync={0} />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/5 waiting to sync/i)).toBeTruthy());
    expect(scoped.queryByText(/cannot sync/i)).toBeNull();
  });

  // v3-D162's own live-summary counterpart to the two cases above.
  it("renders the live authDead value from lib/sync/summary.ts when unprompted by a prop", async () => {
    await appendEvents(1);
    syncSummary.report({ quarantined: [], divergences: [] }, true);
    const { container } = render(<SyncStatus />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/1 waiting to sync/i)).toBeTruthy());
    expect(scoped.getByText(/sync paused, reconnecting/i)).toBeTruthy();
  });

  it("an explicit authDead prop still overrides the live summary", async () => {
    await appendEvents(1);
    syncSummary.report({ quarantined: [], divergences: [] }, true);
    const { container } = render(<SyncStatus authDead={false} />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/1 waiting to sync/i)).toBeTruthy());
    expect(scoped.queryByText(/sync paused/i)).toBeNull();
  });

  // v3-D240's own live-summary counterpart to the cases above.
  it("renders the live futureTs count from lib/sync/summary.ts when unprompted by a prop", async () => {
    await appendEvents(1);
    syncSummary.report({ quarantined: [], divergences: [], futureTs: ["a", "b"] }, false);
    const { container } = render(<SyncStatus />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/1 waiting to sync/i)).toBeTruthy());
    expect(scoped.getByText(/2 future-dated/i)).toBeTruthy();
  });

  it("an explicit futureTs prop still overrides the live summary", async () => {
    await appendEvents(1);
    syncSummary.report({ quarantined: [], divergences: [], futureTs: ["a"] }, false);
    const { container } = render(<SyncStatus futureTs={0} />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/1 waiting to sync/i)).toBeTruthy());
    expect(scoped.queryByText(/future-dated/i)).toBeNull();
  });

  // v3-D243's own live-summary counterpart to the cases above.
  it("renders the live clockSkewMs measurement from lib/sync/summary.ts when unprompted by a prop", async () => {
    await appendEvents(1);
    syncSummary.report({ quarantined: [], divergences: [], clockSkewMs: 20 * 60 * 1000 }, false);
    const { container } = render(<SyncStatus />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/1 waiting to sync/i)).toBeTruthy());
    expect(scoped.getByText(/clock off by 20m/i)).toBeTruthy();
  });

  it("an explicit clockSkewMs prop still overrides the live summary", async () => {
    await appendEvents(1);
    syncSummary.report({ quarantined: [], divergences: [], clockSkewMs: 20 * 60 * 1000 }, false);
    const { container } = render(<SyncStatus clockSkewMs={null} />);
    const scoped = within(container);
    await waitFor(() => expect(scoped.getByText(/1 waiting to sync/i)).toBeTruthy());
    expect(scoped.queryByText(/clock off by/i)).toBeNull();
  });
});

describe("#103 — it NEVER blocks and never flushes", () => {
  it("makes NO network request of its own", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    await appendEvents(2);

    render(<SyncStatus />);
    await waitFor(() => expect(screen.getByText(/2 waiting to sync/i)).toBeTruthy());

    // A PASSIVE OBSERVER. If this component ever triggers or awaits a flush,
    // it stops being free to render mid-session — which is exactly what #103
    // forbids.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders a calm, non-blocking message when the log cannot be read", async () => {
    // A broken store must not produce a modal, a thrown render, or alarm. The
    // local log is truth and nothing is lost — only the COUNT is unavailable.
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new DOMException("nope", "InvalidStateError");
      },
    });
    resetDbForTests();
    render(<SyncStatus />);
    await waitFor(() => expect(screen.getByText(/sync status unavailable/i)).toBeTruthy());
    expect(screen.getByText(/your work is saved on this device/i)).toBeTruthy();
  });
});
