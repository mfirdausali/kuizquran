"use client";

// THE PRIVACY PANEL (build-plan step 24, M8) — the missing frontend face of
// `Admin\RevealController` and `Admin\AdminUsersController::exportCsv`.
//
// WIREFRAME §16: "Every learner is pseudonymous everywhere (`u_7f3a…`). Email
// and name sit behind a Reveal identity action requiring a typed reason,
// audit-logged, auto-re-masking after 15 minutes. Bulk CSV exports strip
// identity entirely." Both backends have been live and fully tested
// (`AdminPrivacyTest.php`) since build-plan step 24, but nothing under
// `apps/web` ever called either — see `lib/admin/reveal.ts`'s own header for
// the "built + tested + zero production callers" history.
//
// THE OPERATOR SUPPLIES A USER ID (from a support ticket, a pseudonym lookup
// elsewhere, etc.) — there is deliberately no "browse all learners and click
// one" list here. `AdminUsersController` exposes no JSON listing endpoint,
// only the identity-free bulk CSV; inventing a paginated user-listing route
// to back a picker is real, separate backend scope this panel does not add.
//
// AUTO-RE-MASKING (§16) is client-side countdown UI only — the identity
// this component holds in React state is not persisted, so a page reload or
// navigating away already re-masks it by construction. The countdown and the
// disabled state past `expiresAt` are a courtesy, not the enforcement: the
// server independently refuses a `check` past its own TTL regardless of what
// this component believes the time is (`lib/admin/reveal.ts`'s own header on
// `CheckResult` — the refusal is server-decided, not re-derived here).

import { useEffect, useState } from "react";
import {
  REVEAL_REASON_CODES,
  checkRevealToken,
  revealIdentity,
  type RevealResult,
} from "@/lib/admin/reveal";
import { downloadUsersCsv } from "@/lib/admin/users";

const REASON_LABELS: Record<string, string> = {
  support_ticket: "Support ticket",
  billing_dispute: "Billing dispute",
  abuse_report: "Abuse report",
  legal_request: "Legal request",
  data_subject_request: "Data subject request",
};

function RevealResultView({ result, now }: { result: RevealResult; now: number }) {
  if (result.state === "revealed") {
    const remainingMs = result.expiresAt - now;
    const expired = remainingMs <= 0;
    return (
      <div className="stack" data-testid="reveal-result">
        <p>
          <strong>{result.pseudonym}</strong>
        </p>
        <p>
          {result.email}
          {result.name ? ` — ${result.name}` : ""}
        </p>
        <p className="caption" role="status">
          {expired
            ? "This reveal has expired — it re-masks automatically."
            : `Re-masks in ${Math.max(0, Math.ceil(remainingMs / 1000))}s.`}
        </p>
      </div>
    );
  }

  if (result.state === "anonymous") {
    return (
      <p role="status" data-testid="reveal-result">
        {result.pseudonym} is anonymous — no identity held.
      </p>
    );
  }

  if (result.state === "not-found") {
    return (
      <p role="status" data-testid="reveal-result">
        No such account.
      </p>
    );
  }

  return null;
}

export function PrivacyPanel() {
  const [userId, setUserId] = useState("");
  const [reasonCode, setReasonCode] = useState<string>(REVEAL_REASON_CODES[0]);
  const [reasonText, setReasonText] = useState("");
  const [acknowledgePii, setAcknowledgePii] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RevealResult | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The countdown is display-only (see the module header) — it never gates
  // the server's own TTL enforcement, only what this screen shows while the
  // token is presumed live.
  useEffect(() => {
    if (result?.state !== "revealed") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [result]);

  const onReveal = () => {
    const id = Number.parseInt(userId, 10);
    if (!Number.isFinite(id) || id <= 0) return;
    setBusy(true);
    setResult(null);
    void (async () => {
      const outcome = await revealIdentity(id, {
        reasonCode,
        reasonText,
        acknowledgePiiWarning: acknowledgePii,
      });
      setBusy(false);
      setNow(Date.now());
      setResult(outcome);
      if (outcome.state === "revealed") setAcknowledgePii(false);
    })();
  };

  const [recheckMessage, setRecheckMessage] = useState<string | null>(null);
  const onRecheck = () => {
    if (result?.state !== "revealed") return;
    void (async () => {
      const check = await checkRevealToken(result.revealToken);
      setRecheckMessage(
        check.state === "valid"
          ? "Still live."
          : check.state === "invalid"
            ? "No longer valid — re-masked."
            : check.reason,
      );
    })();
  };

  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const onExportCsv = () => {
    setCsvBusy(true);
    setCsvMessage(null);
    void (async () => {
      const outcome = await downloadUsersCsv();
      setCsvBusy(false);
      setCsvMessage(outcome.message);
    })();
  };

  const reasonTooShort = reasonText.trim().length > 0 && reasonText.trim().length < 10;
  const canSubmit = userId.trim() !== "" && reasonText.trim().length >= 10 && !busy;

  return (
    <div className="stack">
      <section className="card" aria-labelledby="reveal-h">
        <div className="card-header">
          <h2 id="reveal-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
            REVEAL IDENTITY
          </h2>
        </div>
        <div className="stack">
          <label>
            User id
            <input
              type="number"
              min={1}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </label>

          <label>
            Reason
            <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              {REVEAL_REASON_CODES.map((code) => (
                <option key={code} value={code}>
                  {REASON_LABELS[code] ?? code}
                </option>
              ))}
            </select>
          </label>

          <label>
            Details (min. 10 characters — reference the pseudonym, never the person)
            <textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
          </label>
          {reasonTooShort ? <p className="caption">At least 10 characters.</p> : null}

          {result?.state === "pii-warning" ? (
            <div className="stack" role="alert" data-testid="pii-warning">
              <p>{result.hint || "This reason appears to contain identifying information."}</p>
              <ul>
                {result.detected.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <label>
                <input
                  type="checkbox"
                  checked={acknowledgePii}
                  onChange={(e) => setAcknowledgePii(e.target.checked)}
                />
                I acknowledge this reason text may contain identifying information.
              </label>
            </div>
          ) : null}

          {result?.state === "rejected" ? (
            <p role="alert" className="caption">
              {result.reason}
            </p>
          ) : null}

          <button type="button" className="btn" onClick={onReveal} disabled={!canSubmit}>
            Reveal
          </button>

          {result ? <RevealResultView result={result} now={now} /> : null}

          {result?.state === "revealed" ? (
            <div className="stack">
              <button type="button" className="btn btn--ghost" onClick={onRecheck}>
                Re-check token
              </button>
              {recheckMessage ? (
                <p className="caption" role="status">
                  {recheckMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="card" aria-labelledby="export-h">
        <div className="card-header">
          <h2 id="export-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
            EXPORT USERS (CSV)
          </h2>
        </div>
        <div className="stack">
          <p className="caption">
            Pseudonym, signup date, anonymity flag, event count. No email, no name — there is no
            option to add them.
          </p>
          <button type="button" className="btn" onClick={onExportCsv} disabled={csvBusy}>
            Download users.csv
          </button>
          {csvMessage ? (
            <p className="caption" role="status">
              {csvMessage}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
