"use client";

// THE 7-CONSECUTIVE-GREEN-NIGHTS WINDOW PANEL — the missing UI half of the
// new `Admin\NightlyWindowController`.
//
// BUILD-PLAN M10's launch gate has been computable since
// `NightlyWindowLedger` shipped, with no admin screen ever reading it back —
// an operator had to SSH in and run `php artisan nightly:window`. This panel
// is that missing face, mirroring `SystemHealthPanel`/`FlagAuditPanel`'s
// load/error/ready shape and `lib/admin/nightlyWindow.ts`'s three-state
// discipline.
//
// EVERY FIELD IS RENDERED VERBATIM — this component never re-derives the
// streak, the "blocked by" reason, or which check failed on which night;
// `NightlyWindowLedger::status()` owns all of that (edge case #169).
//
// EGRESS: through `lib/admin/nightlyWindow.ts`, which itself goes through
// `apiFetch` only (check-boundaries.mjs clause 6).

import { useCallback, useEffect, useState } from "react";
import { loadNightlyWindow, type NightlyWindowLoad } from "@/lib/admin/nightlyWindow";

export function NightlyWindowPanel() {
  const [load, setLoad] = useState<NightlyWindowLoad>({ state: "loading" });

  const refresh = useCallback(() => {
    setLoad({ state: "loading" });
    void (async () => setLoad(await loadNightlyWindow()))();
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <section className="card" aria-labelledby="nightly-window-h">
      <div className="card-header">
        <h2 id="nightly-window-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          7-CONSECUTIVE-GREEN-NIGHTS WINDOW
        </h2>
      </div>

      {load.state === "loading" ? <p className="caption">Loading…</p> : null}

      {load.state === "unavailable" ? (
        <p className="caption" role="alert">
          {load.reason}
        </p>
      ) : null}

      {load.state === "ready" ? (
        <>
          <p>
            <strong>
              {load.status.streak} of {load.status.required}
            </strong>{" "}
            — {load.status.satisfied ? "satisfied" : "not yet satisfied"}
          </p>
          <p className="caption">
            window started:{" "}
            {load.status.windowStartedAt ?? "NOT DECLARED"}
            {load.status.windowReason ? ` — ${load.status.windowReason}` : ""}
          </p>
          {load.status.blockedBy ? (
            <p className="caption" role="status">
              blocked by: {load.status.blockedBy}
            </p>
          ) : null}
          {load.status.lastP1 ? (
            <p className="caption" role="alert">
              last P1: {load.status.lastP1.night} ({load.status.lastP1.check}) — reset the window
            </p>
          ) : null}

          {load.status.nights.length === 0 ? (
            <p className="caption">No check runs recorded since the window start.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Night</th>
                  <th scope="col">Counts?</th>
                  <th scope="col">Checks</th>
                </tr>
              </thead>
              <tbody>
                {load.status.nights.map((n) => (
                  <tr key={n.night}>
                    <td>{n.night}</td>
                    <td>{n.green ? "green" : "NOT GREEN"}</td>
                    <td>
                      {[
                        ...Object.entries(n.severities).map(([check, sev]) => `${check}=${sev}`),
                        ...n.missing.map((m) => `${m}=MISSING`),
                      ].join("  ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </section>
  );
}
