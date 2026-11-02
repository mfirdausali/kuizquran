/**
 * @vitest-environment jsdom
 */

// TEST GATE — the `/test` route guard's own enrollment read.
//
// `TestGate` is `SessionGate`'s structural twin: it reads the enrollment via
// the same `readChoices()` call with NO try/catch, so the same real,
// reachable `IdbOpenError` (blocked version upgrade, quota, private mode)
// leaves it stuck on `{kind:"loading"}` — "Loading your enrollment…" —
// forever. See test/session-gate.test.tsx for the full defect writeup; this
// file proves the identical gap exists here too and that the identical fix
// closes it.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { DB_NAME, openDb, resetDbForTests, writeLock } from "@/lib/idb";
import { TestGate } from "@/components/test/TestGate";

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

describe("TestGate surfaces a real enrollment-read failure instead of hanging forever", () => {
  it("a genuine VersionError on open reaches an alert, never an eternal 'Loading your enrollment…'", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 99);
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    render(<TestGate />);

    const alert = await waitFor(() => screen.getByRole("alert"), { timeout: 2000 });
    expect(alert.textContent?.length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading your enrollment…")).toBeNull();
  });
});
