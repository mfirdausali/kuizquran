"use client";

// THE BILLING AUDIT PANEL — BUILD-PLAN M7's own named deliverable, never
// built until now: "admin billing surface." The missing face of the new
// `Admin\AdminBillingController`.
//
// `entitlement_transitions` has been written since the entitlement state
// machine shipped — every webhook, every trial start, every reconcile —
// with no route under `apps/web` ever reading it back. This panel is that
// missing face, mirroring `AuditLogPanel`/`FlagAuditPanel`'s load/error/ready
// shape and `lib/admin/billingAudit.ts`'s three-state discipline.
//
// EVERY FIELD IS RENDERED VERBATIM. Both identities are the server's own
// pseudonyms; this component neither re-derives nor re-formats one.
//
// THE FILTER IS A RAW LEARNER ID, NOT A PSEUDONYM — unlike `AuditLogPanel`'s
// subject filter (`admin_audit.subject_pseudonym` is already pseudonymized at
// write time, so filtering BY the pseudonym the operator already has is
// exact), `entitlement_transitions.user_id` is pseudonymized only at READ
// time here. A pseudonym is one-way by design (edge case #147) and cannot be
// reversed into the raw id the query needs, so this filter takes the raw id
// the way an operator already has it from a support ticket — the same
// convention `lib/admin/reveal.ts`'s form already established.
//
// EGRESS: through `lib/admin/billingAudit.ts`, which itself goes through
// `apiFetch` only (check-boundaries.mjs clause 6).
//
// THE OVERRIDE FORM (v3-D147) IS THE ONE WRITE ON THIS SCREEN. Everything
// above is read-only. `App\Billing\EntitlementMachine::CAUSE_ADMIN_OVERRIDE`
// existed since the state machine shipped with no caller anywhere — this
// form is that caller. The client-side "state or tier required" check is
// advisory only; the server enforces the same rule and its 422 message
// renders verbatim on rejection, same discipline as `FlagsPanel`'s ceremony
// form.
//
// "LOOK UP CURRENT SNAPSHOT" (v3-D279): `override()`'s own 409 says, verbatim,
// "Re-read and retry" — this button is what finally makes that performable.
// Until now there was no admin-facing read of a learner's CURRENT entitlement
// row anywhere (the transition log above never stored tier/region/trialSurah/
// currentPeriodEnd/graceUntil/provider ids at all, and `GET /api/entitlement`
// is hard-scoped to the calling learner's own id). A successful override
// re-reads automatically if a snapshot is already on screen, so it never goes
// stale right after the write that would make it stale.

import { useCallback, useEffect, useState } from "react";
import {
  loadBillingAudit,
  loadBillingSnapshot,
  submitBillingOverride,
  type BillingAuditLoad,
  type BillingSnapshotLoad,
  type BillingStateValue,
  type BillingTierValue,
} from "@/lib/admin/billingAudit";

const STATE_OPTIONS: BillingStateValue[] = ["trial", "active", "grace", "lapsed_review_only"];
const TIER_OPTIONS: BillingTierValue[] = ["none", "monthly", "lifetime"];

