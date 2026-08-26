// "/settings/billing" — THE BILLING AUDIT VIEWER (admin console). BUILD-PLAN
// M7's own named deliverable, never built until now: "admin billing surface."
//
// Same route-group reasoning as `/settings/flags`, `/settings/audit`,
// `/settings/health` and `/settings/content-freeze`: `(admin)` contributes no
// URL segment, so this is staff tooling with none of the learner shell's
// chrome, reachable by nobody tapping around the product.
//
// The endpoint this reads (`GET /api/admin/billing`) is new — the missing
// read half of `entitlement_transitions`, which every entitlement state
// change has written to since the state machine shipped with no route ever
// reading it back. See `components/admin/BillingAuditPanel.tsx`'s own header.

import { BillingAuditPanel } from "@/components/admin/BillingAuditPanel";

export default function BillingAuditPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Billing audit</h1>
          <p className="caption">
            Every recorded billing state change — from state, to state, cause and reason.
            Read-only.
          </p>
        </header>
        <BillingAuditPanel />
      </div>
    </div>
  );
}
