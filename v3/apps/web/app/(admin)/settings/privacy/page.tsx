// "/settings/privacy" — REVEAL IDENTITY + USERS CSV EXPORT (admin console,
// build-plan step 24, M8, WIREFRAME §16).
//
// Same route-group reasoning as `/settings/flags`, `/settings/health` and
// `/settings/content-freeze`: `(admin)` contributes no URL segment, so this
// is staff tooling with none of the learner shell's chrome.
//
// The two endpoints this reads/writes (`POST /api/admin/users/{id}/reveal`,
// `GET /api/admin/reveal/{token}`, `GET /api/admin/users/export.csv`) have
// been live and fully tested since build-plan step 24 shipped; this screen
// is the missing face — see `components/admin/PrivacyPanel.tsx`'s own header
// for what is and is not enforced client-side (nothing beyond form
// usability — the reason-code set, the >=10-char minimum, the PII scan and
// the reveal TTL are all server-decided and rendered verbatim).

import { PrivacyPanel } from "@/components/admin/PrivacyPanel";

export default function PrivacyPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Privacy</h1>
          <p className="caption">
            Reveal a learner&apos;s identity by user id, with a typed, audited reason. Auto-remasks
            after the server&apos;s TTL. Bulk exports carry no identity at all.
          </p>
        </header>
        <PrivacyPanel />
      </div>
    </div>
  );
}
