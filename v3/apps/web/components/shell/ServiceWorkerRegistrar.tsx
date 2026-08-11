"use client";

// SERVICE WORKER REGISTRATION — the one line that turns `public/sw.js` from a
// file into a cached shell.
//
// Modelled directly on `OnboardedSteer` in this directory, and for the same
// reasons: it renders NOTHING, it does its work in an effect, and EVERY
// failure path is "do nothing, the page still works". That last property is a
// requirement here and not a stylistic preference.
//
// ---------------------------------------------------------------------------
// WHY EVERY FAILURE IS SWALLOWED
// ---------------------------------------------------------------------------
// A service worker is a PROGRESSIVE ENHANCEMENT. The app is local-first with
// or without one — the log is IndexedDB, the engine runs in the tab, and
// `e2e/airplane-mode.test.ts` proves a hydrated page keeps drilling offline
// with no worker at all. The worker adds one thing: a shell to serve when the
// learner navigates with no network.
//
// So a browser that refuses to register must still run the app perfectly.
// `navigator.serviceWorker` is absent entirely in some contexts, and
// `register()` REJECTS rather than returning null in others — Firefox private
// browsing throws by design, some enterprise policies block workers outright,
// and any page served over plain HTTP on a non-localhost host is disqualified
// by the secure-context rule. Every one of those is a normal Tuesday for a
// real learner, and none of them is a reason to put an error on the screen or
// let an unhandled rejection surface in the console.
//
// Hence: a capability check, then a promise whose rejection is caught and
// dropped. Nothing is thrown, nothing is set into state, nothing is rendered.
// The one thing this component must never do is make the app worse than it
// would have been without it.
//
// ---------------------------------------------------------------------------
// WHY IT MOUNTS IN THE ROOT LAYOUT
// ---------------------------------------------------------------------------
// Not in the (app) group. The shell a learner needs offline includes the
// landing page — edge case #92 is precisely "offline serves cached '/'" — and
// onboarding, which a learner can legitimately be part-way through when the
// train enters a tunnel. Registering only inside the authenticated app would
// leave the two surfaces a cold offline start actually lands on uncovered.

import { useEffect } from "react";

/** Served from `public/`, so it sits at the ORIGIN ROOT and can claim scope
 *  "/" without a `Service-Worker-Allowed` header. See that file's header for
 *  why the bundled `new URL(...)` form was not used. */
const SW_URL = "/sw.js";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    let alive = true;

    // Not a secure context, or a browser with no worker support at all. There
    // is nothing to do and nothing to report.
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        // `updateViaCache: "none"` so the browser always revalidates the
        // WORKER SCRIPT itself against the network. Without it a bad worker
        // can be cached by HTTP and become effectively unevictable — the one
        // failure mode of this whole mechanism that a user cannot clear by
        // reloading. `next.config.mjs` sends no-store headers on /sw.js for
        // the same reason; belt and braces, because the cost of getting this
        // wrong is a bricked install.
        await navigator.serviceWorker.register(SW_URL, {
          scope: "/",
          updateViaCache: "none",
        });
        if (!alive) return;
      } catch {
        // Registration refused. The app is unchanged: still local-first, still
        // drillable, simply without an offline cold start. Swallow it — a
        // rethrow here would become an unhandled rejection on every page load
        // in private browsing.
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return null;
}
