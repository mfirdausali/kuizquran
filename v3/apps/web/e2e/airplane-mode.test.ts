// B — THE AIRPLANE-MODE DRILL.
//
// BUILD-PLAN M5 Exit criteria, verbatim: "full-Yusuf offline session e2e;
// airplane-mode drill; Lighthouse >=95 + human VoiceOver/NVDA pass booked".
//
// This is not a nice-to-have. The whole product promise is that memorisation
// works on a plane, on a commute, in a masjid basement — the risk register
// (#17) puts it as "never block drilling on network", and #33 assumes a
// service worker serving the shell.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE FOUND
// ---------------------------------------------------------------------------
// There is NO SERVICE WORKER in this build. Not a stub, not a disabled one —
// no sw.js, no manifest, no registration anywhere in app/ or public/, and
// `navigator.serviceWorker.getRegistrations()` returns [] on every route.
//
// So the offline story splits cleanly in two, and this file asserts both
// halves rather than reporting a single verdict:
//
//   WORKS — a page ALREADY LOADED keeps working with the radio off. The
//     client islands are hydrated, IndexedDB is local, and the engine runs in
//     the tab. This is real and it is worth pinning: it proves the local-first
//     architecture underneath is sound, and that nothing in the drill path
//     secretly reaches for the network mid-interaction.
//
//   FAILS — any NAVIGATION offline dies on ERR_INTERNET_DISCONNECTED,
//     including a plain reload. There is no cached shell to serve. A learner
//     who opens the app on a plane gets the browser's dinosaur.
//
// The second half is the M5 exit criterion, and it is NOT met. The test that
// asserts it is written as an asserted-absence (see first-session.test.ts for
// why that shape and not `test.skip`) and will go red the day a service worker
// lands — at which point it should be rewritten as the real offline walk.

import { expect, test } from "@playwright/test";

test.describe("B · airplane mode", () => {
  test("a hydrated drill picker keeps working with the radio off", async ({ page, context }) => {
    // Load online, then pull the plug. This is the "already in the app when the
    // plane took off" case, and it is the half that works.
    await page.goto("/drill");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".drill-summary")).toBeVisible();

    await context.setOffline(true);

    // Interact with the island. `buildDrillPreview` runs the real engine over
    // the real log; if any of that path reached for the network it would hang
    // or throw here.
    await page.fill("#to-ayah", "4");
    const summary = page.locator(".drill-summary");
    await expect(summary).toContainText("4 ayat");

    // The honest denominator, computed offline (edge case: the preview must
    // state what is SKIPPED before the run, not after).
    await expect(summary).toContainText(/ready/);

    // And the engine is genuinely deciding, not echoing: the consequence label
    // is `preview.consequenceLabel`, computed in lib/ from the mode radio.
    await expect(summary).toContainText("Slips will lower your strength.");
    await page.getByRole("radio", { name: /victory lap/i }).click();
    await expect(summary).toContainText(/Nothing can be damaged/);
  });

  test("IndexedDB is fully available offline — the log is local truth", async ({
    page,
    context,
  }) => {
    await page.goto("/drill");
    await context.setOffline(true);

    // Invariant #2: the event log is truth. Truth that needs a network is not
    // truth a learner on a plane can add to.
    const stores = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("iq3");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const names = [...db.objectStoreNames];
      db.close();
      return names;
    });

    expect(stores.sort()).toEqual(["atoms", "corpus", "events", "meta", "sessions"]);
  });

  test("the landing demo's Arabic survives going offline mid-tap", async ({ page, context }) => {
    await page.goto("/");
    const arabic = page.locator('[lang="ar"][dir="rtl"]');
    await expect(arabic.first()).toBeVisible();
    const countOnline = await arabic.count();

    await context.setOffline(true);

    // The corpus was fetched into the island before the radio went off. The
    // sacred text must not vanish or degrade when the network does — a blank
    // where an ayah was is the worst possible offline failure on this surface.
    expect(await arabic.count()).toBe(countOnline);
    await expect(arabic.first()).toBeVisible();
    await expect(page.locator("body")).toContainText(/blank \d+ \/ \d+/);
  });

  test("THE UNMET EXIT CRITERION: no service worker, so offline navigation dies", async ({
    page,
    context,
  }) => {
    // ---------------------------------------------------------------------
    // M5's "airplane-mode drill" exit criterion is NOT MET.
    // ---------------------------------------------------------------------
    await page.goto("/drill");

    const registrations = await page.evaluate(() =>
      navigator.serviceWorker.getRegistrations().then((r) => r.length),
    );
    expect(
      registrations,
      "no service worker is registered — there is no cached shell to serve offline",
    ).toBe(0);

    await context.setOffline(true);

    // A plain reload — the single most common thing a learner does — fails.
    await expect(
      page.reload({ timeout: 8000 }),
      "reloading offline fails: nothing caches the app shell",
    ).rejects.toThrow(/ERR_INTERNET_DISCONNECTED|net::/);

    // And so does opening the drill route cold, which is the actual criterion.
    await expect(
      page.goto("/drill", { timeout: 8000 }),
      "navigating to /drill offline fails — the airplane-mode drill is unreachable",
    ).rejects.toThrow(/ERR_INTERNET_DISCONNECTED|net::/);
  });
});