export function BillingAuditPanel() {
  const [userIdDraft, setUserIdDraft] = useState("");
  const [appliedUserId, setAppliedUserId] = useState<number | undefined>(undefined);
  const [load, setLoad] = useState<BillingAuditLoad>({ state: "loading" });

  const refresh = useCallback((userId: number | undefined) => {
    setLoad({ state: "loading" });
    void (async () => setLoad(await loadBillingAudit(userId)))();
  }, []);

  useEffect(() => {
    refresh(appliedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedUserId]);

  // ---- the admin override form (v3-D147) ----
  const [overrideUserIdDraft, setOverrideUserIdDraft] = useState("");
  const [overrideState, setOverrideState] = useState<BillingStateValue | "">("");
  const [overrideTier, setOverrideTier] = useState<BillingTierValue | "">("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);
  const [overrideBusy, setOverrideBusy] = useState(false);

  // v3-D279 — makes override()'s own 409 ("Re-read and retry") literally
  // performable for the first time: a real read of the CURRENT snapshot,
  // not the transition log above, which never stored tier/region/trialSurah/
  // currentPeriodEnd/graceUntil/provider ids at all.
  const [snapshot, setSnapshot] = useState<BillingSnapshotLoad | null>(null);

  const lookUp = useCallback(() => {
    const parsed = Number.parseInt(overrideUserIdDraft.trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSnapshot({ state: "unavailable", reason: "enter a valid learner id" });
      return;
    }
    setSnapshot({ state: "loading" });
    void (async () => setSnapshot(await loadBillingSnapshot(parsed)))();
  }, [overrideUserIdDraft]);

  const onOverride = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const parsed = Number.parseInt(overrideUserIdDraft.trim(), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setOverrideMessage("enter a valid learner id");
        return;
      }
      // CLIENT-SIDE, ADVISORY ONLY — the server enforces this same rule (422
      // "at least one of state or tier is required") and its message would
      // render just as honestly; this check only saves a round trip.
      if (overrideState === "" && overrideTier === "") {
        setOverrideMessage("choose a state or a tier to override");
        return;
      }

      setOverrideBusy(true);
      void (async () => {
        const outcome = await submitBillingOverride(parsed, {
          state: overrideState === "" ? undefined : overrideState,
          tier: overrideTier === "" ? undefined : overrideTier,
          reason: overrideReason,
        });
        setOverrideBusy(false);
        setOverrideMessage(
          outcome.ok ? `applied — state: ${outcome.state}, tier: ${outcome.tier}` : outcome.message,
        );
        if (outcome.ok) {
          refresh(appliedUserId);
          // A 409 says "Re-read and retry" — a successful apply re-reads too,
          // so the snapshot on screen (if one was looked up) never goes stale
          // the moment it would matter most: right after a write.
          if (snapshot !== null) setSnapshot(await loadBillingSnapshot(parsed));
        }
      })();
    },
    [overrideUserIdDraft, overrideState, overrideTier, overrideReason, appliedUserId, refresh, snapshot],
  );

  const onFilter = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = userIdDraft.trim();
      if (trimmed === "") {
        setAppliedUserId(undefined);
        return;
      }
      const parsed = Number.parseInt(trimmed, 10);
      setAppliedUserId(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
    },
    [userIdDraft],
  );

  const onClear = useCallback(() => {
    setUserIdDraft("");
    setAppliedUserId(undefined);
  }, []);

  return (
    <section className="card" aria-labelledby="billing-audit-h">
      <div className="card-header">
        <h2 id="billing-audit-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          BILLING AUDIT
        </h2>
      </div>

      <form onSubmit={onFilter} className="stack" aria-label="Filter the billing audit">
        <label>
          Learner id (optional — from a support ticket)
          <input
            type="text"
            inputMode="numeric"
            placeholder="42"
            value={userIdDraft}
            onChange={(e) => setUserIdDraft(e.target.value)}
          />
        </label>
        <div className="stack" style={{ flexDirection: "row" }}>
          <button type="submit" className="btn">
            Filter
          </button>
          {appliedUserId !== undefined ? (
            <button type="button" className="btn" onClick={onClear}>
              Clear filter
            </button>
          ) : null}
        </div>
      </form>

      <form onSubmit={onOverride} className="stack" aria-label="Override a learner's billing state">
        <label>
          Target user id
          <input
            type="text"
            inputMode="numeric"
            placeholder="42"
            value={overrideUserIdDraft}
            onChange={(e) => setOverrideUserIdDraft(e.target.value)}
          />
        </label>
        <button type="button" className="btn" onClick={lookUp}>
          Look up current snapshot
        </button>
        {snapshot !== null && snapshot.state === "loading" ? <p className="caption">Looking up…</p> : null}
        {snapshot !== null && snapshot.state === "unavailable" ? (
          <p className="caption" role="alert">
            {snapshot.reason}
          </p>
        ) : null}
        {snapshot !== null && snapshot.state === "ready" ? (
          snapshot.snapshot.exists ? (
            <dl className="stack" aria-label="Current billing snapshot">
              <div>
                <dt>State</dt>
                <dd>{snapshot.snapshot.state}</dd>
              </div>
              <div>
                <dt>Tier</dt>
                <dd>{snapshot.snapshot.tier}</dd>
              </div>
              <div>
                <dt>Region</dt>
                <dd>{snapshot.snapshot.region}</dd>
              </div>
              <div>
                <dt>Trial surah</dt>
                <dd>{snapshot.snapshot.trialSurah ?? "—"}</dd>
              </div>
              <div>
                <dt>Trial started</dt>
                <dd>
                  {snapshot.snapshot.trialStartedAt !== null
                    ? new Date(snapshot.snapshot.trialStartedAt).toISOString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Current period end</dt>
                <dd>
                  {snapshot.snapshot.currentPeriodEnd !== null
                    ? new Date(snapshot.snapshot.currentPeriodEnd).toISOString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Grace until</dt>
                <dd>
                  {snapshot.snapshot.graceUntil !== null
                    ? new Date(snapshot.snapshot.graceUntil).toISOString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{snapshot.snapshot.provider ?? "—"}</dd>
              </div>
              <div>
                <dt>Provider customer</dt>
                <dd>
                  <code className="ltr-island">{snapshot.snapshot.providerCustomerId ?? "—"}</code>
                </dd>
              </div>
              <div>
                <dt>Provider subscription</dt>
                <dd>
                  <code className="ltr-island">{snapshot.snapshot.providerSubscriptionId ?? "—"}</code>
                </dd>
              </div>
              <div>
                <dt>State version</dt>
                <dd>{snapshot.snapshot.stateVersion ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="caption" role="status">
              No billing row for this learner — an override here would 404.
            </p>
          )
        ) : null}
        <label>
          State
          <select value={overrideState} onChange={(e) => setOverrideState(e.target.value as BillingStateValue | "")}>
            <option value="">(leave unchanged)</option>
            {STATE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tier
          <select value={overrideTier} onChange={(e) => setOverrideTier(e.target.value as BillingTierValue | "")}>
            <option value="">(leave unchanged)</option>
            {TIER_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reason
          <input
            type="text"
            placeholder="refund per support ticket 9911"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
        </label>
        <button type="submit" className="btn" disabled={overrideBusy}>
          Apply override
        </button>
        {overrideMessage !== null ? (
          <p className="caption" role="status">
            {overrideMessage}
          </p>
        ) : null}
      </form>

      {load.state === "loading" ? <p className="caption">Loading…</p> : null}

      {load.state === "unavailable" ? (
        <p className="caption" role="alert">
          {load.reason}
        </p>
      ) : null}

      {load.state === "ready" ? (
        load.entries.length === 0 ? (
          <p className="caption">
            {appliedUserId !== undefined
              ? `No billing activity for learner ${appliedUserId}.`
              : "No billing activity recorded yet."}
          </p>
        ) : (
          <>
            <p className="caption">
              Most recent {load.entries.length} of up to {load.limit} entries, newest first.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Learner</th>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">Cause</th>
                  <th scope="col">Provider event</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {load.entries.map((e, i) => (
                  <tr key={`${e.at}-${i}`}>
                    <td>{new Date(e.at).toISOString()}</td>
                    <td>
                      <code className="ltr-island">{e.subjectPseudonym}</code>
                    </td>
                    <td>{e.fromState ?? "—"}</td>
                    <td>{e.toState}</td>
                    <td>{e.cause}</td>
                    <td>{e.providerEventId ?? "—"}</td>
                    <td>
                      <code className="ltr-island">{e.actor}</code>
                    </td>
                    <td>{e.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      ) : null}
    </section>
  );
}
