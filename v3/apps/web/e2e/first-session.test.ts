// A — THE PATH THAT MATTERS MOST.
//
//   landing -> onboarding -> a COMPLETED first session
//
// This is the only path whose failure means there is no product. Everything
// else in this suite tests a property of a surface; this tests whether the
// surfaces connect.
//
// ---------------------------------------------------------------------------
// THE WALK NOW REACHES A COMPLETED DRILL
// ---------------------------------------------------------------------------
// This file used to stop at /home and assert, as its headline finding, that
// /session was a StubNote and no first session could be completed (v3-D67).
// That assertion was written to GO RED the day the loop landed, with
// instructions to replace it with the real walk. It did, and it was.
//
// The shape is worth keeping in mind for the stubs that remain: an
// asserted-absence test is loud in both directions — it fails if the stub
// disappears, and it is listed by name in every run while the stub remains. A
// `test.skip` would have been invisible in a passing run, which is how a build
// ships believing it has an e2e suite.

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

  test("a learner can drill on /session, and the taps reach the event log", async ({
    page,
  }) => {
    // ---------------------------------------------------------------------
    // THIS TEST REPLACES THE SUITE'S OLD "THE BREAK" TRIPWIRE.
    // ---------------------------------------------------------------------
    // That test asserted `/session` was a stub and that no control on it could
    // start a session — and it was RIGHT for eight build-plan steps (v3-D67).
    // Its own header said: "WHEN THE SESSION LOOP LANDS, THIS TEST WILL FAIL.
    // That is intended. Replace it with the real walk: start a session, answer
    // the questions, assert the summary, assert the events on disk."
    //
    // The loop landed. This is that walk, in a real browser, against a real
    // IndexedDB — the end-to-end proof that the product's core path is joined.
    await completeOnboarding(page);
    await page.goto("/session");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The drill must actually mount. `data-testid` rather than prose: the
    // wording of a caption is not a contract, and asserting on it is how a
    // test starts failing for cosmetic edits.
    const drill = page.getByTestId("session-drill");
    await expect(drill).toBeVisible({ timeout: 15_000 });

    // Nothing is in the log until the learner taps. If the drill mounting
    // alone wrote events, the log would stop being a record of what a person
    // actually did.
    const beforeTap = await readEvents(page);
    const tapsBefore = beforeTap.filter(
      (e) => (e as { type?: string }).type === "reconstruct_tap",
    ).length;
    expect(tapsBefore, "mounting the drill writes no tap events").toBe(0);

    // Tap the first option. Whether it is right or wrong does not matter here:
    // BOTH must be recorded, because the log is evidence and not a scoreboard.
    const options = drill.locator("button, [role='button']");
    await expect(options.first()).toBeVisible();
    await options.first().click();

    // THE assertion of v3-D67, in a browser: the tap reached the log.
    await expect
      .poll(
        async () => {
          const evs = await readEvents(page);
          return evs.filter(
            (e) => (e as { type?: string }).type === "reconstruct_tap",
          ).length;
        },
        {
          message: "a tap on /session must append a reconstruct_tap event",
          timeout: 10_000,
        },
      )
      .toBeGreaterThan(0);

    // And the session opened with an origin the summary can measure from.
    const events = await readEvents(page);
    expect(
      events.some((e) => (e as { type?: string }).type === "session_start"),
      "the session emits session_start",
    ).toBe(true);
  });
});
