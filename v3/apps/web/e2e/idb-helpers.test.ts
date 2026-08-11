// SHARED DRIVERS for the e2e suite.
//
// Two things live here, and nothing else: the onboarding walk (four files
// need a learner who exists) and a reader that opens the app's real IndexedDB
// from inside the page.
//
// ---------------------------------------------------------------------------
// THE IDB READER IS DELIBERATELY HAND-ROLLED
// ---------------------------------------------------------------------------
// It does NOT import `lib/idb`. That is the point: `lib/idb` is the code under
// test, and a test that reads through its subject cannot detect a subject that
// writes nothing. If `append()` silently no-ops, a reader built on
// `getAllEvents()` returns [] and a reader built on raw `indexedDB.open` also
// returns [] — but only the raw one is still telling the truth about the DISK
// rather than about the module's own bookkeeping.
//
// So these functions speak the store names as literals. If a schema migration
// renames a store, these break loudly, which is the correct outcome for a test
// that claims to know what is on disk.

import { expect, type Page } from "@playwright/test";

/** Must match lib/idb/schema.ts DB_NAME. Written as a literal on purpose — see
 *  the header. A rename here is a schema change, and a schema change should
 *  make an on-disk assertion fail until someone looks at it. */
export const DB_NAME = "iq3";

/** Every row in the `events` store, read straight out of IndexedDB. */
export async function readEvents(page: Page): Promise<unknown[]> {
  return page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!db.objectStoreNames.contains("events")) {
      db.close();
      return [];
    }
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const r = db.transaction("events", "readonly").objectStore("events").getAll();
      r.onsuccess = () => resolve(r.result as unknown[]);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return rows;
  }, DB_NAME);
}

/** The whole `meta` key/value store as a plain object. */
export async function readMeta(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!db.objectStoreNames.contains("meta")) {
      db.close();
      return {};
    }
    const rows = await new Promise<Array<{ key: string; value: unknown }>>((resolve, reject) => {
      const r = db.transaction("meta", "readonly").objectStore("meta").getAll();
      r.onsuccess = () => resolve(r.result as Array<{ key: string; value: unknown }>);
      r.onerror = () => reject(r.error);
    });
    db.close();
    const out: Record<string, unknown> = {};
    for (const row of rows) out[row.key] = row.value;
    return out;
  }, DB_NAME);
}

/**
 * Screen 2's live reconstruct of Al-Ikhlas 112:1, driven to completion.
 *
 * WHY IT SEARCHES RATHER THAN KNOWS THE ANSWER: the correct word is not
 * knowable to this file. Writing it here would be authoring Quranic Arabic as
 * a literal, which v3/CLAUDE.md forbids absolutely. So the driver taps options
 * until the blank counter advances, and dismisses the "Try again" state when
 * it does not. The engine grades; the test only observes whether it advanced.
 *
 * That constraint turns out to be a feature: a driver that cannot know the
 * answer is a driver that proves the OPTIONS CONTAIN one. If a compiler defect
 * ever emitted a bank with no correct member, every tap would be wrong and
 * this loop would exhaust — a failure mode a hardcoded answer would hide.
 */
export async function completeFirstRecall(page: Page): Promise<void> {
  const counterText = () =>
    page.evaluate(() => document.body.textContent?.match(/blank \d+ \/ \d+/)?.[0] ?? null);

  for (let guard = 0; guard < 40; guard++) {
    const before = await counterText();
    if (before === null) return; // reconstruct is done

    const options = await page.locator("button:visible").all();
    let moved = false;

    for (const option of options) {
      const label = (await option.textContent())?.trim() ?? "";
      if (label === "Try again" || label === "Continue") continue;

      await option.click();
      const retry = page.getByRole("button", { name: "Try again" });
      if ((await retry.count()) > 0) {
        await retry.click();
        continue; // wrong word — the engine said so; try the next one
      }
      moved = true;
      break;
    }

    if (!moved) {
      throw new Error(
        `first-recall stalled at "${before}": every visible option graded WRONG. ` +
          `The option bank for this blank contains no correct answer.`,
      );
    }
  }
  throw new Error("first-recall did not finish within 40 taps");
}

/**
 * Walk all seven onboarding screens and land on /home with a committed device.
 *
 * Each screen is driven by the ACCESSIBLE NAME of its control, never by DOM
 * position. An earlier probe of this flow clicked "the last visible button" and
 * silently walked BACKWARDS at screen 3, where "Back" is last — passing through
 * the flow without ever reaching the end. Role+name is the fix, and it is also
 * a free a11y assertion: a control Playwright cannot address by name is a
 * control a screen reader cannot announce.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  await page.goto("/start");

  // 1 — the promise
  await page.getByRole("button", { name: "Show me" }).click();

  // 2 — first recall: read, then rebuild 112:1 from nothing
  await page.getByRole("button", { name: "I've read it" }).click();
  await completeFirstRecall(page);
  await page.getByRole("button", { name: "Continue" }).click();

  // 3 — gloss language (choosing advances; there is no separate Next)
  await page.getByRole("button", { name: "English" }).click();

  // 4 — placement. "Skip" keeps the walk deterministic: the other branch asks a
  // recall question whose answer this file is forbidden to know.
  await page.getByRole("button", { name: /skip|not sure/i }).first().click();

  // 5 — surah, 6 — pace: both keep their default and advance
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // 7 — commit. This is the ONE write in the whole flow (lib/onboarding
  // /choices.ts#commitOnboarding), and it is what makes the device onboarded.
  await page.getByRole("button", { name: "Start my first session" }).click();

  await page.waitForURL("**/home");
  const meta = await readMeta(page);
  expect(meta["onboardedAt"], "onboarding committed onboardedAt to IndexedDB").toBeTruthy();
}
