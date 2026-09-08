"use client";

// THE ADMIN ROLES PANEL — the missing UI half of the new
// `Admin\AdminRolesController`.
//
// `admin_roles` has been written by `admin:grant-role` since v3-D92, with no
// route under `apps/web` ever reading it back. This panel is that missing
// face, mirroring `AuditLogPanel`/`PurgeLedgerPanel`'s load/error/ready shape
// and `lib/admin/roles.ts`'s three-state discipline.
//
// EVERY FIELD IS RENDERED VERBATIM. The subject is the server's own
// pseudonym; this component never re-derives or re-formats it.
//
// THE USERID FILTER IS A RAW ADMIN ID, NOT A PSEUDONYM — same reasoning as
// `PurgeLedgerPanel`'s own filter: `admin_roles.user_id` is pseudonymized
// only at READ time, and a pseudonym cannot be reversed into the raw id the
// query needs.
//
// EGRESS: through `lib/admin/roles.ts`, which itself goes through
// `apiFetch` only (check-boundaries.mjs clause 6).

import { useCallback, useEffect, useState } from "react";
import { loadAdminRoles, type AdminRoleValue, type AdminRolesLoad } from "@/lib/admin/roles";

const ROLE_OPTIONS: readonly AdminRoleValue[] = ["operator", "qari", "moderator"];

export function AdminRolesPanel() {
  const [roleFilter, setRoleFilter] = useState<AdminRoleValue | "">("");
  const [userIdDraft, setUserIdDraft] = useState("");
  const [appliedUserId, setAppliedUserId] = useState<number | undefined>(undefined);
  const [load, setLoad] = useState<AdminRolesLoad>({ state: "loading" });

  const refresh = useCallback((role: AdminRoleValue | "", userId: number | undefined) => {
    setLoad({ state: "loading" });
    void (async () =>
      setLoad(await loadAdminRoles({ role: role === "" ? undefined : role, userId })))();
  }, []);

  useEffect(() => {
    refresh(roleFilter, appliedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, appliedUserId]);

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
    <section className="card" aria-labelledby="admin-roles-h">
      <div className="card-header">
        <h2 id="admin-roles-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          ADMIN ROLES
        </h2>
      </div>

      <form onSubmit={onFilter} className="stack" aria-label="Filter admin role grants">
        <label>
          Role
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as AdminRoleValue | "")}>
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          Admin id (optional — from the database)
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
          <p className="caption">No admin role grants recorded yet.</p>
        ) : (
          <>
            <p className="caption">
              Most recent {load.entries.length} of up to {load.limit} entries, newest first.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Admin</th>
                  <th scope="col">Role</th>
                  <th scope="col">Granted</th>
                  <th scope="col">Granted by</th>
                </tr>
              </thead>
              <tbody>
                {load.entries.map((e, i) => (
                  <tr key={`${e.grantedAt}-${i}`}>
                    <td>
                      <code className="ltr-island">{e.subjectPseudonym}</code>
                    </td>
                    <td>{e.role}</td>
                    <td>{new Date(e.grantedAt).toISOString()}</td>
                    <td>{e.grantedBy}</td>
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
