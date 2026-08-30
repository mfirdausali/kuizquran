"use client";

// THE RESET-PASSWORD CONFIRMATION SCREEN — closes the gap `lib/account/auth.ts`
// (v3-D153) named "not addressed": `requestPasswordReset` (the send-link
// half, in `AccountAuthPanel`) was wired, but nothing yet let a learner who
// clicked the emailed link actually finish resetting their password. That is
// the more urgent half of CLAUDE.md's own corruption-risk ordering — "an
// RM500 lifetime buyer who forgets their password loses everything."
//
// Reachable from an email client, not from inside the authenticated app
// shell — see `app/reset-password/page.tsx`, a public top-level route
// mirroring `app/attribution/page.tsx`'s "outside every route group" shape.
//
// Password confirmation is checked HERE, before any request, so a mismatch
// never burns the one-time reset token on a doomed request — the server
// would reject it too (`PasswordResetController::reset()`'s own `confirmed`
// rule), but failing fast client-side keeps the token valid for a retry.

import { useCallback, useState } from "react";
import { confirmPasswordReset } from "@/lib/account/auth.ts";
import type { ResetLinkParams } from "@/lib/account/resetLink.ts";

type FormState = "idle" | "submitting" | "done";

export function ResetPasswordForm({ link }: { link: ResetLinkParams | null }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!link) return;
      if (password !== confirmation) {
        setError("Those passwords do not match.");
        return;
      }
      setError(null);
      setState("submitting");
      void (async () => {
        const outcome = await confirmPasswordReset({
          token: link.token,
          email: link.email,
          password,
          passwordConfirmation: confirmation,
        });
        if (!outcome.ok) {
          setState("idle");
          setError(outcome.error ?? "Could not reset your password.");
          return;
        }
        setState("done");
      })();
    },
    [link, password, confirmation],
  );

  if (!link) {
    return (
      <div role="alert" className="banner banner--warn">
        <p>This reset link is missing its token — it may be broken or already used.</p>
        <p className="sub">Request a new one from Settings.</p>
      </div>
    );
  }

  if (state === "done") {
    return (
      <p role="status" className="caption">
        Your password has been reset. You&apos;re signed in on this device.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="stack stack--tight">
      <p className="caption">
        Resetting for <span className="ltr-island">{link.email}</span>.
      </p>
      <label>
        New password
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label>
        Confirm new password
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
      </label>
      <button type="submit" className="btn btn--primary hit" disabled={state === "submitting"}>
        {state === "submitting" ? "Resetting…" : "Reset password"}
      </button>
      {error ? (
        <p role="alert" className="caption">
          {error}
        </p>
      ) : null}
    </form>
  );
}
