// "/settings/health" — SYSTEM HEALTH (admin console, build-plan step 24).
//
// Same route-group reasoning as `/settings/stripe`: `(admin)` contributes no
// URL segment, so this is staff tooling with none of the learner shell's
// chrome, reachable by nobody tapping around the product.
//
// The endpoint this reads (`GET /api/admin/health`) has been live and fully
// tested since the admin console shipped; this screen is the missing face —
// see `components/admin/SystemHealthPanel.tsx`'s own header for exactly what
// is and is not rendered.

import { SystemHealthPanel } from "@/components/admin/SystemHealthPanel";

export default function SystemHealthPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>System health</h1>
          <p className="caption">
            The two nightly determinism checks, and the atom-cache rebuild.
          </p>
        </header>
        <SystemHealthPanel />
      </div>
    </div>
  );
}
