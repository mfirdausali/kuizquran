"use client";

// THE FLAG AUDIT PANEL (build-plan step 26, M8) — "nav homes for
// flags/reports/templates/audit viewer," the missing face of the new
// `Admin\FlagAuditController`.
//
// `flag_ramp_audit` has been written since the flag plane shipped — every
// kill, every ramp, every ack, including the unattended scheduler's
// auto-waive — with no route under `apps/web` ever reading it back. This
// panel is that missing face, mirroring `AuditLogPanel`'s load/error/ready
// shape and `lib/admin/flagAudit.ts`'s three-state discipline.
//
// EVERY FIELD IS RENDERED VERBATIM. The actor is the server's own pseudonym
// (or `null` for a system action, rendered as "system" — never a blank cell
// and never a fabricated identity); this component neither re-derives nor
// re-formats it.
//
// EGRESS: through `lib/admin/flagAudit.ts`, which itself goes through
// `apiFetch` only (check-boundaries.mjs clause 6).

import { useCallback, useEffect, useState } from "react";
import { loadFlagAudit, type FlagAuditLoad } from "@/lib/admin/flagAudit";

export function FlagAuditPanel() {
  const [flagDraft, setFlagDraft] = useState("");
  const [appliedFlag, setAppliedFlag] = useState<string | undefined>(undefined);
  const [load, setLoad] = useState<FlagAuditLoad>({ state: "loading" });

  const refresh = useCallback((flagKey: string | undefined) => {
    setLoad({ state: "loading" });
    void (async () => setLoad(await loadFlagAudit(flagKey)))();
  }, []);

  useEffect(() => {
    refresh(appliedFlag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFlag]);

  const onFilter = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = flagDraft.trim();
      setAppliedFlag(trimmed === "" ? undefined : trimmed);
    },
    [flagDraft],
  );

  const onClear = useCallback(() => {
    setFlagDraft("");
    setAppliedFlag(undefined);
  }, []);

  return (
    <section className="card" aria-labelledby="flag-audit-h">
      <div className="card-header">
        <h2 id="flag-audit-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          RAMP AUDIT
        </h2>
      </div>

      <form onSubmit={onFilter} className="stack" aria-label="Filter the flag ramp audit">
        <label>
          Flag key (optional)
          <input
            type="text"
            placeholder="social.leaderboard"
            value={flagDraft}
            onChange={(e) => setFlagDraft(e.target.value)}
          />
        </label>
        <div className="stack" style={{ flexDirection: "row" }}>
          <button type="submit" className="btn">
            Filter
          </button>
          {appliedFlag ? (
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
            {appliedFlag ? `No ramp activity for ${appliedFlag}.` : "No ramp activity recorded yet."}
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
                  <th scope="col">Flag</th>
                  <th scope="col">Action</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Retention ack</th>
                  <th scope="col">No dark pattern ack</th>
                  <th scope="col">Typed name</th>
                </tr>
              </thead>
              <tbody>
                {load.entries.map((e, i) => {
                  // The enable-hard ceremony's two acknowledgements and typed
                  // name only exist for an "enable" row — `FlagService::kill`/
                  // `acknowledgeKill` never collect them, and the migration's
                  // own defaults (`false`/`false`/`null`) are not a person's
                  // real "no": rendering them as "—" (never a fabricated "no")
                  // matches this table's own actor/reason discipline.
                  const hadCeremony = e.action === "enable";
                  return (
                    <tr key={`${e.at}-${i}`}>
                      <td>{new Date(e.at).toISOString()}</td>
                      <td>
                        <code className="ltr-island">{e.flagKey}</code>
                      </td>
                      <td>{e.action}</td>
                      <td>{e.actor ? <code className="ltr-island">{e.actor}</code> : "system"}</td>
                      <td>{e.reason ?? "—"}</td>
                      <td>{hadCeremony ? (e.acknowledgesRetentionRisk ? "yes" : "no") : "—"}</td>
                      <td>{hadCeremony ? (e.acknowledgesNoDarkPattern ? "yes" : "no") : "—"}</td>
                      <td>{e.typedFlagName ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )
      ) : null}
    </section>
  );
}
