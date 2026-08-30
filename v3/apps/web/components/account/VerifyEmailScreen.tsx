"use client";

// THE EMAIL-VERIFICATION LANDING SCREEN — closes the gap `lib/account/auth.ts`
// (v3-D154) named "not addressed": `EmailVerificationController::verify()`'s
// own signed-link route has existed and been server-tested since build-plan
// step 13, but nothing let a learner who clicked the emailed link land
// anywhere — `grep -rln "email/verify" apps/web/lib apps/web/app
// apps/web/components` (excluding `auth.ts`'s own docblock references)
// returned nothing before this file.
//
// Reachable from an email client, not from inside the authenticated app
// shell — see `app/verify-email/page.tsx`, a public top-level route
// mirroring `app/reset-password/page.tsx`'s "outside every route group"
// shape.
//
// UNLIKE `ResetPasswordForm`, there is no form here — the link itself IS the
// credential (a signed URL), so verification fires automatically on mount,
// the same "no user input needed" shape `AccountAuthPanel`'s own mount
// effect uses for `checkAccountSession`.
//
// The route this calls is device-bound BY DESIGN (see `lib/account/auth.ts
// #confirmEmailVerification`'s own docblock) — opening the link on a
// different or signed-out device fails honestly, and this screen says so
// rather than presenting it as a generic error.

import { useEffect, useState } from "react";
import { confirmEmailVerification } from "@/lib/account/auth.ts";
import type { VerifyLinkParams } from "@/lib/account/verifyLink.ts";

type ScreenState =
  | { phase: "verifying" }
  | { phase: "verified" }
  | { phase: "already-verified" }
  | { phase: "failed"; error: string };

export function VerifyEmailScreen({ link }: { link: VerifyLinkParams | null }) {
  const [state, setState] = useState<ScreenState>({ phase: "verifying" });

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    void (async () => {
      const outcome = await confirmEmailVerification(link);
      if (cancelled) return;
      if (!outcome.ok) {
        setState({ phase: "failed", error: outcome.error ?? "Could not verify your email." });
        return;
      }
      setState(outcome.alreadyVerified === true ? { phase: "already-verified" } : { phase: "verified" });
    })();
    return () => {
      cancelled = true;
    };
  }, [link]);

  if (!link) {
    return (
      <div role="alert" className="banner banner--warn">
        <p>This verification link is missing pieces — it may be broken or already used.</p>
        <p className="sub">Request a new one from Settings.</p>
      </div>
    );
  }

  if (state.phase === "verifying") {
    return (
      <p role="status" className="caption">
        Verifying…
      </p>
    );
  }

  if (state.phase === "verified") {
    return (
      <p role="status" className="caption">
        Your email is verified.
      </p>
    );
  }

  if (state.phase === "already-verified") {
    return (
      <p role="status" className="caption">
        Your email was already verified.
      </p>
    );
  }

  return (
    <div role="alert" className="stack stack--tight">
      <p className="caption">{state.error}</p>
      <p className="sub">
        If you opened this link on a different device than the one you signed up with, sign in on this device first
        and open the link again. Otherwise, request a new one from Settings.
      </p>
    </div>
  );
}
