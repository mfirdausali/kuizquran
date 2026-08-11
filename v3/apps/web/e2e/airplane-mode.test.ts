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
// THE EXIT CRITERION IS NOW MET
// ---------------------------------------------------------------------------
// THE HISTORY, KEPT DELIBERATELY. This file's headline finding used to be that
// there was NO SERVICE WORKER in this build — "not a stub, not a disabled one;
// no sw.js, no manifest, no registration anywhere in app/ or public/, and
// `navigator.serviceWorker.getRegistrations()` returns [] on every route." It
// split the offline story in two: a page ALREADY LOADED kept drilling with the
// radio off (real, and pinned by the three tests below), while any NAVIGATION
// offline — including a plain reload — died on ERR_INTERNET_DISCONNECTED,
// because there was no cached shell to serve.
//
// That second half was written as an asserted-absence, with instructions to
// replace it with the real offline walk the day a worker landed. It landed.
// This is that walk. (Same conversion, same reasoning, as first-session.test.ts
// when the session loop landed — see its header.)
//
// WHAT NOW SERVES THE SHELL: `public/sw.js`, registered by
// `components/shell/ServiceWorkerRegistrar.tsx` from the root layout. It
// precaches the staged corpora and the routes a learner cold-starts into,
// runtime-caches the hashed chunks, serves navigations network-first with a
// cached fallback, and — the rule with the sharpest teeth — passes /api
// straight through to the network, never caching it.
//
// ---------------------------------------------------------------------------
// THIS SUITE IS THE ONLY THING GUARDING sw.js
// ---------------------------------------------------------------------------
// `scripts/check-boundaries.mjs` SKIPs `public/` entirely and only walks
// .ts/.tsx/.mjs, so not one of its twelve clauses can see the service worker.
// The egress clause cannot check that /api is excluded; the sacred-text clause
// cannot check the corpus handling. Every invariant that file must honour is
// enforced HERE, in a real browser, or it is not enforced at all. Treat these
// assertions as load-bearing and do not weaken them to make a change pass.
//
// ---------------------------------------------------------------------------
// TWO TRAPS THAT COST REAL DEBUGGING, WRITTEN DOWN SO THEY ARE NOT RE-ENTERED
// ---------------------------------------------------------------------------
// 1. ASSERTING ON `h1` OFFLINE PROVES NOTHING. When the worker had no route
//    precache, a cold offline `/drill` fell back to the cached "/" document —
//    so the browser painted THE LANDING PAGE under the URL /drill, complete
//    with a perfectly visible `<h1>`, before hydration mismatched it into
//    "This page couldn't load". An h1 assertion passes on that. The drill's
//    own heading and `.drill-summary` are asserted instead, because they exist
//    only if the right document was served.
//
// 2. THE DOCUMENT ALONE DOES NOT HYDRATE. Precaching a route's HTML without
//    the hashed chunks it references yields a page with correct static markup
//    whose every client island is dead — and `.drill-summary` is island-
//    rendered, so it is exactly what distinguishes "served" from "working".
//    That is why the walk below asserts island output rather than page text.
//
// Both failures LOOKED like success. Neither would have been caught by a test
// that asserted the page merely loaded.

