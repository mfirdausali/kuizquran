"use client";

// THE AUDIT LOG PANEL (build-plan step 24, M8) — "nav homes for
// flags/reports/templates/audit viewer," the missing face of
// `Admin\AdminAuditController`.
//
// `admin_audit` has been written since the console shipped — reveal
// identity, bulk CSV export, atom-cache rebuild, the Stripe connection
// probe — with no route under `apps/web` ever reading it back. This panel
// is that missing face, mirroring `FlagsPanel`'s load/error/ready shape and
// `lib/admin/audit.ts`'s three-state discipline.
//
// EVERY FIELD IS RENDERED VERBATIM. The actor and subject are the server's
// own pseudonyms; this component neither re-derives nor re-formats an
// identity, the same rule `lib/admin/reveal.ts`'s consumers already follow.
// `ip`/`requestId` (v3-D164) render the same way — a null `requestId` (no
// `X-Request-Id` header on the original request) prints "—", never a blank
// cell that could be misread as a missing/broken value.
//
// EGRESS: through `lib/admin/audit.ts`, which itself goes through
// `apiFetch` only (check-boundaries.mjs clause 6).

import { useCallback, useEffect, useState } from "react";
import { loadAudit, type AuditLoad } from "@/lib/admin/audit";

export function AuditLogPanel() {
  const [subjectDraft, setSubjectDraft] = useState("");
  const [appliedSubject, setAppliedSubject] = useState<string | undefined>(undefined);
  const [load, setLoad] = useState<AuditLoad>({ state: "loading" });

  const refresh = useCallback((subject: string | undefined) => {
    setLoad({ state: "loading" });
    void (async () => setLoad(await loadAudit(subject)))();
  }, []);

  useEffect(() => {
    refresh(appliedSubject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSubject]);

  const onFilter = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = subjectDraft.trim();
      setAppliedSubject(trimmed === "" ? undefined : trimmed);
    },
    [subjectDraft],
  );

  const onClear = useCallback(() => {
    setSubjectDraft("");
    setAppliedSubject(undefined);
  }, []);

  return (
    <section className="card" aria-labelledby="audit-h">
      <div className="card-header">
        <h2 id="audit-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          AUDIT LOG
        </h2>
      </div>

      <form onSubmit={onFilter} className="stack" aria-label="Filter the audit log">
        <label>
          Subject pseudonym (optional)
          <input
            type="text"
            placeholder="u_7f3a19bcde01"
            value={subjectDraft}
            onChange={(e) => setSubjectDraft(e.target.value)}
          />
        </label>
        <div className="stack" style={{ flexDirection: "row" }}>
          <button type="submit" className="btn">
            Filter
          </button>
          {appliedSubject ? (
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
            {appliedSubject ? `No audit activity for ${appliedSubject}.` : "No audit activity recorded yet."}
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
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Reason</th>
                  <th scope="col">IP</th>
                  <th scope="col">Request</th>
                </tr>
              </thead>
              <tbody>
                {load.entries.map((e, i) => (
                  <tr key={`${e.at}-${i}`}>
                    <td>{new Date(e.at).toISOString()}</td>
                    <td>
                      <code className="ltr-island">{e.actor}</code>
                    </td>
                    <td>{e.action}</td>
                    <td>
                      {e.subjectPseudonym ? <code className="ltr-island">{e.subjectPseudonym}</code> : "—"}
                    </td>
                    <td>
                      <div className="caption">{e.reasonCode}</div>
                      {e.reasonText}
                    </td>
                    <td>{e.ip ? <code className="ltr-island">{e.ip}</code> : "—"}</td>
                    <td>{e.requestId ? <code className="ltr-island">{e.requestId}</code> : "—"}</td>
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
