// Restore signed-in state on load from the HttpOnly session cookie via /me — so a
// reload doesn't re-prompt sign-in (the cookie is valid ~30 days) and a returning
// user with server history skips onboarding.

import { useEffect, useState } from "react";
import { WORKER_URL } from "../sync/outbox.ts";
import { saveAnchor } from "../habit/Anchor.tsx";

export interface AuthState {
  loading: boolean;
  signedIn: boolean;
  email: string | null;
  /** True when the signed-in account already has server-side history (returning). */
  hasHistory: boolean;
  anchorHour: number | null;
}

/**
 * Restore auth + onboarding state from /me on load. A valid HttpOnly cookie means
 * the user stays signed in across reloads (no re-prompt); a returning account with
 * history skips onboarding.
 */
export function useAuth(): AuthState & { setEmail: (e: string) => void } {
  const [state, setState] = useState<AuthState>({
    loading: true,
    signedIn: false,
    email: null,
    hasHistory: false,
    anchorHour: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`${WORKER_URL}/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((me: { signedIn: boolean; email?: string; anchorHour?: number | null; hasHistory?: boolean }) => {
        if (cancelled) return;
        // Mirror the server anchor into local so the anchor step is skipped.
        if (me.signedIn && me.anchorHour != null) saveAnchor(me.anchorHour);
        setState({
          loading: false,
          signedIn: !!me.signedIn,
          email: me.email ?? null,
          hasHistory: !!me.hasHistory,
          anchorHour: me.anchorHour ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, setEmail: (email) => setState((s) => ({ ...s, signedIn: true, email })) };
}
