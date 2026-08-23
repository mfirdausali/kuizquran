"use client";

// THE ADMIN CLIENT-SIDE GATE — wraps `(admin)`'s layout so `/workbench` and
// every `/settings/*` screen render staff chrome ONLY for a real,
// server-verified admin. Named unbuilt since v3-D92 and repeated through
// v3-D100/D124/D125/D126, each entry's own docblock explicit about why it
// waited: "shipping half of it — a redirect with no server enforcement
// behind it — would be security theatre." That half now exists
// (`POST /api/admin/login`, already tested since step 24) plus its check
// (new, this run: `GET /api/admin/whoami`, behind the exact same `admin`
// middleware chain every real admin write already sits behind) — so this
// gate is backed by a real verdict, not an invented flag.
//
// WHAT THIS GATE IS NOT. Every admin API route was ALREADY protected
// server-side before this file existed — `EnsureIsAdmin` gates every write,
// and the reads this console makes are either admin-gated too or (verifications,
// overrides, specs) deliberately public transparency reads, as each admin
// route's own docblock states. This component changes NOTHING about what
// data an unauthorized request can reach; it only stops a non-admin visitor
// from seeing the staff CHROME and the "this screen requires an admin
// account" error banners `lib/admin/*.ts`'s `unavailable`/`403` branches
// already render in their place.
//
// SERVER COMPONENTS AS CHILDREN. `(admin)/layout.tsx` is a server component;
// `AdminGate` wraps its `{children}` (which may themselves be server-rendered
// pages, e.g. `/workbench`'s corpus load) — passing already-rendered
// server output through a client component's `children` prop is a supported
// React/Next pattern; this component never inspects or clones its children.

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { adminLogin, adminLogout, checkAdminSession, type AdminSession } from "@/lib/admin/session";

export function AdminGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession>({ state: "checking" });

  const refresh = useCallback(() => {
    setSession({ state: "checking" });
    void (async () => setSession(await checkAdminSession()))();
  }, []);

  useEffect(() => {
    void (async () => setSession(await checkAdminSession()))();
  }, []);

  if (session.state === "checking") {
    // No content flash: a visitor with a live admin token should never see
    // the login form paint-then-vanish, and a non-admin should never see
    // staff chrome paint-then-vanish either.
    return (
      <div className="screen">
        <p className="caption">Checking admin session…</p>
      </div>
    );
  }

  if (session.state === "authorized") {
    return (
      <div>
        <div className="admin-session-bar">
          <span className="caption">
            Signed in as <span className="ltr-island">{session.identity.pseudonym}</span>
            {session.identity.roles.length > 0 ? ` · ${session.identity.roles.join(", ")}` : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              adminLogout();
              refresh();
            }}
          >
            Sign out
          </button>
        </div>
        {children}
      </div>
    );
  }

  return <AdminLoginForm onSignedIn={refresh} deniedReason={session.state === "denied" ? session.reason : null} />;
}

function AdminLoginForm({
  onSignedIn,
  deniedReason,
}: {
  onSignedIn: () => void;
  /** A real server-side error (network/parse failure), distinct from
   *  `error` below — see `checkAdminSession`'s `denied` state. Shown as
   *  context, never conflated with a login attempt's own denial. */
  deniedReason: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      void (async () => {
        const outcome = await adminLogin(email, password);
        setSubmitting(false);
        // Echoed verbatim — see session.ts's header: never elaborated.
        if (!outcome.ok) {
          setError(outcome.error ?? "Not authorized for operator access.");
          return;
        }
        onSignedIn();
      })();
    },
    [email, password, onSignedIn],
  );

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Admin sign-in</h1>
          <p className="caption">Staff tooling. Not a learner surface.</p>
        </header>
        {deniedReason ? <p className="caption">{deniedReason}</p> : null}
        <form onSubmit={submit} className="stack">
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
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
          <button type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          {error ? (
            <p role="alert" className="caption">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
