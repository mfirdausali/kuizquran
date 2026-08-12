// "/settings" — ACCOUNT & DATA (build-plan step 23 / M7, LAUNCH-CHECKLIST.md
// gate 19: "the backend is done (v3-D79); a learner still cannot reach it
// without one").
//
// Deliberately NOT a tab. `components/shell/TabBar.tsx`'s own header names
// this exactly: "there is deliberately no 'You' tab... the account surface
// is §24 (M7) and reaching it costs a tap from /home rather than a permanent
// quarter of the navigation" (v3-D05). `/home` links here.
//
// A SERVER COMPONENT wrapping two client islands, same shape as every other
// route in `(app)` (see e.g. `/home`'s own header) — this file reads no
// IndexedDB and calls no API itself, so it stays server-rendered while the
// two panels that genuinely need client state hydrate underneath it.

import { AccountExportPanel } from "@/components/settings/AccountExportPanel";
import { AccountDeletionPanel } from "@/components/settings/AccountDeletionPanel";

export default function SettingsPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Account &amp; data</h1>
          <p className="caption">Export what is recorded, or delete your account.</p>
        </header>

        <section className="card" aria-labelledby="export-h">
          <div className="card-header">
            <h2 id="export-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              YOUR DATA
            </h2>
          </div>
          <AccountExportPanel />
        </section>

        <section className="card" aria-labelledby="delete-h">
          <div className="card-header">
            <h2 id="delete-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              DELETE ACCOUNT
            </h2>
          </div>
          <AccountDeletionPanel />
        </section>
      </div>
    </div>
  );
}
