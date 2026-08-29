"use client";

// THE LEARNER ACCOUNT SURFACE — the frontend half of DEFECTS.md#AUTH-,
// wiring `lib/account/auth.ts` into `/settings`. See that module's header
// for the full defect writeup (`AuthController`/`PasswordResetController`/
// `EmailVerificationController` fully built and tested since build-plan
// step 13 with zero frontend callers).
//
// THREE STATES, mirroring `AdminGate`'s own discipline: checking (no flash),
// an ANONYMOUS device (create-account / sign-in-to-an-existing-account, with
// forgot-password inline), and a NAMED account (email + verified status +
// sign out). Anonymous is a real, valid identity here — unlike the admin
// gate, this panel never blocks the rest of the app while anonymous.

import { useCallback, useEffect, useState } from "react";
import {
  checkAccountSession,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestPasswordReset,
  resendVerificationEmail,
  type AccountSession,
} from "@/lib/account/auth.ts";

export function AccountAuthPanel() {
  const [session, setSession] = useState<AccountSession>({ state: "checking" });

  const refresh = useCallback(() => {
    setSession({ state: "checking" });
    void (async () => setSession(await checkAccountSession()))();
  }, []);

  useEffect(() => {
    void (async () => setSession(await checkAccountSession()))();
  }, []);

  if (session.state === "checking") {
    return (
      <p className="caption">
        <span className="skel" aria-hidden="true" />{" "}
        <span className="sr-only">Checking your account…</span>
        checking your account…
      </p>
    );
  }

  if (session.state === "unavailable") {
    return (
      <div className="banner banner--warn" role="alert">
        <p>Could not read your account.</p>
        <p className="sub">
          Reason: <code>{session.reason}</code>. Everything you have already
          learned stays on this device either way.
        </p>
      </div>
    );
  }

  if (!session.identity.isAnonymous) {
    return <NamedAccountView email={session.identity.email} emailVerified={session.identity.emailVerified} onSignedOut={refresh} />;
  }

  return <AnonymousAccountView onSucceeded={refresh} />;
}

function NamedAccountView({
  email,
  emailVerified,
  onSignedOut,
}: {
  email: string | null;
  emailVerified: boolean;
  onSignedOut: () => void;
}) {
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [signingOut, setSigningOut] = useState(false);

  const resend = useCallback(() => {
    setResendState("sending");
    void (async () => {
      const outcome = await resendVerificationEmail();
      setResendState(outcome.ok ? "sent" : "error");
    })();
  }, []);

  const signOut = useCallback(() => {
    setSigningOut(true);
    void (async () => {
      await logoutAccount();
      setSigningOut(false);
      onSignedOut();
    })();
  }, [onSignedOut]);

  return (
    <div className="stack stack--tight">
      <p className="caption">
        Signed in as <span className="ltr-island">{email}</span>.
      </p>
      {emailVerified ? (
        <p className="caption">Email verified.</p>
      ) : (
        <div className="stack stack--tight">
          <p className="caption">Email not verified yet.</p>
          <button type="button" className="btn hit" onClick={resend} disabled={resendState === "sending"}>
            {resendState === "sending" ? "Sending…" : "Resend verification email"}
          </button>
          <p role="status" className="caption">
            {resendState === "sent" ? "Sent — check your inbox." : null}
            {resendState === "error" ? "Could not send it — try again in a moment." : null}
          </p>
        </div>
      )}
      <button type="button" className="btn hit" onClick={signOut} disabled={signingOut}>
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

type AnonymousMode = "create" | "sign-in";

function AnonymousAccountView({ onSucceeded }: { onSucceeded: () => void }) {
  const [mode, setMode] = useState<AnonymousMode>("create");

  return (
    <div className="stack stack--tight">
      <p className="caption">
        This device is not signed in to a named account yet. Everything you
        have learned so far stays right here either way.
      </p>
      <div className="stack stack--tight">
        <button type="button" className="btn hit" aria-pressed={mode === "create"} onClick={() => setMode("create")}>
          Create an account
        </button>
        <button type="button" className="btn hit" aria-pressed={mode === "sign-in"} onClick={() => setMode("sign-in")}>
          I already have an account
        </button>
      </div>
      {mode === "create" ? (
        <CreateAccountForm onSucceeded={onSucceeded} />
      ) : (
        <SignInForm onSucceeded={onSucceeded} />
      )}
    </div>
  );
}

function CreateAccountForm({ onSucceeded }: { onSucceeded: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      void (async () => {
        const outcome = await registerAccount(email, password, name);
        setSubmitting(false);
        if (!outcome.ok) {
          setError(outcome.error ?? "Could not create your account.");
          return;
        }
        onSucceeded();
      })();
    },
    [email, password, name, onSucceeded],
  );

  return (
    <form onSubmit={submit} className="stack stack--tight">
      <p className="caption">
        This claims the SAME device you are using right now — your existing
        history moves with it, nothing is reset.
      </p>
      <label>
        Email
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Password
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
        Name (optional)
        <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="submit" className="btn btn--primary hit" disabled={submitting}>
        {submitting ? "Creating…" : "Create account"}
      </button>
      {error ? (
        <p role="alert" className="caption">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function SignInForm({ onSucceeded }: { onSucceeded: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      void (async () => {
        const outcome = await loginAccount(email, password);
        setSubmitting(false);
        if (!outcome.ok) {
          setError(outcome.error ?? "Could not sign in.");
          return;
        }
        onSucceeded();
      })();
    },
    [email, password, onSucceeded],
  );

  return (
    <div className="stack stack--tight">
      <form onSubmit={submit} className="stack stack--tight">
        <p className="caption">
          Signing in switches THIS device to that account&apos;s own history —
          it replaces what this device shows, it does not merge it.
        </p>
        <label>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn--primary hit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        {error ? (
          <p role="alert" className="caption">
            {error}
          </p>
        ) : null}
      </form>
      <button type="button" className="btn" onClick={() => setShowForgot((v) => !v)}>
        Forgot your password?
      </button>
      {showForgot ? <ForgotPasswordForm /> : null}
    </div>
  );
}

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      void (async () => {
        await requestPasswordReset(email);
        setSubmitting(false);
        // Deliberately uniform regardless of the server's outcome — the
        // backend itself never reveals whether the address is registered
        // (PasswordResetController's own comment); this form matches that.
        setSent(true);
      })();
    },
    [email],
  );

  if (sent) {
    return (
      <p role="status" className="caption">
        If that email has an account, a reset link is on its way.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="stack stack--tight">
      <label>
        Email
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button type="submit" className="btn hit" disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
