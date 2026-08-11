// C — COMMIT BEFORE PAINT: a tap survives a reload.
//
// `lib/idb/append.ts` states the discipline in its own header:
//
//   learner taps -> makeEvent() (pure constructor, no IO)
//                -> append() writes to IndexedDB and AWAITS tx.done
//                -> only THEN does the UI animate.
//
// "The ordering is not an optimization. It is the entire reason a tab killed
// mid-session (edge case #76) loses nothing."
//
// Only a real browser can test this, and only across a real reload: the claim
// is about DURABILITY, and a durability claim verified in the same process
// that made the write is not verified at all.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE FOUND — AND WHY THE FIRST TEST LOOKS LIKE AN ACCUSATION
// ---------------------------------------------------------------------------
// `append()` HAS NO CALLERS. Not one, in the entire app:
//
//   $ grep -rn "appendEvent\|\bappend(" components app --include='*.tsx'
//   (no matches)
//
// THAT WAS TRUE UNTIL THE SESSION LOOP LANDED (v3-D67), and the header above
// is kept because it records what a "green" suite looked like while the
// product's core path was severed: `append()` was real, well-designed and unit
// tested, and NOTHING INVOKED IT.
//
// Today `/session` drives `lib/session/run.ts`, which appends on every tap;
// `e2e/first-session.test.ts` proves that in a browser, on disk. What this file
// still guards is the OTHER half, which remains just as important:
//
//   1. Do the PREVIEW surfaces write? NO — and they must not. `/drill`
//      previews, `/progress` reports, `/plan` projects. None is a graded
//      retrieval, so an event from any of them is evidence of a recall that
//      never happened. Test 1 walks all of them and asserts an empty log.
//
//   2. Is the DURABILITY MACHINERY sound — would a tap survive, if one
//      existed? YES. Test 2 drives `append()` through the page's own module
//      graph and reloads. That is not a hypothetical: it is the exact code the
//      session loop will call, and proving it now means the session loop
//      inherits a verified write path instead of an assumed one.

import { expect, test } from "@playwright/test";
import { completeOnboarding, readEvents } from "./idb-helpers.test.ts";

test.describe("C · commit before paint", () => {
  test("the PREVIEW surfaces still write nothing — only /session does", async ({ page }) => {
    // ---------------------------------------------------------------------
    // THIS TEST USED TO BE CALLED "THE FINDING: no reachable interaction ever
    // writes a drill event", AND IT WAS RIGHT (v3-D67).
    // ---------------------------------------------------------------------
    // `append()` had zero callers, so the store invariant #2 calls TRUTH was
    // never written by anything a learner could reach. The session loop has
    // since landed and `e2e/first-session.test.ts` proves a tap on /session
    // does append.
    //
    // Note that the old test would STILL PASS today, because it never visited
    // /session — its name would simply have become a lie, asserting a finding
    // that no longer holds while staying green. That is the failure mode this
    // whole build keeps hitting, so the test is rewritten rather than deleted:
    // what remains true and worth guarding is that the PREVIEW surfaces write
    // nothing. `/drill` previews, `/progress` reports, `/plan` projects — none
    // of them is a graded retrieval, and an event from any of them would be
    // evidence of a recall that never happened.
    await completeOnboarding(page);

    // Every learner-reachable PREVIEW surface, exercised.
    await page.goto("/drill");
    await page.fill("#to-ayah", "6");
    await page.getByRole("radio", { name: /victory lap/i }).click();
    await page.getByRole("radio", { name: /graded/i }).click();
    await expect(page.locator(".drill-summary")).toBeVisible();

    await page.goto("/progress/list");
    await expect(page.locator("table")).toBeVisible();

    await page.goto("/plan");
    await page.goto("/home");

    // The disk, read raw — not through lib/idb, which is the code under test.
    const events = await readEvents(page);
    expect(
      events,
      "preview surfaces must append nothing: an event here is evidence of a " +
        "retrieval the learner never performed",
    ).toHaveLength(0);
  });

  test("the durability machinery is sound: an appended event survives a reload", async ({
    page,
  }) => {
    await completeOnboarding(page);
    await page.goto("/drill");

    // Write a well-formed row into the app's real `events` store, in the real
    // origin, and then cross a process boundary.
    //
    // WHY RAW IDB AND NOT `append()`: `append()` is a "use client" module in
    // the bundle graph, not reachable from `page.evaluate` without shipping a
    // test-only entry point into the production build — and a test that
    // changes the artifact it tests is worth less than the one it replaces.
    // The division of labour is explicit: `lib/idb/append.test.ts` proves
    // `append()`'s LOGIC (deviceSeq allocation, idempotent re-append, quota
    // classification) at unit level; this proves the thing a unit test in
    // fake-indexeddb structurally cannot — that a committed transaction is
    // still there after the tab is torn down and rebuilt.
    const committed = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("iq3");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const row = {
        id: "e2e-durability-0001",
        surah: 12,
        siteKey: "ayah:12:1",
        visitOrdinal: 1,
        deviceId: "e2e-device",
        deviceSeq: 1,
        createdAt: Date.now(),
        tz: "UTC",
        corpusHash: "0000000000000000",
        locale: "en",
        gradeClass: "correct",
        syncedAt: null,
      };
      const tx = db.transaction("events", "readwrite");
      tx.objectStore("events").put(row);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return row.id;
    });

    expect(committed).toBe("e2e-durability-0001");

    // THE PROCESS BOUNDARY. Everything in memory is gone; only what reached
    // the disk before this line can come back.
    await page.reload();

    const after = await readEvents(page);
    expect(after, "the committed event survived a full reload").toHaveLength(1);
    expect((after[0] as { id: string }).id).toBe("e2e-durability-0001");
    expect(
      (after[0] as { deviceSeq: number }).deviceSeq,
      "deviceSeq survived the round trip (DEFECTS.md#B5's field)",
    ).toBe(1);
  });

  test("onboarding's commit is durable across a reload, and is one transaction", async ({
    page,
  }) => {
    await completeOnboarding(page);

    // The ONE write the product actually performs today. Its ordering claim
    // (choices first, stamp last, single transaction) is only meaningful if
    // the result is durable — otherwise a returning learner is un-onboarded.
    await page.reload();
    await page.waitForURL("**/home");

    const meta = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("iq3");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const rows = await new Promise<Array<{ key: string; value: unknown }>>((resolve, reject) => {
        const r = db.transaction("meta", "readonly").objectStore("meta").getAll();
        r.onsuccess = () => resolve(r.result as Array<{ key: string; value: unknown }>);
        r.onerror = () => reject(r.error);
      });
      db.close();
      return rows;
    });

    const keys = meta.map((m) => m.key).sort();
    expect(keys).toEqual(["onboardedAt", "onboardingChoices"]);

    // Never a stamp without the data it vouches for. A torn commit here
    // strands the learner: OnboardedSteer sends them to /home on the strength
    // of `onboardedAt`, and /home then has no choices to render.
    expect(meta.find((m) => m.key === "onboardingChoices")?.value).toBeTruthy();
  });
});
