"use client";

// The bottom tab bar — WIREFRAME §14 / v3-D05.
//
//     "the calendar is no longer a forecast readout inside the surah page. It
//      is its own route (/plan) and its own TAB, replacing 'You' in the bottom
//      bar."
//
// So there are four tabs and PLAN is one of them. There is deliberately no
// "You" tab: the account surface is §24 (M7) and reaching it costs a tap from
// /home rather than a permanent quarter of the navigation.
//
// Why this is a client component: it needs `usePathname` to mark the current
// tab. That is the ONLY reason. It reads no IndexedDB, imports no engine, and
// makes no decision — it is chrome. (A server component cannot know the
// pathname without prop-drilling it through every page, which is worse.)
//
// a11y (WIREFRAME §15):
//   - `aria-current="page"` is the machine-readable current-tab signal. The
//     teal colour is decoration ON TOP of it, never the signal itself.
//   - every tab is >= 44px (edge case #82) via `.tabbar__item`'s min-height,
//     set in the EXT layer — the locked file is byte-gated and untouched.
//   - the bar is a <nav> with a label, so a screen reader can jump to it.

import Link from "next/link";
import { usePathname } from "next/navigation";

/** One tab. `match` decides "am I the current section", which is NOT string
 *  equality: /surah/67/4 is inside the Library section, and a learner deep in
 *  an ayah must still see where they are. */
interface Tab {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
}

const TABS: readonly Tab[] = [
  {
    href: "/home",
    label: "Home",
    // v3-D14: `/home` is the dashboard. `/` is the landing page and is NOT a
    // tab — a learner inside the shell has already passed it.
    match: (p) => p === "/home",
  },
  {
    href: "/library",
    label: "Library",
    // Surah and ayah detail live under the Library section.
    match: (p) => p === "/library" || p.startsWith("/library/") || p.startsWith("/surah"),
  },
  {
    href: "/progress",
    label: "Progress",
    match: (p) => p === "/progress" || p.startsWith("/progress/"),
  },
  {
    href: "/plan",
    // v3-D05: this tab REPLACES "You". Predictability is a product promise,
    // and a promise needs a surface.
    label: "Plan",
    match: (p) => p === "/plan" || p.startsWith("/plan/"),
  },
] as const;

export function TabBar() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((tab) => {
        const current = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="tabbar__item"
            // Only ever "page" or absent. `aria-current={false}` would still
            // serialise as an attribute in some engines; undefined removes it.
            aria-current={current ? "page" : undefined}
          >
            <span className="tabbar__glyph" aria-hidden="true" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
