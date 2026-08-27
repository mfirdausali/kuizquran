// "/settings/gloss-drafts" — THE MS GLOSS DRAFT WORKFLOW (admin console,
// build-plan step 27, M9, WIREFRAME/BUILD-PLAN Q2).
//
// Same route-group reasoning as `/settings/flags`, `/settings/health` and
// `/settings/content-freeze`: `(admin)` contributes no URL segment, so this
// is staff tooling with none of the learner shell's chrome.
//
// `GET/POST /api/admin/gloss-drafts` and `POST /api/admin/gloss-drafts/{id}/
// review` have been live and fully tested since build-plan step 27 shipped;
// this screen is the missing face — see `components/admin/GlossDraftsPanel.tsx`'s
// own header for why building it needs no content ratification (the table
// ships empty; this panel is the empty scaffold a human types into, not
// authored Malay content of its own).

import { GlossDraftsPanel } from "@/components/admin/GlossDraftsPanel";

export default function GlossDraftsPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>MS Gloss Drafts</h1>
          <p className="caption">
            Draft and review Malay glosses ahead of a future launch. Nothing here ships to a
            learner or moves a scholar&apos;s signature.
          </p>
        </header>
        <GlossDraftsPanel />
      </div>
    </div>
  );
}
