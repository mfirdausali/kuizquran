// THE WEB APP MANIFEST — the metadata half's other half.
//
// `app/layout.tsx` has carried `applicationName`, `themeColor` and
// `viewportFit` since build-plan step 17, with a comment reading "The manifest
// itself is M10's; this is the metadata half." This is that manifest, landing
// alongside the service worker because the two are one feature: a worker with
// no manifest caches a shell nobody can install to a home screen, and a
// manifest with no worker promises an app that dies on the first offline
// launch.
//
// `app/manifest.ts` returning `MetadataRoute.Manifest` is the Next 16 App
// Router file convention (node_modules/next/dist/docs/01-app/02-guides/
// progressive-web-apps.md). Next serves it at `/manifest.webmanifest` and
// links it from every document itself — there is no `<link rel="manifest">` to
// add to the layout, and adding one by hand would produce a second, divergent
// declaration.
//
// ---------------------------------------------------------------------------
// start_url IS "/home", AND THAT IS A RATIFIED DECISION
// ---------------------------------------------------------------------------
// v3-D14, verbatim: "PWA `start_url=/home`." "/" is the LANDING page — a real
// stateless marketing surface for someone who has not started (v3-D14 again,
// and edge case #71). An installed app belongs to a learner who has already
// onboarded, and opening their own app to a page selling it to them is the
// papercut edge case #92 is about.
//
// That decision does not make the steering redundant. A learner can still
// reach "/" from a bookmark or a shared link, and offline the service worker
// serves it from cache before middleware ever runs — which is exactly why
// `components/shell/OnboardedSteer.tsx` exists and why it reads IndexedDB
// rather than a cookie. start_url is the fast path; the steering is the
// guarantee.
//
// ---------------------------------------------------------------------------
// NO ICONS ARRAY, DELIBERATELY
// ---------------------------------------------------------------------------
// The Next guide's example lists `/icon-192x192.png` and `/icon-512x512.png`.
// NEITHER EXISTS in `public/` — this repo ships `app/favicon.ico` and two
// Amiri woff2s and nothing else. Copying the example verbatim would put two
// guaranteed 404s into the manifest, which is worse than declaring none: an
// install prompt that fails on a missing icon is a broken feature, while an
// absent icons array simply means the browser falls back to the favicon. The
// icon set is a design deliverable, and inventing placeholder art to satisfy a
// schema is not this change's job.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Iman Quiz",
    short_name: "Iman Quiz",
    description: "Memorise the Quran, and keep what you memorise.",

    // v3-D14 / edge case #92. The dashboard, never the marketing page.
    start_url: "/home",

    display: "standalone",

    // The SAME two colours as `layout.tsx`'s viewport.themeColor, which are
    // themselves the locked `--surface-0` in each scheme. A manifest is a
    // static document and cannot express a media query, so it takes the light
    // value; the `<meta name="theme-color">` pair in the layout is what
    // actually follows the learner's scheme. Inventing a third colour here
    // would band the splash screen against the app on first launch.
    background_color: "#edebe3",
    theme_color: "#edebe3",

    // The UI chrome is LTR English (WIREFRAME §15). Arabic is an RTL island
    // inside it, per-element, never a document-level flip.
    lang: "en",
    dir: "ltr",
  };
}
