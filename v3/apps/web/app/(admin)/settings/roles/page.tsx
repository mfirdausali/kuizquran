// "/settings/roles" — THE ADMIN ROLES VIEWER (admin console, build-plan step 24).
//
// Same route-group reasoning as `/settings/audit`, `/settings/flags` and
// `/settings/privacy`: `(admin)` contributes no URL segment, so this is
// staff tooling with none of the learner shell's chrome, reachable by
// nobody tapping around the product.
//
// The endpoint this reads (`GET /api/admin/roles`) is new — `admin_roles`
// has been written by `admin:grant-role` since v3-D92 with no admin-facing
// reader anywhere; `GET /api/admin/whoami` only ever answers "what does THE
// CALLING admin hold" (v3-D131). See `components/admin/AdminRolesPanel.tsx`'s
// own header.

import { AdminRolesPanel } from "@/components/admin/AdminRolesPanel";

export default function AdminRolesPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Admin roles</h1>
          <p className="caption">
            Every role grant recorded since the role plane shipped — who holds operator, qari or
            moderator, when it was granted, and by whom. Read-only; granting or revoking a role
            stays a CLI-only action (<code>admin:grant-role</code>).
          </p>
        </header>
        <AdminRolesPanel />
      </div>
    </div>
  );
}
