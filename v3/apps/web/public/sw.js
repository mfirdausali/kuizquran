/* eslint-disable */
// THE SERVICE WORKER — M5's "airplane-mode drill", the half that was missing.
//
// BUILD-PLAN M5 exit criteria, verbatim: "full-Yusuf offline session e2e;
// airplane-mode drill; Lighthouse >=95 + human VoiceOver/NVDA pass booked".
// Risk register #17: "never block drilling on network". Edge case #33 assumes
// a service worker serving the shell.
//
// e2e/airplane-mode.test.ts already proved the hard half was DONE before this
// file existed: a page that is ALREADY HYDRATED keeps drilling with the radio
// off, because the log is IndexedDB and the engine runs in the tab. Nothing in
// the drill path reaches for the network mid-interaction. The local-first
// architecture was sound; what was missing was only a cached shell, so any
// NAVIGATION offline — including a plain reload — died on the dinosaur.
//
// This file is that cached shell and nothing more. It does not sync, it does
// not fold, it does not decide anything about a learner. It answers one
// question: when the browser asks for a document and there is no network, is
// there something to give it.
//
// ===========================================================================
// WHY THIS IS HAND-WRITTEN AND LIVES IN public/
// ===========================================================================
// TWO CONSTRAINTS, EACH OF WHICH ALONE FORCES THIS PLACEMENT.
//
// 1. SCOPE. A service worker may only intercept requests at or below its own
//    URL's path. This worker must intercept navigations to "/", "/home",
//    "/drill" and "/session" — i.e. origin scope. Served from `public/`, it is
//    at `/sw.js` and gets `/` for free. The Next PWA guide's bundler form,
//    `register(new URL('../lib/service-worker.js', import.meta.url))`, emits
//    the worker under `/_next/static/...`, which can only claim `/` if the
//    server sends a `Service-Worker-Allowed: /` header on it — more moving
//    parts, for nothing gained.
//
// 2. THE EGRESS GATE. `scripts/check-boundaries.mjs` clause 6 forbids any
//    `fetch(` whose target mentions `/api/` outside `lib/sync/apiFetch.ts`,
//    because a second un-wrapped API call is exactly how DEFECTS.md#B8 comes
//    back. This file must NAME `/api/` — refusing to cache it is its whole
//    contract — and a cache-first branch calls `fetch`. Authored under `lib/`
//    it would fail the build. `public/` is in the gate's SKIP set.
//
// THAT SECOND POINT CUTS BOTH WAYS, AND IT IS THE MOST IMPORTANT THING TO KNOW
// ABOUT THIS FILE: because `public/` is skipped, NO GATE CAN SEE THIS CODE.
// Not the sacred-text clause, not the egress clause, not one of the twelve. So
// every rule this worker must honour — above all the /api rule — is enforced
// by e2e assertions in `e2e/airplane-mode.test.ts` instead, in a real browser
// against a real worker. If you change this file, that suite is the only thing
// standing between you and a silent regression. Do not weaken it.
//
// No Serwist, no Workbox: adding one is a lockfile change, and BUILD-PLAN
// reserves lockfile changes to the spine lane. The behaviour needed here is
// ~80 lines.
//
// ===========================================================================
// WHY THE SHELL IS RUNTIME-CACHED AND NOT PRECACHED
// ===========================================================================
// Next 16 emits CONTENT-HASHED chunks (`085vyhwkt0mfc.js`), and the BUILD_ID
// changes every build. A hand-written precache list naming those files would
// be stale the moment anyone runs `next build` — and stale in the worst way:
// `addAll` would reject on the missing URLs, install would fail, and the app
// would silently have no worker at all. Generating the list at build time
// means new build plumbing.
//
// So the shell is cached AS IT IS FETCHED. The first online visit populates
// the cache with exactly the chunks that visit needed, under whatever names
// this build gave them. Nothing can go stale because nothing is named.
//
// The CORPORA are the opposite case and are genuinely precached: `/corpus/
// 112.json` is a STABLE url, and a learner who installs the app and boards a
// plane before ever opening a drill would otherwise have no ayat at all
// (edge case #91). Which surahs those are is read at install time from
// `/corpus/staged.json`, emitted by `scripts/stage-corpus.mjs` from what it
// actually wrote. It is NOT hardcoded here: `[112, 103, 67]` already exists in
// `lib/corpus/client.ts` and in that script, with a test binding the two,
// because they drifted once and dead-ended every learner who took onboarding's
// default surah. A third copy here would re-open that hole one layer further
// down, where nobody looks.

/** Bump to evict everything from older workers. The activate handler deletes
 *  every cache whose name is not this one, so a bad cache can never become
 *  permanent — which matters because a service worker outlives a deploy. */
