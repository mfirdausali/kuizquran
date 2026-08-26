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

import { useCallback, useEffect, useState } from "react";
import { loadBillingAudit, type BillingAuditLoad } from "@/lib/admin/billingAudit";

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
