// A REAL SECOND TAB racing for the write lock (edge case #75), not a mock of
// one.
//
// `lib/idb/writeLock.ts`'s own history (v3-D70) is a cautionary tale about
// exactly this gap: the fallback-vs-Web-Locks race that made writing
// STRUCTURALLY IMPOSSIBLE went unnoticed through eight build-plan steps
// because nothing exercised `acquire()` against a real Web Locks grant — only
// `forceForTests`, which sets status directly and never runs the real
// acquisition path at all. `lib/idb/writeLock.test.ts`'s own "acquire()
// against a real Web Locks implementation (v3-D70)" `describe` block closed
// THAT gap, but with a single in-process STUB of `navigator.locks` — one
// `held: true` case never resolves its callback, so it proves a tab can
// settle as `reader` without hanging, but it can never prove the OTHER half
// of the contract: `WriteLock.release()`'s own "a queued tab is promoted
// without a reload" (v3-D93), which depends on a SECOND, independent
// `navigator.locks.request()` call — from a genuinely separate JS execution
// context — still being queued in the real browser's lock manager when the
// first one releases.
//
// `test/sync-trigger.test.tsx`'s own `beforeEach` forces writer role for
// every test in the file, and `components/session/SessionIsland.tsx`'s own
// subscribe-for-later-promotion effect (v3-D93) has never been driven by two
// actual tabs of the actual app. DECISIONS.md v3-D365/D366/D367 each named
// this exact gap — "the Playwright e2e suite's own lack of a genuine two-tab
// write-lock scenario" — as genuinely unswept, across several consecutive
// nights, without anyone taking it on. This file takes it on.
//
// Two `Page`s opened from the SAME `BrowserContext` share one storage
// partition — one IndexedDB, and critically, one real `navigator.locks`
// manager — exactly like two tabs of one browser profile. That is what makes
// this a genuine two-tab test rather than a second mock.

import { expect, test } from "@playwright/test";
import { completeOnboarding, readEvents } from "./idb-helpers.test.ts";

test.describe("two real tabs racing for the write lock (edge case #75)", () => {
  test("a second tab reads as not-writer while the first holds the session, then is promoted without a reload when the first tab closes", async ({
    page,
    context,
  }) => {
    await completeOnboarding(page);

    // Tab 1 opens /session first — uncontended, so it must become the writer.
    await page.goto("/session");
    const firstDrill = page.getByTestId("session-drill");
    await expect(firstDrill).toBeVisible({ timeout: 15_000 });

    // Tab 2 — a genuinely separate page in the SAME context, so it shares
    // tab 1's IndexedDB and its real `navigator.locks` manager.
    const second = await context.newPage();
    await second.goto("/session");

    // Tab 1 already holds the lock, so tab 2 must settle as reader: the exact
    // copy `SessionIsland.tsx` renders for `phase.kind === "not-writer"`.
    const notWriterMessage = second.getByText(
      "This session is open in another tab. Continue there, or close it and reload this page.",
    );
    await expect(notWriterMessage).toBeVisible({ timeout: 10_000 });

    // A reader tab must not mount the drill — there is nothing here for it to
    // commit through while another tab holds the session.
    await expect(second.getByTestId("session-drill")).toHaveCount(0);

    // Tab 2 must not have been able to write anything while it was a reader.
    const whileReader = await readEvents(second);
    const tapsWhileReader = whileReader.filter(
      (e) => (e as { type?: string }).type === "reconstruct_tap",
    ).length;
    expect(tapsWhileReader, "a reader tab commits nothing").toBe(0);

    // Closing tab 1 releases the real Web Lock. `WriteLock.release()`'s own
    // contract is promotion WITHOUT a reload — tab 2's own still-queued
    // `navigator.locks.request()` call (not a new one) is what the browser
    // grants next, and `SessionIsland.tsx`'s writeLock subscription is what
    // turns that grant into `beginAsWriter()`. No `second.reload()` anywhere
    // below: a test that reloaded to get here would prove only that a FRESH
    // `acquire()` succeeds once nothing contends it, not that the promotion
    // path works.
    await page.close();

    const secondDrill = second.getByTestId("session-drill");
    await expect(secondDrill).toBeVisible({ timeout: 10_000 });
    await expect(notWriterMessage).toHaveCount(0);

    // The strongest proof of genuine promotion is not the UI text but the
    // commit path actually opening: tab 2 must be able to append an event
    // now, through the identical write-lock-gated path tab 1 used.
    const options = secondDrill.locator("button, [role='button']");
    await expect(options.first()).toBeVisible();
    await options.first().click();

    await expect
      .poll(
        async () => {
          const evs = await readEvents(second);
          return evs.filter((e) => (e as { type?: string }).type === "reconstruct_tap").length;
        },
        {
          message: "the promoted tab must be able to commit a tap, exactly like the original writer",
          timeout: 10_000,
        },
      )
      .toBeGreaterThan(0);
  });
});
