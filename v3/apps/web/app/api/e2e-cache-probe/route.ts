// A TEST FIXTURE THAT HAS TO BE A REAL ROUTE. Nothing in the product calls it.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
// `public/sw.js` must NEVER cache anything under /api — invariant #2 (the
// append-only log is truth) and edge case #124 (events are ALWAYS ingested). A
// cached API response presents stale server state as current, and a cached 200
// on a sync pull could silently mask un-synced local events.
//
// `scripts/check-boundaries.mjs` CANNOT enforce that rule: `public/` is in its
// SKIP set, so no clause ever sees the service worker. The only enforcement is
// `e2e/airplane-mode.test.ts`, in a real browser — and that test can only fail
// if there is genuinely something cacheable under /api for a broken worker to
// cache. Three earlier versions of it were VACUOUS for want of exactly that:
//
//   - a POST never reaches the /api branch (the non-GET guard drops it first);
//   - this app's real /api is a SEPARATE Laravel origin, so under `next start`
//     every /api path 404s, and no cache-first branch stores a 404;
//   - Playwright's `page.route` cannot intercept service-worker-issued
//     requests, so a faked 200 never reaches the worker at all.
//
// So the fixture has to be a route the Next server really serves. This is it:
// a cacheable 200 with a trivial body, existing solely so that "the worker did
// not cache /api" is a claim with something behind it.
//
// ---------------------------------------------------------------------------
// WHY IT IS HARMLESS
// ---------------------------------------------------------------------------
// It reads nothing, writes nothing, and touches no learner state — no log, no
// IndexedDB, no corpus, no identity. It cannot leak because it has no input
// and its output is a constant. It is unauthenticated because it is not a
// resource: any request to it gets the same two fields, whoever asks.
//
// It does NOT go through `lib/sync/apiFetch.ts` and does not need to: that
// module is the single EGRESS (check-boundaries clause 6), i.e. the one place
// the browser may CALL /api. This is the other side of the wire — a server
// handler — and defines no egress at all.

import { NextResponse } from "next/server";

export function GET(): NextResponse {
  return NextResponse.json(
    { probe: "e2e-cache-probe", cacheable: true },
    {
      // ---------------------------------------------------------------------
      // `no-store`, AND THAT IS NOT A CONTRADICTION — IT IS THE FIX FOR A
      // FOURTH VACUITY.
      // ---------------------------------------------------------------------
      // This header was first `public, max-age=3600`, on the reasoning that
      // the fixture should be maximally cacheable. That made the test lie in
      // the OTHER direction: with a correct service worker (one that ignores
      // /api entirely), the offline call still RESOLVED 200 — served by the
      // browser's own HTTP cache, which has nothing to do with the worker.
      // The assertion "an offline /api call fails" was then measuring
      // Chromium's disk cache, not `sw.js`.
      //
      // `no-store` removes the browser's HTTP cache from the experiment. What
      // it does NOT do is stop a service worker caching the response: the
      // CacheStorage API is explicit, `cache.put()` stores whatever it is
      // handed regardless of Cache-Control, which is exactly why the mutated
      // worker still put three /api entries on disk. So the fixture stays
      // fully capable of catching a worker that caches /api, while no longer
      // being confounded by a cache nobody was testing.
      headers: { "Cache-Control": "no-store" },
    },
  );
}
