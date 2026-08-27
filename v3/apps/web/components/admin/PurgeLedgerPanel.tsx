"use client";

// THE PURGE LEDGER PANEL — the missing UI half of the new
// `Admin\PurgeLedgerController`.
//
// `purge_ledger` has been written every night by `pdpa:purge-due` since PDPA
// delete/purge shipped (v3-D79/D80), with no route under `apps/web` ever
// reading it back. This panel is that missing face, mirroring
// `AuditLogPanel`/`FlagAuditPanel`/`BillingAuditPanel`'s load/error/ready
// shape and `lib/admin/purgeLedger.ts`'s three-state discipline.
//
// EVERY FIELD IS RENDERED VERBATIM. The subject is the server's own
// pseudonym; this component never re-derives or re-formats it.
//
// THE FILTER IS A RAW LEARNER ID, NOT A PSEUDONYM — same reasoning as
// `BillingAuditPanel`'s own filter: `purge_ledger.user_id` is pseudonymized
// only at READ time, and a pseudonym cannot be reversed into the raw id the
// query needs.
//
// EGRESS: through `lib/admin/purgeLedger.ts`, which itself goes through
// `apiFetch` only (check-boundaries.mjs clause 6).

import { useCallback, useEffect, useState } from "react";
import { loadPurgeLedger, type PurgeLedgerLoad } from "@/lib/admin/purgeLedger";

export function PurgeLedgerPanel() {
  const [userIdDraft, setUserIdDraft] = useState("");
  const [appliedUserId, setAppliedUserId] = useState<number | undefined>(undefined);
  const [load, setLoad] = useState<PurgeLedgerLoad>({ state: "loading" });

  const refresh = useCallback((userId: number | undefined) => {
    setLoad({ state: "loading" });
    void (async () => setLoad(await loadPurgeLedger(userId)))();
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
    <section className="card" aria-labelledby="purge-ledger-h">
      <div className="card-header">
        <h2 id="purge-ledger-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          PDPA PURGE LEDGER
        </h2>
      </div>

      <form onSubmit={onFilter} className="stack" aria-label="Filter the purge ledger">
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
              ? `No purge recorded for learner ${appliedUserId}.`
              : "No accounts have been purged yet."}
          </p>
        ) : (
          <>
            <p className="caption">
              Most recent {load.entries.length} of up to {load.limit} entries, newest first.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Purged</th>
                  <th scope="col">Learner</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {load.entries.map((e, i) => (
                  <tr key={`${e.purgedAtMs}-${i}`}>
                    <td>{new Date(e.purgedAtMs).toISOString()}</td>
                    <td>
                      <code className="ltr-island">{e.subjectPseudonym}</code>
                    </td>
                    <td>{e.reason}</td>
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
