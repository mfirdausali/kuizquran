// "/settings/audit" — THE AUDIT LOG VIEWER (admin console, build-plan step 24).
//
// Same route-group reasoning as `/settings/flags`, `/settings/health` and
// `/settings/content-freeze`: `(admin)` contributes no URL segment, so this
// is staff tooling with none of the learner shell's chrome, reachable by
// nobody tapping around the product.
//
// The endpoint this reads (`GET /api/admin/audit`) is new — the missing read
// half of `admin_audit`, which four other admin actions have written to
// since the console shipped with no route ever reading it back. See
// `components/admin/AuditLogPanel.tsx`'s own header.

import { AuditLogPanel } from "@/components/admin/AuditLogPanel";

export default function AuditPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Audit log</h1>
          <p className="caption">
            Every recorded admin action that touches a learner&rsquo;s identity or an operational
            setting — who, when, and the reason given. Read-only.
          </p>
        </header>
        <AuditLogPanel />
      </div>
    </div>
  );
}
