/**
 * @vitest-environment jsdom
 */

// SESSION GATE — the `/session` route guard's own enrollment read.
//
// `SessionGate` reads the enrollment via `readChoices()` with NO try/catch
// around the call. `readChoices()` (lib/onboarding/choices.ts) awaits
// `openDb()` directly, and `openDb()` (lib/idb/db.ts) genuinely THROWS a real
// `IdbOpenError` on a real, reachable failure — a blocked version upgrade, a
// quota error, a locked-down/private-mode environment. On any such failure
// the effect's promise rejects with nothing to catch it, `setState` is never
// called, and the component is stuck on `{kind:"loading"}` — "Loading your
// enrollment…" — FOREVER. No retry, no message, no escalation, on `/session`,
// the one graded drilling route.
//
// Three siblings reading the SAME `readChoices()` call already get this
// right: `components/home/TodaySession.tsx`, `components/library
// /EnrolledMarker.tsx` and `components/shell/EnrollmentSteer.tsx` all wrap the
// call in try/catch and render a `broken` state. `SessionGate` is the one
// gate on the graded path itself that omits it.
//
// This test uses a REAL open failure — the same `indexedDB.open(DB_NAME, 99)`
// -then-reopen-at-the-real-version technique `lib/idb/state.test.ts` already
// uses for its own "a real VersionError reaches the log state" case — never a
// hand-mocked rejection, so the failure this proves is one IndexedDB itself
// can actually produce.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { DB_NAME, openDb, resetDbForTests, writeLock } from "@/lib/idb";
import { SessionGate } from "@/components/session/SessionGate";

afterEach(cleanup);

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
});

describe("SessionGate surfaces a real enrollment-read failure instead of hanging forever", () => {
  it("a genuine VersionError on open reaches an alert, never an eternal 'Loading your enrollment…'", async () => {
    // Force the NEXT open this component's own readChoices() makes to fail
    // for real: open the real database at a version HIGHER than the app's
    // own DB_VERSION first. IndexedDB's own rule then refuses any later open
    // at the lower, real version with a genuine VersionError — exactly the
    // "another tab already upgraded the schema" scenario db.ts classifies as
    // `open-blocked`.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 99);
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    render(<SessionGate />);

    // Must NOT stay on the loading line forever.
    const alert = await waitFor(() => screen.getByRole("alert"), { timeout: 2000 });
    expect(alert.textContent?.length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading your enrollment…")).toBeNull();
  });
});
