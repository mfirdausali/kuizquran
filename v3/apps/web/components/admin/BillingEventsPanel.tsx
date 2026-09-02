"use client";

// THE RAW WEBHOOK JOURNAL PANEL — the missing face of the new
// `Admin\BillingEventsController` (v3-D148).
//
// `billing_events` has been written on every inbound Stripe delivery since
// build-plan step 23 with no route under `apps/web` ever reading it back.
// This panel mirrors `BillingAuditPanel`/`AuditLogPanel`/`FlagAuditPanel`'s
// load/error/ready shape and `lib/admin/billingEvents.ts`'s three-state
// discipline. Unlike `BillingAuditPanel` above it on the same page, this
// panel is READ-ONLY — the journal is written exclusively by
// `WebhookHandler::ingest()`, never by an admin action.
//
// EVERY FIELD IS RENDERED VERBATIM. The subject is the server's own pseudonym
// (or absent); this component neither re-derives nor re-formats it.
//
// THE `outcome` FILTER lets an operator triaging failures narrow straight to
// `error` rather than scrolling a mixed 200-row list — the exact question
// this journal exists to answer that `BillingAuditPanel` above cannot: a
// webhook that never reached a state change leaves no row there at all.

import { useCallback, useEffect, useState } from "react";
import { loadBillingEvents, type BillingEventsLoad } from "@/lib/admin/billingEvents";

const OUTCOME_OPTIONS = ["applied", "ignored_duplicate", "ignored_stale", "ignored_unhandled", "error"];

export function BillingEventsPanel() {
  const [userIdDraft, setUserIdDraft] = useState("");
  const [appliedUserId, setAppliedUserId] = useState<number | undefined>(undefined);
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [load, setLoad] = useState<BillingEventsLoad>({ state: "loading" });

  const refresh = useCallback((userId: number | undefined, outcome: string) => {
    setLoad({ state: "loading" });
    void (async () => setLoad(await loadBillingEvents({ userId, outcome: outcome === "" ? undefined : outcome })))();
  }, []);

  useEffect(() => {
    refresh(appliedUserId, outcomeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedUserId, outcomeFilter]);

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
    setOutcomeFilter("");
  }, []);

  return (
    <section className="card" aria-labelledby="billing-events-h">
      <div className="card-header">
        <h2 id="billing-events-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          BILLING EVENTS (RAW WEBHOOK JOURNAL)
        </h2>
      </div>
      <p className="caption">
        Every inbound webhook delivery, whether or not it changed anything — including deliveries this
        app ignores or a delivery that failed mid-processing. Read-only.
      </p>

      <form onSubmit={onFilter} className="stack" aria-label="Filter the billing events journal">
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
        <label>
          Outcome
          <select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)}>
            <option value="">(any)</option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <div className="stack" style={{ flexDirection: "row" }}>
          <button type="submit" className="btn">
            Filter
          </button>
          {appliedUserId !== undefined || outcomeFilter !== "" ? (
            <button type="button" className="btn" onClick={onClear}>
              Clear filters
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
          <p className="caption">No matching deliveries recorded.</p>
        ) : (
          <>
            <p className="caption">
              Most recent {load.entries.length} of up to {load.limit} entries, newest first.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Received</th>
                  <th scope="col">Provider created</th>
                  <th scope="col">Processed</th>
                  <th scope="col">Provider event</th>
                  <th scope="col">Type</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Learner</th>
                  <th scope="col">Error</th>
                </tr>
              </thead>
              <tbody>
                {load.entries.map((e, i) => (
                  <tr key={`${e.providerEventId}-${i}`}>
                    <td>{new Date(e.receivedAt).toISOString()}</td>
                    <td>{e.providerCreatedAt !== null ? new Date(e.providerCreatedAt).toISOString() : "—"}</td>
                    <td>{e.processedAt !== null ? new Date(e.processedAt).toISOString() : "—"}</td>
                    <td>
                      <code className="ltr-island">{e.providerEventId}</code>
                    </td>
                    <td>{e.type}</td>
                    <td>{e.outcome ?? "—"}</td>
                    <td>
                      {e.subjectPseudonym !== null ? (
                        <code className="ltr-island">{e.subjectPseudonym}</code>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{e.error ?? "—"}</td>
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
