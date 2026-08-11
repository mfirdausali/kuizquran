// The ROOT layout. Build-plan step 17, plan §B/§C.
//
// It does four things and no more: the document, the two stylesheets in the
// one order that works, the Amiri preload, and the viewport/PWA metadata.
// The tab bar is NOT here — it belongs to the (app) route group, because the
// landing page (v3-D14: "/" is a real stateless page) must not show learner
// navigation to someone who has not started.
//
// STYLESHEET ORDER IS LOAD-BEARING.
//   1. ./iman-ui.css  — LOCKED. Byte-gated by scripts/check-locked-css.mjs
//      against v1, one permitted hunk at line 17. Never edited.
//   2. ./iman-ext.css — the extension layer. Imported SECOND so it wins ties
//      by cascade order and never needs `!important`.
// Swapping these two lines silently inverts the whole design system, and no
// gate would catch it — the locked file would still be byte-identical.
//
// NOT next/font, deliberately (plan §A4/§B2, edge case #83/#84). next/font
// generates hashed family names (`__Amiri_1a2b3c`) which can never match the
// literal families named in the locked --font-arabic/--font-ui/--font-voice
// tokens, and those token lines are themselves gated. Self-hosted @font-face
// declaring the LITERAL names is the only construction satisfying both. It
// lives inside the locked file's one permitted hunk.
//
// dir="ltr" lang="en" on <html> is the UI CHROME's direction (WIREFRAME §15).
// Arabic is an RTL ISLAND: each element painting Quranic text carries its own
// dir="rtl" lang="ar". Flipping the document to rtl instead would mirror the
// entire interface for the sake of one string per screen, and would still be
// wrong for a screen reader, which needs `lang` to switch voices.

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./iman-ui.css";
import "./iman-ext.css";

export const metadata: Metadata = {
  title: "Iman Quiz",
  description: "Memorise the Quran, and keep what you memorise.",
  // v3-D14 / edge case #92: the installed app opens on the DASHBOARD, not the
  // marketing page. The manifest itself is M10's; this is the metadata half.
  applicationName: "Iman Quiz",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // NOT maximum-scale/user-scalable=no. Blocking pinch-zoom is a WCAG 1.4.4
  // failure, and this app's hero is 22px Arabic that some learners will need
  // to enlarge. The 44px tap targets (edge case #82) are what make the small
  // controls reachable — never a zoom lock.
  viewportFit: "cover", // so env(safe-area-inset-bottom) is non-zero on iOS
  themeColor: [
    // Matches the locked --surface-0 in each scheme, so the browser chrome
    // does not band against the page.
    { media: "(prefers-color-scheme: light)", color: "#edebe3" },
    { media: "(prefers-color-scheme: dark)", color: "#161613" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        {/* Amiri is the ONE font whose absence is a correctness bug, not a
            cosmetic one: a fallback for Quranic codepoints renders tofu
            (edge case #84), and check-fonts.mjs HARD-FAILS if it is missing.
            Preloaded because it paints the hero on the very first screen and
            the locked @font-face gives it font-display: block. */}
        <link
          rel="preload"
          href="/fonts/amiri-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
