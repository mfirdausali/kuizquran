// "/verify-email" — THE EMAIL-VERIFICATION LANDING SCREEN.
//
// ---------------------------------------------------------------------------
// WHY THIS ROUTE EXISTS
// ---------------------------------------------------------------------------
// `EmailVerificationController::verify()` (`GET /api/email/verify/{id}/{hash}`)
// has existed and been server-tested since build-plan step 13. v3-D153 wired
// the frontend account flow (register/login/logout/resend-verification/
// request-password-reset) and named this landing page "not addressed" — a
// smaller, separate gap alongside the reset-password confirmation screen
// v3-D154 then closed. This route closes it.
//
// ---------------------------------------------------------------------------
// A ROUTE OUTSIDE EVERY GROUP, LIKE `/reset-password` AND `/attribution`
// ---------------------------------------------------------------------------
// It must be reachable by someone who followed a link from an email
// client — they have no tab bar, no prior IDB state necessarily loaded, and
// are not "inside the app" in the sense `(app)` assumes.
//
// The exact query-string shape (`?id=&hash=&expires=&signature=`) is
// produced server-side by
// `v3/api/app/Providers/AppServiceProvider.php`'s `VerifyEmail::createUrlUsing`
// closure and parsed back by `lib/account/verifyLink.ts#parseVerifyLinkParams`,
// which degrades a missing/malformed set to `null` rather than a 500 (edge
// case #78) — `VerifyEmailScreen` renders an honest "this link is broken"
// state for that case rather than crashing.

import type { Metadata } from "next";
import { VerifyEmailScreen } from "@/components/account/VerifyEmailScreen";
import { parseVerifyLinkParams } from "@/lib/account/verifyLink";

export const metadata: Metadata = {
  title: "Verify your email — Iman Quiz",
  description: "Finish verifying your email from the link we sent you.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; hash?: string; expires?: string; signature?: string }>;
}) {
  const sp = await searchParams;
  const link = parseVerifyLinkParams(sp);

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Verify your email</h1>
        </header>
        <section className="card" aria-labelledby="verify-email-h">
          <div className="card-header">
            <h2 id="verify-email-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              EMAIL VERIFICATION
            </h2>
          </div>
          <VerifyEmailScreen link={link} />
        </section>
      </div>
    </div>
  );
}
