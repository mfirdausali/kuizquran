// "/reset-password" — THE PASSWORD-RESET CONFIRMATION SCREEN.
//
// ---------------------------------------------------------------------------
// WHY THIS ROUTE EXISTS
// ---------------------------------------------------------------------------
// DEFECTS.md#AUTH- / CLAUDE.md's own corruption-risk ordering: "an RM500
// lifetime buyer who forgets their password loses everything." v3-D153 wired
// the SEND-LINK half (`requestPasswordReset`, inside `/settings`'s
// `AccountAuthPanel`) but named this confirmation screen "not addressed" —
// nothing yet let a learner who clicked the emailed link actually finish.
// This route closes that.
//
// ---------------------------------------------------------------------------
// A ROUTE OUTSIDE EVERY GROUP, LIKE `/attribution`
// ---------------------------------------------------------------------------
// It must be reachable by someone who followed a link from an email client —
// they have no tab bar, no prior IDB state necessarily loaded, and are not
// "inside the app" in the sense `(app)` assumes. `apiFetch` still mints an
// anonymous device token transparently if this browser has none, but the
// server route this page calls (`POST /api/reset-password`) needs no auth at
// all — the token+email pair IS the proof.
//
// The exact query-string shape (`?token=&email=`) is produced server-side by
// `v3/api/app/Providers/AppServiceProvider.php`'s `ResetPassword::createUrlUsing`
// closure and parsed back by `lib/account/resetLink.ts#parseResetLinkParams`,
// which degrades a missing/malformed pair to `null` rather than a 500 (edge
// case #78) — `ResetPasswordForm` renders an honest "this link is broken"
// state for that case rather than crashing.

import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";
import { parseResetLinkParams } from "@/lib/account/resetLink";

export const metadata: Metadata = {
  title: "Reset your password — Iman Quiz",
  description: "Finish resetting your password from the link we emailed you.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const link = parseResetLinkParams(sp);

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Reset your password</h1>
        </header>
        <section className="card" aria-labelledby="reset-password-h">
          <div className="card-header">
            <h2 id="reset-password-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              NEW PASSWORD
            </h2>
          </div>
          <ResetPasswordForm link={link} />
        </section>
      </div>
    </div>
  );
}