const CACHE = "iq3-shell-v1";

/** Where the staging script records which corpora reached `public/corpus/`. */
const STAGED_MANIFEST = "/corpus/staged.json";

/** Assets that exist under stable names in every build. Amiri is here because
 *  its absence is a CORRECTNESS bug and not a cosmetic one: a fallback font
 *  for Quranic codepoints renders tofu (edge case #84), so an offline shell
 *  without the font would paint boxes where an ayah belongs. */
const STABLE_ASSETS = ["/fonts/amiri-400.woff2"];

/**
 * THE ROUTES A LEARNER CAN COLD-START INTO, precached at install.
 *
 * These ARE stable URLs (unlike the hashed chunks behind them), so unlike the
 * shell JS they can safely be named. Precaching them is not a nicety — it is
 * the difference between the M5 criterion being met and appearing to be met,
 * and the distinction was only visible in a browser:
 *
 * A learner's FIRST EVER visit is NOT CONTROLLED by the worker. Registration
 * happens in an effect after that navigation has already been served from the
 * network, so the fetch handler never sees it and the runtime cache-on-navigate
 * branch stores nothing for that route. Precache-nothing therefore means a
 * learner who visits once, installs the app, and boards a plane gets the
 * FALLBACK document for every route — i.e. the landing page, painted under the
 * URL /drill, which then hydration-mismatches into "This page couldn't load".
 *
 * That failure is far worse than an honest offline error, and it is exactly
 * the shape a test asserting "the h1 is visible" would call a pass: there IS
 * an h1, it is just the marketing page's. The e2e suite asserts `.drill-summary`
 * and the drill's own heading for that reason.
 *
 * Kept to the routes a cold start actually lands on. `/session` is deliberately
 * absent: a session is started FROM /home or /drill, and a learner cold-opening
 * a drill they have not chosen is not a real journey.
 */
const SHELL_ROUTES = ["/home", "/drill"];

/** The document served when a navigation has no network and no exact cached
 *  match. "/" is the app's own shell — same layout, same client islands — so
 *  the page boots and its islands read IndexedDB exactly as they would online.
 *
 *  A CACHED "/" IS ALSO A HAZARD, and a documented one. Edge case #92: "PWA
 *  start_url bypasses middleware; offline serves cached '/' → onboarded user
 *  sees marketing page." That failure only became REACHABLE the day this file
 *  landed, because before it nothing cached "/" at all. What makes it safe is
 *  `components/shell/OnboardedSteer.tsx`, which runs INSIDE the served
 *  document, reads `meta.onboardedAt` from the log, and replaces the route.
 *  Middleware cannot help — the worker answered before the network was asked —
 *  so the steering has to be client-side, and it is. The e2e suite asserts
 *  that walk (offline + onboarded + goto("/") lands on /home) precisely
 *  because this file is what made it possible to get wrong. */
