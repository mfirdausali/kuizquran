"use client";

// THE SYSTEM HEALTH PANEL (build-plan step 24, M8) — "System Health (both
// checks, coverage alerts, degraded banner, rebuild with mutex)."
//
// `Admin\SystemHealthController` (`GET /api/admin/health`, `POST
// /api/admin/health/rebuild-atom-cache`) shipped fully tested — 7 tests
// including edge case #167 (unknown vs. a genuine 0) and #168 (the rebuild
// mutex) — with no route under `apps/web` ever calling it. This panel is
// that missing face, mirroring `StripeSettingsPanel`'s own shape (load /
// error / ready) and `lib/admin/health.ts#loadHealth`'s three-state
// discipline exactly, for the same reason #167 states: a screen that cannot
// tell "0 divergences" from "we could not ask" is worse than no screen.
//
// WHAT THIS PANEL DELIBERATELY DOES NOT DO. `SystemHealthController::METRICS`
// registers `atom_cache_coverage`, `events_ingested_24h` and
// `dead_letter_depth` as CLOSED-SET members (kept apart from the forbidden
// engagement-bait metrics, WIREFRAME §16). `dead_letter_depth` now has a real
// producer — edge case #130's quarantine count from
// `DeterminismCheckCommand::sampleFromDatabase()`/`record()` — so `index()`
// computes all three of `fold_determinism_check`, `selection_determinism_check`
// and `dead_letter_depth`; this panel needs no change to show the third row,
// since the table below already renders `report.checks` generically. Only
// `atom_cache_coverage` and `events_ingested_24h` still have no backend
// implementation to read. Inventing placeholder rows for THOSE two would be
// the same "manufactures confidence" mistake `ExplainTrace`'s own header
// warns against.
//
// EGRESS: through `lib/admin/health.ts`, which itself goes through
// `apiFetch` only (check-boundaries.mjs clause 6).

import { useCallback, useEffect, useState } from "react";
import { loadHealth, rebuildAtomCache, type HealthLoad, type RebuildOutcome } from "@/lib/admin/health";

export function SystemHealthPanel() {
  const [load, setLoad] = useState<HealthLoad>({ state: "loading" });
  const [rebuilding, setRebuilding] = useState(false);
  const [outcome, setOutcome] = useState<RebuildOutcome | null>(null);

  const refresh = useCallback(() => {
    setLoad({ state: "loading" });
    void (async () => setLoad(await loadHealth()))();
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const result = await loadHealth();
      if (alive) setLoad(result);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onRebuild = useCallback(() => {
    setRebuilding(true);
    setOutcome(null);
    void (async () => {
      const result = await rebuildAtomCache();
      setOutcome(result);
      setRebuilding(false);
      // A completed (non-queued) rebuild changed the world this panel
      // reports on — re-read it rather than leave the last-loaded checks
      // stale beside a fresh "rebuild complete" message.
      if (result.ok) refresh();
    })();
  }, [refresh]);

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

  const { report } = load;
  // "Degraded" = any check that is not a genuine, observed `ok` — an
  // unreported check is exactly as much a reason to look as a divergent one
  // (#167: unknown is not healthy, it is blind).
  const degraded = report.checks.some((c) => c.status !== "ok");

  return (
    <div className="stack">
      {degraded ? (
        <div className="banner banner--warn" role="alert">
          <p>At least one check is not confirmed healthy.</p>
          <p className="sub">
            An `unknown` check has not reported at all — it is not the same
            as a clean 0, and it is not safe to read as one.
          </p>
        </div>
      ) : null}

      <section className="card" aria-labelledby="health-checks-h">
        <div className="card-header">
          <h2 id="health-checks-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
            DETERMINISM CHECKS
          </h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Check</th>
              <th scope="col">Status</th>
              <th scope="col">Value</th>
              <th scope="col">Detail</th>
            </tr>
          </thead>
          <tbody>
            {report.checks.map((c) => (
              <tr key={c.metric}>
                <td>
                  <code>{c.metric}</code>
                </td>
                <td>{c.status}</td>
                {/* #167 in markup: a null value renders as an em dash, never
                    a fabricated 0 — the two must never look the same. */}
                <td>{c.value === null ? "—" : c.value}</td>
                <td className="caption">{c.detail ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" aria-labelledby="health-rebuild-h">
        <div className="card-header">
          <h2 id="health-rebuild-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
            ATOM CACHE
          </h2>
        </div>
        <p className="caption">
          Re-derives every learner&apos;s atom cache from their own event log.
          Never invents state — WIREFRAME §16: &quot;staff may never edit
          graded state.&quot;
        </p>
        <button
          type="button"
          className="btn"
          onClick={onRebuild}
          disabled={rebuilding || report.rebuildRunning}
        >
          {rebuilding ? "Rebuilding…" : "Rebuild atom cache"}
        </button>
        {report.rebuildRunning && !rebuilding ? (
          <p className="caption">A rebuild is already running.</p>
        ) : null}
        {outcome ? (
          <p className="caption" role="status">
            {outcome.ok
              ? `Rebuild complete — ${outcome.usersProcessed ?? 0} learner(s), ${outcome.atomsWritten ?? 0} atom(s) written.`
              : outcome.message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
