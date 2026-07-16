// ROADMAP Phase 5 — the minimal "account adoption" surface v2-D03 calls for:
// claim this device's anonymous history with an email+password (register), or
// restore an existing account's history onto a fresh device (login). Social
// sign-in is deferred (v2-D52) — this ships the email path only, the
// simplest reasonable default under the v2-D31 autonomous-loop authorization.
import { useEffect, useState } from "react";
import { login, me, register, logout, type MeInfo } from "./auth.ts";
import { flush, hydrate } from "./outbox.ts";

type Mode = "status" | "register" | "login";

export function Account() {
  const [info, setInfo] = useState<MeInfo | null>(null);
  const [mode, setMode] = useState<Mode>("status");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => void me().then(setInfo);
  useEffect(refresh, []);

  async function submit(kind: "register" | "login") {
    if (!email || password.length < 8) {
      setError("Email + a password of at least 8 characters are required.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = kind === "register" ? await register(email, password) : await login(email, password);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      setBusy(false);
      return;
    }
    // register: push this device's full history under the now-claimed account.
    // login: pull the existing account's history down onto this device.
    if (kind === "register") await flush();
    else await hydrate();
    setBusy(false);
    setMode("status");
    setEmail("");
    setPassword("");
    refresh();
  }

  if (!info) return null; // offline at boot — the sync status is simply not shown yet

  return (
    <div style={{ borderTop: "var(--hairline) solid var(--border)", paddingTop: 8, marginTop: 4 }}>
      <p className="caption">
        {info.isAnonymous
          ? "Syncing on this device only."
          : `Synced as ${info.email}`}
      </p>

      {mode === "status" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {info.isAnonymous && (
            <button className="btn btn--ghost" onClick={() => setMode("register")}>
              Save my progress →
            </button>
          )}
          <button className="btn btn--ghost" onClick={() => setMode("login")}>
            Sign in on this device →
          </button>
          {!info.isAnonymous && (
            <button
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void logout().then(() => {
                  setBusy(false);
                  refresh();
                });
              }}
            >
              Sign out
            </button>
          )}
        </div>
      )}

      {(mode === "register" || mode === "login") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%" }}
          />
          <input
            type="password"
            placeholder="password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%" }}
          />
          {error && <p className="caption" style={{ color: "var(--warn-fg)" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn--primary"
              disabled={busy}
              onClick={() => void submit(mode === "register" ? "register" : "login")}
            >
              {mode === "register" ? "Save progress" : "Sign in"}
            </button>
            <button
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => {
                setMode("status");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