const SHELL_DOCUMENT = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // The corpora, read from what staging actually wrote. `addAll` is
      // atomic — one 404 rejects the whole install — so the manifest is
      // fetched rather than assumed, and a missing manifest degrades to "no
      // corpora precached" rather than to "no service worker".
      let corpora = [];
      try {
        const res = await fetch(STAGED_MANIFEST, { cache: "no-store" });
        if (res.ok) {
          const body = await res.json();
          if (Array.isArray(body?.surahs)) {
            corpora = body.surahs.map((s) => `/corpus/${s}.json`);
          }
        }
      } catch {
        // Offline at install, or the manifest was never staged. Neither is a
        // reason to have no worker: the shell half still works, and a surface
        // with no corpus renders its designed unavailable state.
      }

      // Each URL added individually. `addAll` would make one absent font or
      // one un-staged corpus fail the ENTIRE install, leaving the app with no
      // worker and no offline shell — trading a degraded corner for a total
      // loss of the feature.
      await Promise.all(
        [...STABLE_ASSETS, ...corpora].map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
        ),
      );

      // -------------------------------------------------------------------
      // THE DOCUMENTS, AND THE CHUNKS THEY NEED TO HYDRATE.
      // -------------------------------------------------------------------
      // Caching a route's HTML alone is NOT ENOUGH, and the gap is invisible
      // without a browser. A precached `/drill` serves its own markup offline
      // — correct heading, correct static text — but every client island on it
      // stays dead, because the hashed chunks that hydrate it were never
      // cached. `.drill-summary` is rendered by an island, so what the learner
      // actually gets is a page-shaped thing that never becomes a drill.
      //
      // That is the single most dangerous outcome this file can produce: it
      // LOOKS like the offline shell works. A test asserting the heading
      // passes. Only an assertion on island-rendered output catches it, which
      // is why the e2e suite asserts `.drill-summary` and not the `h1`.
      //
      // So each shell route is FETCHED, cached, and its own `<script src>` and
      // `<link href>` references to /_next/static/ are extracted from the HTML
      // and cached alongside it. Parsing the document is what keeps this
      // hash-agnostic: the chunk names change every build and are never
      // written down here, only read out of the markup that references them.
      await Promise.all(
        [SHELL_DOCUMENT, ...SHELL_ROUTES].map(async (route) => {
          try {
            const res = await fetch(new Request(route, { cache: "reload" }));
            if (!res.ok) return;
            const html = await res.clone().text();
            await cache.put(route, res);

            // src="/_next/static/..." and href="/_next/static/..." — scripts
            // and stylesheets alike. A plain regex rather than a parser: there
            // is no DOMParser in a worker, and the shape being matched is an
            // attribute value emitted by the framework, not user content.
            const assets = new Set();
            const pattern = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;
            let match;
            while ((match = pattern.exec(html)) !== null) {
              assets.add(match[1].replace(/&amp;/g, "&"));
            }
            await Promise.all(
              [...assets].map((url) =>
                cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
              ),
            );
          } catch {
            // This route is simply not available offline. The others still are,
            // and a partial shell beats no worker.
          }
        }),
      );
    })(),
  );

  // Take over on the FIRST load rather than waiting for every tab to close.
  // Without this a learner installs the app, boards the plane, and discovers
  // the worker they "installed" was still parked in `waiting`.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // -----------------------------------------------------------------------
  // (a) THE /api RULE — FIRST, BEFORE ANY CACHE IS EVEN OPENED.
  // -----------------------------------------------------------------------
  // Invariant #2: the append-only event log is TRUTH. A cached API response
  // would present a stale server state as truth — and worse, a cached 200 on
  // a sync pull could mask un-synced local events, which is edge case #124's
  // "events are ALWAYS ingested" failing silently and unrecoverably. Sync is
  // local-first and has its own outbox; it does not want or need help here.
  //
  // CROSS-ORIGIN IS PART OF THIS RULE, not a separate nicety.
  // `lib/sync/apiFetch.ts#apiBase()` honours `NEXT_PUBLIC_API_BASE`, so in
  // some deploys the API is on a DIFFERENT HOST. A pathname-only check would
  // be correct on this machine and wrong in exactly the deployment where it
  // matters. So: anything cross-origin, and anything under /api/, falls
  // straight through to the network, untouched and uncached.
  //
  // `return` — not `respondWith` — hands the request back to the browser's
  // normal network path. Offline, that fails, which is CORRECT: sync failing
  // offline is the designed behaviour, and a learner's drill does not depend
  // on it (#103: sync never blocks the session).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // (b) Only GETs are cacheable, and only GETs are safe to replay.
  if (request.method !== "GET") return;

  // -----------------------------------------------------------------------
  // (c) NAVIGATIONS — network-first, then the cached shell.
  // -----------------------------------------------------------------------
  // Network-first and not cache-first: online, a learner must get the CURRENT
  // build, not yesterday's shell. The cache is a fallback for the one case it
  // exists to serve. This branch is what turns ERR_INTERNET_DISCONNECTED into
  // a page.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          // This exact route first (a learner who drilled here before gets
          // their own page back), then the shell document.
          const exact = await cache.match(request, { ignoreSearch: true });
          if (exact) return exact;
          const shell = await cache.match(SHELL_DOCUMENT);
          if (shell) return shell;
          // Nothing cached and no network: the browser's own error is more
          // honest than a fabricated page.
          return Response.error();
        }
      })(),
    );
    return;
  }

  // -----------------------------------------------------------------------
  // (d) STATIC ASSETS — cache-first, and cache what the network returns.
  // -----------------------------------------------------------------------
  // This is how the hashed chunks get into the cache without ever being
  // named: whatever this build asked for is what gets stored, under this
  // build's names. `/corpus/` and `/fonts/` are content-addressed too — a
  // corpus is compiled output and a font is bytes — so cache-first is right
  // for all three.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/corpus/") ||
    url.pathname.startsWith("/fonts/")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const fresh = await fetch(request);
          // Only successful, non-opaque responses. Caching a 404 would make
          // it permanent for the life of the cache version.
          if (fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return Response.error();
        }
      })(),
    );
  }

  // Everything else — RSC payloads, anything unanticipated — is left to the
  // network. A worker that answers requests it was not designed for is a
  // worker that serves something wrong offline, and this one would rather
  // fail honestly than guess.
});
