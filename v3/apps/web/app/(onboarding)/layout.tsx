// THE ONBOARDING SHELL — WIREFRAME §17's seven screens.
//
// A ROUTE GROUP, like `(app)`: the parentheses mean it contributes a layout but
// no URL segment, so the flow lives at `/start` rather than `/onboarding/start`.
//
// IT HAS NO TAB BAR, and that is the whole reason it is a separate group rather
// than a route under `(app)`. Showing Home / Library / Plan / Progress to
// someone who has not chosen a surah would offer four dead ends and would
// contradict the flow's own premise — screens 1 and 2 belong to a visitor, not
// a learner. The tab bar appears at screen 7, when there is finally something
// behind each tab.
//
// IT READS NO IndexedDB, for the same reason `(app)/layout.tsx` does not: a
// layout that read the log would put every screen under it at risk of edge case
// #72. The one screen that writes (screen 7's commit) does so from its own
// client island.
//
// PRE-RECALL SURFACES LIVE HERE. `check-boundaries.mjs` clause 8 lists
// `^app/\(onboarding\)/` in its PRE_RECALL set, so identity-capture markup
// anywhere under this directory fails the build by name. That is the governing
// rule of §17 — "no account, no email, no notification prompt until the learner
// has produced an ayah from memory" — made structural rather than decorative.

import type { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <main id="main" className="app-main">
        {children}
      </main>
    </div>
  );
}
