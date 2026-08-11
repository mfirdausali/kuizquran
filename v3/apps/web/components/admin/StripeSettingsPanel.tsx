"use client";

// THE STRIPE CREDENTIAL PANEL.
//
// Shows each field the app consumes, whether it is installed, which mode it is
// in, a last-four fingerprint, and — the part worth having — a live probe
// against Stripe, because "present and correctly prefixed" is not the same as
// "works". A revoked key looks perfectly well-formed until the first charge.
//
// The values themselves are set in the API environment; see the page header and
// `StripeSettingsController` for why the server refuses to store them. This
// component never receives a secret: the API returns presence, mode and a
// fingerprint, and a server-side test asserts the raw body carries no secret.
//
// All egress goes through `apiFetch` — `check-boundaries.mjs` clause 6 makes it
// the single egress point, so the 401 re-mint interceptor cannot be bypassed.

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/sync/apiFetch";

interface StripeField {
  env: string;
  label: string;
  purpose: string;
  present: boolean;
  validPrefix: boolean | null;
  fingerprint: string | null;
  setVia: string;
}

interface ReplaySuite {
  fixtureCount: number;
  green: boolean;
  blocker: string | null;
}

interface StripeSettings {
  fields: StripeField[];
  replaySuite?: ReplaySuite;
  configured: boolean;
  mode: "live" | "test" | null;
  mixedModes: boolean;
  webhookUrl: string;
  note: string;
}

interface ProbeResult {
  ok: boolean;
  reason?: string;
  message: string;
  livemode?: boolean | null;
}

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: StripeSettings };

export function StripeSettingsPanel() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probing, setProbing] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await apiFetch("/admin/stripe");
        if (!alive) return;
        if (!res.ok) {
          setLoad({
            kind: "error",
            message:
              res.status === 403
                ? "This screen requires an admin account."
                : `Could not load settings (HTTP ${res.status}).`,
          });
          return;
        }
        setLoad({ kind: "ready", data: (await res.json()) as StripeSettings });
      } catch {
        if (alive) setLoad({ kind: "error", message: "Could not reach the API." });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const runProbe = useCallback(() => {
    setProbing(true);
    setProbe(null);
    void (async () => {
      try {
        const res = await apiFetch("/admin/stripe/test", { method: "POST" });
        setProbe((await res.json()) as ProbeResult);
      } catch {
        setProbe({ ok: false, reason: "unreachable", message: "Could not reach the API." });
      } finally {
        setProbing(false);
      }
    })();
  }, []);

  if (load.kind === "loading") {
    return <p className="caption">Loading…</p>;
  }
  if (load.kind === "error") {
    return <p className="caption">{load.message}</p>;
  }

  const { data } = load;

  return (
    <div className="stack">
      {data.mixedModes ? (
        // A live secret beside a test publishable key fails at the first real
        // payment. It is the loudest thing on this screen for that reason.
        <section className="card">
          <p style={{ margin: 0, fontWeight: 600 }}>Mixed live and test credentials</p>
          <p className="caption">
            Some keys are live and others are test. Payments will fail in ways
            that are hard to diagnose. Set every key to the same mode.
          </p>
        </section>
      ) : null}

      <section className="card">
        <div className="card-header">
          <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>CREDENTIALS</h2>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Status</th>
              <th scope="col">Installed</th>
            </tr>
          </thead>
          <tbody>
            {data.fields.map((f) => (
              <tr key={f.env}>
                <td>
                  <div style={{ fontWeight: 600 }}>{f.label}</div>
                  <div className="caption">{f.purpose}</div>
                  <div className="caption">
                    <code>{f.env}</code>
                  </div>
                </td>
                <td>
                  {!f.present
                    ? "Not set"
                    : f.validPrefix === false
                      ? "Unexpected format"
                      : "Set"}
                </td>
                <td>
                  {/* A last-four fingerprint: enough to confirm WHICH key is
                      live, never enough to use one. */}
                  <code>{f.fingerprint ?? "—"}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="caption">{data.note}</p>
        <p className="caption">
          Set these in the API environment, then restart the API so config is
          re-read.
        </p>
      </section>

      {data.replaySuite && !data.replaySuite.green ? (
        // PAY-1 / M7's exit criterion, shown where it is actionable. The replay
        // suite reports INCOMPLETE over an empty fixture set rather than passing
        // vacuously (v3-D50 on the revenue path), and whoever is configuring
        // credentials is exactly the person who can then record fixtures.
        <section className="card">
          <p style={{ margin: 0, fontWeight: 600 }}>
            Replay suite is red — {data.replaySuite.fixtureCount} recorded events
          </p>
          <p className="caption">{data.replaySuite.blocker}</p>
        </section>
      ) : null}

      <section className="card">
        <div className="card-header">
          <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>CONNECTION</h2>
        </div>
        <p className="caption">
          Mode: {data.mode ?? "unknown"} · Webhook endpoint:{" "}
          <code>{data.webhookUrl}</code>
        </p>
        <button
          type="button"
          className="btn"
          onClick={runProbe}
          disabled={probing || !data.configured}
        >
          {probing ? "Testing…" : "Test connection"}
        </button>
        {!data.configured ? (
          <p className="caption">Set every credential before testing.</p>
        ) : null}
        {probe ? (
          <p className="caption" role="status">
            {probe.message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
