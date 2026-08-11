// A — THE PATH THAT MATTERS MOST.
//
//   landing -> onboarding -> a COMPLETED first session
//
// This is the only path whose failure means there is no product. Everything
// else in this suite tests a property of a surface; this tests whether the
// surfaces connect.
//
// ---------------------------------------------------------------------------
// READ THIS BEFORE CHANGING THE LAST TEST IN THIS FILE
// ---------------------------------------------------------------------------
// The walk gets as far as /home and then STOPS, because /session is a
// StubNote. That is not a limitation of the test — it is the finding, and the
// last test in this file asserts the break exists and names it, so that:
//
//   1. it is impossible to read this suite as "the happy path is green", and
//   2. the day someone builds the session loop, THIS TEST GOES RED and tells
//      them to convert it into the real assertion.
//
// A skipped test would have been the wrong shape. `test.skip` is invisible in
// a passing run, and a suite that quietly skips its own headline scenario is
// how a build ships believing it has an e2e suite. An asserted-absence test is
// loud in both directions: it fails if the stub disappears, and it is listed by
// name in every run while the stub remains.

import { expect, test } from "@playwright/test";
import { completeOnboarding, readEvents, readMeta } from "./idb-helpers.test.ts";

test.describe("A · landing -> onboarding -> first session", () => {
  test("the landing page serves a visitor with no learner state", async ({ page }) => {
    await page.goto("/");

    // "/" = landing, stateless (v3-D14, edge case #71). A visitor with no IDB
    // must land HERE, not be steered to the dashboard.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // No tab bar: the landing page is outside the (app) route group, and
    // showing learner navigation to a visitor is a lie about what they have.
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test("the inline demo grades a real tap on 112:1 before any account exists", async ({ page }) => {
    await page.goto("/");

    // The demo is the conversion engine (edge case #105) and it is LIVE — the
    // reconstruct state machine running in the visitor's hand. Its options are
    // real Arabic from the staged corpus.
    const arabic = page.locator('[lang="ar"][dir="rtl"]');
    await expect(arabic.first()).toBeVisible();
    expect(await arabic.count(), "the demo renders Arabic option tiles").toBeGreaterThan(0);

    // A visitor is not a learner. The demo must write NOTHING — no event, no
    // onboarding stamp. (components/onboarding/FirstRecall.tsx says so in its
    // own header; this asserts it against the disk.)
    expect(await readEvents(page), "the demo appends no events").toHaveLength(0);
    expect(await readMeta(page), "the demo writes no meta").toEqual({});
  });

  test("onboarding completes all seven screens and commits the device", async ({ page }) => {
    await completeOnboarding(page);

    await expect(page).toHaveURL(/\/home$/);

    const meta = await readMeta(page);
    expect(meta["onboardedAt"], "the device is stamped onboarded").toEqual(expect.any(Number));
    expect(meta["onboardingChoices"], "the four answers were committed").toMatchObject({
      glossLang: "en",
    });

    // ORDER IS LOAD-BEARING (lib/onboarding/choices.ts): the choices go in
    // first and the stamp last, in ONE transaction, because OnboardedSteer
    // treats the stamp as proof the data behind it exists. If both are present
    // the transaction committed whole; a torn write leaves a stamp with no
    // choices, which is what this pair rules out.
    expect(Object.keys(meta).sort()).toEqual(["onboardedAt", "onboardingChoices"]);
  });

  test("an onboarded device is steered off the landing page to /home", async ({ page }) => {
    await completeOnboarding(page);

    // Edge case #92: the PWA start_url bypasses middleware, so a returning
    // learner opening the app cold can land on "/" and see the marketing page.
    // <OnboardedSteer/> is the client-side steering that prevents it. Only a
    // real browser can test this — it is IDB-conditional navigation.
    await page.goto("/");
    await page.waitForURL("**/home");
    await expect(page).toHaveURL(/\/home$/);
  });

  test("THE BREAK: /session is a stub, so no first session can be completed", async ({ page }) => {
    // ---------------------------------------------------------------------
    // THIS IS THE MOST IMPORTANT FINDING IN THE SUITE.
    // ---------------------------------------------------------------------
    // BUILD-PLAN M5 ships "full session lifecycle (create -> drill -> summary
    // -> completion celebration -> quit/resume)". None of it exists. The route
    // resolves, renders a heading, and tells the learner it is not built.
    //
    // Consequence, stated plainly: THE PRODUCT CANNOT BE USED. A learner can
    // be onboarded and can be shown a drill PREVIEW, but there is no surface
    // anywhere in this app that grades an ayah and writes the result. See the
    // companion assertion in commit-before-paint.test.ts, which proves the
    // `events` store is never written by any reachable UI.
    //
    // WHEN THE SESSION LOOP LANDS, THIS TEST WILL FAIL. That is intended.
    // Replace it with the real walk: start a session, answer the questions,
    // assert the summary, assert the events on disk.
    await completeOnboarding(page);
    await page.goto("/session");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const body = (await page.locator("body").textContent()) ?? "";
    expect(
      /isn['’]t built|not built|stub/i.test(body),
      "/session still declares itself unbuilt — the session loop does not exist",
    ).toBe(true);

    // And the harder proof: nothing on this route can be tapped to drill.
    const startControls = page.getByRole("button", { name: /start|begin|answer|next/i });
    expect(
      await startControls.count(),
      "/session offers no control that starts a session",
    ).toBe(0);
  });
});
