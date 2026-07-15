// Sign-in (FR7). When a real Google client id is configured, this renders the
// Google Identity Services (GIS) button and exchanges the returned ID token for a
// session cookie. In local dev with no client id (or GOOGLE_MOCK), it falls back
// to a mock credential so the flow is testable offline. On success it adopts the
// anonymous local history (outbox flush). Consumes iman-ui.css .btn.

import { useEffect, useRef, useState } from "react";
import { signInWithGoogle, mockCredential } from "../sync/auth.ts";

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";
const GIS_SRC = "https://accounts.google.com/gsi/client";

// Minimal GIS typings (the script attaches window.google.accounts.id).
interface GisId {
  initialize(cfg: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GisId } };
  }
}

function loadGis(): Promise<GisId | null> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    const onload = () => resolve(window.google?.accounts?.id ?? null);
    if (existing) {
      existing.addEventListener("load", onload, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener("load", onload, { once: true });
    s.addEventListener("error", () => resolve(null), { once: true });
    document.head.appendChild(s);
  });
}

export function SignIn({ onSignedIn }: { onSignedIn: (email: string) => void }) {
  const btnRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gisReady, setGisReady] = useState(false);

  const complete = async (credential: string) => {
    setBusy(true);
    setError(null);
    const r = await signInWithGoogle(credential);
    setBusy(false);
    if (r.ok && r.email) onSignedIn(r.email);
    else setError(r.error ?? "sign-in failed");
  };

  // Try to render the real GIS button when a client id is configured.
  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    void loadGis().then((gis) => {
      if (cancelled || !gis || !btnRef.current) return;
      gis.initialize({ client_id: CLIENT_ID, callback: (res) => void complete(res.credential) });
      gis.renderButton(btnRef.current, { theme: "outline", size: "large", text: "signin_with" });
      setGisReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* Real Google button mounts here when GIS is available. */}
      <div ref={btnRef} />
      {/* Fallback (no client id, or GIS blocked/offline): mock sign-in. */}
      {!gisReady && (
        <button
          className="btn"
          disabled={busy}
          onClick={() => void complete(mockCredential("user-zero", "user-zero@example.com"))}
        >
          {busy ? "Signing in…" : CLIENT_ID ? "Sign in (fallback)" : "Sign in & sync"}
        </button>
      )}
      {error && <p className="caption">{error}</p>}
    </div>
  );
}
