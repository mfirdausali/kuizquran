// "/settings/flags" — THE FLAG PLANE (admin console, build-plan step 26).
//
// Same route-group reasoning as `/settings/health` and `/settings/content-freeze`:
// `(admin)` contributes no URL segment, so this is staff tooling with none of
// the learner shell's chrome, reachable by nobody tapping around the product.
//
// The endpoint this reads (`GET /api/admin/flags`, plus kill/enable/ack) has
// been live and fully tested since the flag plane shipped; this screen is
// the missing face — see `components/admin/FlagsPanel.tsx`'s own header for
// exactly what is and is not enforced client-side (nothing — the ceremony is
// server-enforced, per BUILD-PLAN's own ethics gate).

import { FlagsPanel } from "@/components/admin/FlagsPanel";

export default function FlagsPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Flags</h1>
          <p className="caption">
            Every flag in the registry, all OFF by default. Kill is one click; enabling is the full
            ceremony, enforced by the server.
          </p>
        </header>
        <FlagsPanel />
      </div>
    </div>
  );
}
