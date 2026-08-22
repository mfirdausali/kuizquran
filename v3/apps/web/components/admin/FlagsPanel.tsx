"use client";

// THE FLAG PLANE PANEL (build-plan step 26, M8) — "Flag plane, all OFF" plus
// M8's own "nav homes for flags/reports/templates/audit viewer."
//
// `Admin\FlagController` (`GET /api/admin/flags`, plus `kill`/`enable`/`ack`)
// shipped fully tested — 13 tests including #126 (kill always wins a
// concurrent race), #127 (an immediate cache bust), #159 (an ack never
// re-enables) and the M10 security-review versionless-ramp fix — with no
// route under `apps/web` ever calling it. This panel is that missing face,
// mirroring `SystemHealthPanel`'s load/error/ready shape and
// `lib/admin/flags.ts`'s three-state discipline.
//
// KILL STAYS ONE CLICK. The ceremony (enable) is the ONLY multi-field form
// here, on purpose — BUILD-PLAN's ethics gate names friction on the kill
// path as the failure mode to avoid, and friction on the enable path as the
// feature. This panel adds no client-side validation of the ceremony beyond
// what makes the form usable (disabling Confirm until every field is
// non-empty) — the actual rules (>=20 chars, verbatim name, both booleans)
// are asserted only by the server, and its own error response is rendered
// verbatim rather than re-derived.
//
// EGRESS: through `lib/admin/flags.ts`, which itself goes through `apiFetch`
// only (check-boundaries.mjs clause 6).

import { useCallback, useEffect, useState } from "react";
import {
  acknowledgeFlag,
  enableFlag,
  killFlag,
  loadFlags,
  type EnableCeremonyInput,
  type FlagRow,
  type FlagsLoad,
} from "@/lib/admin/flags";

interface CeremonyDraft {
  reason: string;
  typedFlagName: string;
  acknowledgesRetentionRisk: boolean;
  acknowledgesNoDarkPattern: boolean;
}

const EMPTY_DRAFT: CeremonyDraft = {
  reason: "",
  typedFlagName: "",
  acknowledgesRetentionRisk: false,
  acknowledgesNoDarkPattern: false,
};

function FlagRowView({
  flag,
  onChanged,
}: {
  flag: FlagRow;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ceremonyOpen, setCeremonyOpen] = useState(false);
  const [draft, setDraft] = useState<CeremonyDraft>(EMPTY_DRAFT);
  const [ceremonyErrors, setCeremonyErrors] = useState<Record<string, string>>({});

  const onKill = useCallback(() => {
    setBusy(true);
    setMessage(null);
    void (async () => {
      const outcome = await killFlag(flag.key);
      setMessage(outcome.message);
      setBusy(false);
      if (outcome.ok) onChanged();
    })();
  }, [flag.key, onChanged]);

  const onAck = useCallback(() => {
    setBusy(true);
    setMessage(null);
    void (async () => {
      const outcome = await acknowledgeFlag(flag.key);
      setMessage(outcome.message);
      setBusy(false);
      if (outcome.ok) onChanged();
    })();
  }, [flag.key, onChanged]);

  const onConfirmEnable = useCallback(() => {
    const input: EnableCeremonyInput = {
      reason: draft.reason,
      typedFlagName: draft.typedFlagName,
      acknowledgesRetentionRisk: draft.acknowledgesRetentionRisk,
      acknowledgesNoDarkPattern: draft.acknowledgesNoDarkPattern,
      version: flag.version,
    };
    setBusy(true);
    setMessage(null);
    setCeremonyErrors({});
    void (async () => {
      const outcome = await enableFlag(flag.key, input);
      setBusy(false);
      if (outcome.ok) {
        setCeremonyOpen(false);
        setDraft(EMPTY_DRAFT);
        onChanged();
        return;
      }
      setMessage(outcome.message);
      setCeremonyErrors(outcome.errors ?? {});
    })();
  }, [draft, flag.key, flag.version, onChanged]);

  const ceremonyComplete =
    draft.reason.trim().length > 0 &&
    draft.typedFlagName.trim().length > 0 &&
    draft.acknowledgesRetentionRisk &&
    draft.acknowledgesNoDarkPattern;

  return (
    <tr>
      <td>
        <code>{flag.key}</code>
        <div className="caption">{flag.description}</div>
        {flag.bannerVisible ? (
          <p className="caption" role="alert">
            Killed{flag.killedAt ? ` at ${flag.killedAt}` : ""} — not yet acknowledged.
            {flag.ackAutoWaived ? " (auto-waived after 72h)" : ""}
          </p>
        ) : null}
      </td>
      <td>{flag.enabled ? "ON" : "OFF"}</td>
      <td>{flag.version}</td>
      <td>
        <div className="stack">
          {flag.enabled ? (
            <button type="button" className="btn" onClick={onKill} disabled={busy}>
              Kill
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => setCeremonyOpen((v) => !v)}
              disabled={busy}
            >
              Enable…
            </button>
          )}
          {flag.bannerVisible ? (
            <button type="button" className="btn" onClick={onAck} disabled={busy}>
              Acknowledge
            </button>
          ) : null}
          {message ? (
            <p className="caption" role="status">
              {message}
            </p>
          ) : null}

          {ceremonyOpen ? (
            <div data-testid={`flag-ceremony-${flag.key}`} className="stack">
              <label>
                Reason (min. 20 characters)
                <textarea
                  value={draft.reason}
                  onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
                />
              </label>
              {ceremonyErrors.reason ? (
                <p className="caption" role="alert">
                  {ceremonyErrors.reason}
                </p>
              ) : null}

              <label>
                Type the flag name to confirm
                <input
                  type="text"
                  value={draft.typedFlagName}
                  onChange={(e) => setDraft((d) => ({ ...d, typedFlagName: e.target.value }))}
                />
              </label>
              {ceremonyErrors.typed_flag_name ? (
                <p className="caption" role="alert">
                  {ceremonyErrors.typed_flag_name}
                </p>
              ) : null}

              <label>
                <input
                  type="checkbox"
                  checked={draft.acknowledgesRetentionRisk}
                  onChange={(e) => setDraft((d) => ({ ...d, acknowledgesRetentionRisk: e.target.checked }))}
                />
                I acknowledge the retention risk of this ramp.
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={draft.acknowledgesNoDarkPattern}
                  onChange={(e) => setDraft((d) => ({ ...d, acknowledgesNoDarkPattern: e.target.checked }))}
                />
                I acknowledge this ramp introduces no dark pattern.
              </label>

              <button
                type="button"
                className="btn"
                onClick={onConfirmEnable}
                disabled={busy || !ceremonyComplete}
              >
                Confirm enable
              </button>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function FlagsPanel() {
  const [load, setLoad] = useState<FlagsLoad>({ state: "loading" });

  const refresh = useCallback(() => {
    setLoad({ state: "loading" });
    void (async () => setLoad(await loadFlags()))();
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const result = await loadFlags();
      if (alive) setLoad(result);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (load.state === "loading") {
    return <p className="caption">Loading…</p>;
  }

  if (load.state === "unavailable") {
    return (
      <p className="caption" role="alert">
        {load.reason}
      </p>
    );
  }

  return (
    <section className="card" aria-labelledby="flags-h">
      <div className="card-header">
        <h2 id="flags-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          FLAGS
        </h2>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Flag</th>
            <th scope="col">State</th>
            <th scope="col">Version</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {load.flags.map((f) => (
            <FlagRowView key={f.key} flag={f} onChanged={refresh} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
