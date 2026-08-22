// "/settings/content-freeze" — CONTENT FREEZE READINESS (admin console,
// build-plan step 28, M9).
//
// Same route-group reasoning as `/settings/health` and `/settings/stripe`:
// `(admin)` contributes no URL segment, so this is staff tooling with none of
// the learner shell's chrome, reachable by nobody tapping around the product.
//
// The endpoint this reads (`GET /api/admin/content-freeze`) has been live and
// fully tested since M9's freeze gate shipped; this screen is the missing
// face — see `components/admin/ContentFreezePanel.tsx`'s own header for
// exactly what is and is not rendered. It answers only the DATABASE-side
// criteria; the build-artifact half (scene beats, hashSpecVersion, QA sample
// sign-off) still runs by hand via `scripts/content-freeze.mjs`, named on
// screen through the controller's own `note` field.

import { ContentFreezePanel } from "@/components/admin/ContentFreezePanel";

export default function ContentFreezePage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Content freeze readiness</h1>
          <p className="caption">
            Whether the launch corpus is bookable for a qari session — the
            database-side criteria only.
          </p>
        </header>
        <ContentFreezePanel />
      </div>
    </div>
  );
}