import { expect, test } from "@playwright/test";
import { completeOnboarding } from "./idb-helpers.test.ts";

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

  // -------------------------------------------------------------------------
  // THESE FOUR TESTS REPLACE THE SUITE'S OLD "UNMET EXIT CRITERION" TRIPWIRE.
  // -------------------------------------------------------------------------
  // That test asserted `getRegistrations()` was empty and that BOTH a reload
  // and a cold `goto('/drill')` offline REJECTED with ERR_INTERNET_DISCONNECTED
  // — and it was right for every build up to this one. Its own header said it
  // "will go red the day a service worker lands — at which point it should be
  // rewritten as the real offline walk". It went red. This is the walk.

  test("the service worker registers and takes control", async ({ page }) => {
    await page.goto("/drill");

    // `ready` rather than a bare `getRegistrations()` immediately after goto:
    // registration is async and kicked off from an effect, so asserting
    // synchronously is the flake, not the test.
    await page.evaluate(() => navigator.serviceWorker.ready);

    const registrations = await page.evaluate(() =>
      navigator.serviceWorker.getRegistrations().then((r) => r.length),
    );
    expect(registrations, "a service worker is registered").toBeGreaterThan(0);

    // Registered is not the same as CONTROLLING. `skipWaiting()` +
    // `clients.claim()` in sw.js are what make the worker effective within
    // this page's lifetime rather than parked in `waiting` until every tab
    // closes — and a worker in `waiting` caches nothing for the learner who
    // just installed it.
    expect(
      await page.evaluate(() => !!navigator.serviceWorker.controller),
      "the worker CONTROLS the page, not merely registered",
    ).toBe(true);
  });

  test("THE EXIT CRITERION: one online visit, then a cold offline drill", async ({
    page,
    context,
  }) => {
    // ---------------------------------------------------------------------
    // M5's "airplane-mode drill", as a learner actually lives it: open the app
    // once on wifi, close it, board a plane, open it again.
    // ---------------------------------------------------------------------
    // The single online visit is to "/" — NOT to /drill. That matters: it means
    // /drill has never been visited, so nothing can be serving it from a
    // runtime cache-on-navigate. It works only because sw.js precached the
    // route AND the chunks that hydrate it.
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Install's `waitUntil` precaching is not finished when `ready` resolves.
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const cache = await caches.open("iq3-shell-v1");
            return (await cache.keys()).length;
          }),
        { message: "the worker precaches the shell", timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    await context.setOffline(true);

    // THE ASSERTION THE OLD TEST INVERTED. This used to reject with
    // ERR_INTERNET_DISCONNECTED. It must now resolve.
    await page.goto("/drill", { timeout: 15_000 });

    // NOT `getByRole("heading")` — see trap 1 in this file's header. When the
    // fallback served the LANDING page under this URL, an h1 was present and
    // visible, and an h1 assertion called that a pass. This is the drill's own
    // heading, which exists only if the right document was served.
    await expect(
      page.getByRole("heading", { name: /chain a few ayat/i }),
      "the DRILL page was served offline — not the cached landing page under /drill",
    ).toBeVisible();

    // And the island HYDRATED. `.drill-summary` is rendered by the client
    // island from the real log, so it cannot appear unless the hashed chunks
    // were cached too (trap 2). This is the difference between a page that was
    // served and a drill that works.
    await expect(
      page.locator(".drill-summary"),
      "the drill island hydrated offline — the cached document alone is not enough",
    ).toBeVisible({ timeout: 15_000 });
  });

  test("a plain reload offline serves the same route, not a fallback page", async ({
    page,
    context,
  }) => {
    // The single most common thing a learner does, and the thing that used to
    // die on the dinosaur.
    await page.goto("/drill");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect(page.locator(".drill-summary")).toBeVisible();

    await context.setOffline(true);
    await page.reload({ timeout: 15_000 });

    // Same route, same surface. A reload that lands on the landing page is a
    // reload that lost the learner's place.
    await expect(page).toHaveURL(/\/drill$/);
    await expect(
      page.getByRole("heading", { name: /chain a few ayat/i }),
      "the reload served /drill itself",
    ).toBeVisible();
    await expect(page.locator(".drill-summary")).toBeVisible({ timeout: 15_000 });
  });

  test("the staged corpus is served from cache offline — ayat to actually drill", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const cache = await caches.open("iq3-shell-v1");
            return (await cache.keys()).filter((r) => r.url.includes("/corpus/")).length;
          }),
        { message: "the corpora are precached", timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    await context.setOffline(true);

    // A shell with no corpus is a drill with no ayat. Asserted on SHAPE and
    // COORDINATES only — `verses.length`, never a glyph. The sacred-text rule
    // holds in tests exactly as it holds in code, and `fetchCorpus`'s own
    // `usable()` check asserts the same way for the same reason.
    const corpus = await page.evaluate(async () => {
      try {
        const res = await fetch("/corpus/112.json");
        if (!res.ok) return { ok: false, verses: 0, words: 0 };
        const body = (await res.json()) as { verses?: unknown[]; words?: unknown[] };
        return {
          ok: true,
          verses: Array.isArray(body.verses) ? body.verses.length : 0,
          words: Array.isArray(body.words) ? body.words.length : 0,
        };
      } catch {
        return { ok: false, verses: 0, words: 0 };
      }
    });

    expect(corpus.ok, "the staged corpus resolves offline").toBe(true);
    expect(corpus.verses, "it carries real ayat, not an empty shell").toBeGreaterThan(0);
    expect(corpus.words, "and the words a reconstruct pass needs").toBeGreaterThan(0);
  });

  test("/api is NEVER answered from cache — a cached response would be stale truth", async ({
    page,
    context,
  }) => {
    // ---------------------------------------------------------------------
    // THE RULE WITH THE SHARPEST TEETH, AND THE ONE MOST EASILY WRITTEN
    // VACUOUSLY.
    // ---------------------------------------------------------------------
    // Invariant #2: the append-only event log is TRUTH. A cached API response
    // presents stale server state as truth, and a cached 200 on a sync pull
    // could mask un-synced local events — edge case #124's "events are ALWAYS
    // ingested", failing silently and unrecoverably.
    //
    // check-boundaries.mjs CANNOT enforce this: `public/` is in its SKIP set,
    // so clause 6 never sees sw.js. This test is the enforcement. Without it,
    // "never cache /api" is decoration.
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);

    // ---------------------------------------------------------------------
    // THE SETUP IS THE TEST. TWO EARLIER VERSIONS OF IT WERE VACUOUS.
    // ---------------------------------------------------------------------
    // Version 1 used a **POST**. Mutation-proved vacuous: deleting the `/api`
    // early-return from sw.js left it GREEN, because a POST never reaches the
    // /api rule — the very next line drops every non-GET. It was passing on a
    // guard it did not claim to test.
    //
    // Version 2 used a GET to a path that **404s**. Also vacuous: this app's
    // /api is served by a SEPARATE Laravel origin, so under `next start`
    // everything beneath /api is a 404, and no cache-first branch would store
    // a 404 anyway (`if (fresh.ok)`). There was never a cacheable response, so
    // "nothing was cached" was true no matter what the worker did.
    //
    // Version 3 tried `page.route("**/api/**")` to fake a 200. ALSO WRONG, and
    // for a subtle reason worth recording: Playwright's request interception
    // does NOT see requests issued by a service worker. The mutated worker
    // fetched straight past the fixture, the route never fired, and the test
    // failed on its own precondition rather than on the behaviour.
    //
    // Version 4 — this one — uses a REAL route that Next actually serves:
    // `app/api/e2e-cache-probe/route.ts`, which returns a cacheable 200 and
    // exists for no other purpose. A worker that cached API responses would
    // genuinely have this on disk by the time the radio goes off.
    //
    // ---------------------------------------------------------------------
    // WHAT THIS TEST DOES *NOT* PROVE — MEASURED, NOT ASSUMED (v3-D73)
    // ---------------------------------------------------------------------
    // An earlier version of this comment claimed "mutation testing confirms"
    // the assertions below can fail. THAT CLAIM WAS FALSE, and it was caught by
    // running the mutation rather than trusting the note: deleting
    // `if (url.pathname.startsWith("/api/")) return;` from sw.js entirely
    // leaves all 9 tests in this file GREEN.
    //
    // The reason is structural, and worth knowing before anyone "simplifies"
    // the worker. The /api early-return is DEFENCE IN DEPTH, not the
    // load-bearing guard. What actually keeps /api out of the cache is that
    // the cache-first branch is an ALLOWLIST — it matches only
    // `/_next/static/`, `/corpus/` and `/fonts/` — so an /api GET falls
    // through every branch to the final "leave it to the network" comment and
    // is never stored. Both guards would have to fail together.
    //
    // So this test proves THE RULE HOLDS (nothing under /api is ever cached,
    // read straight out of CacheStorage; an offline /api call fails rather
    // than being answered). It does NOT pin the early-return specifically, and
    // no test in this repo does. If someone widens the static branch to a
    // catch-all, the early-return becomes load-bearing and this test starts
    // earning its keep — which is exactly the scenario it should survive into.
    // A test that cannot fail today against one guard is still worth having
    // when it is the only thing standing behind the other.
    //
    // A GET, because the sync PULL is a GET and a cached pull is exactly the
    // "stale truth" failure: old server state presented as current, potentially
    // masking un-synced local events.
    const primed = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/e2e-cache-probe", { method: "GET" });
        return res.status;
      } catch {
        return 0;
      }
    });
    // The setup must actually have produced a cacheable 200, or the rest of
    // this test proves nothing. Asserting the PRECONDITION is what stops this
    // sliding back into version 2, where there was never anything to cache.
    expect(primed, "the primed /api call returned a cacheable 200").toBe(200);

    // ASSERTION 1 — nothing under /api ever entered the cache. Read straight
    // out of the CacheStorage rather than inferred from behaviour.
    const apiEntries = await page.evaluate(async () => {
      const names = await caches.keys();
      const found: string[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          if (new URL(request.url).pathname.startsWith("/api/")) found.push(request.url);
        }
      }
      return found;
    });
    expect(apiEntries, "no /api response is in any cache").toEqual([]);

    await context.setOffline(true);

    // ASSERTION 2 — offline, an /api call FAILS rather than being answered.
    // A worker that fell back to cache for /api would resolve here. Failing is
    // the CORRECT behaviour: sync is local-first, has its own outbox, and
    // never blocks the session (#103). A learner drills on regardless — which
    // the three tests above this one prove independently.
    const offlineResult = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/e2e-cache-probe", { method: "GET" });
        return `RESOLVED ${res.status}`;
      } catch {
        return "REJECTED";
      }
    });
    expect(
      offlineResult,
      "an offline /api call reaches the network and fails, rather than being served a stale cached body",
    ).toBe("REJECTED");
  });

  test("offline, an onboarded learner opening '/' still lands on /home", async ({
    page,
    context,
  }) => {
    // ---------------------------------------------------------------------
    // EDGE CASE #92, WHICH THIS FEATURE MADE REACHABLE FOR THE FIRST TIME.
    // ---------------------------------------------------------------------
    // "PWA start_url bypasses middleware; offline serves cached '/' →
    //  onboarded user sees marketing page."
    //
    // Before sw.js there was no cached "/" and the scenario could not occur.
    // Caching the shell CREATES it: the worker answers the navigation before
    // the network is asked, so Next middleware never runs and cannot redirect.
    // `components/shell/OnboardedSteer.tsx` was written in anticipation of
    // exactly this, and its header says so — but it had never been exercised
    // against a genuinely cached document, because none existed.
    //
    // So this asserts the steering survives the mechanism that needs it. A
    // learner who has onboarded must never be shown the page selling them the
    // app they already installed.
    await completeOnboarding(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const cache = await caches.open("iq3-shell-v1");
            return (await cache.keys()).length;
          }),
        { message: "the shell is cached before we go offline", timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    await context.setOffline(true);
    await page.goto("/", { timeout: 15_000 });

    // The document came from the cache; the steering ran inside it and moved
    // the learner. IndexedDB is truth, and it is local, so it is readable with
    // the radio off.
    await page.waitForURL("**/home", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/home$/);
  });
});
