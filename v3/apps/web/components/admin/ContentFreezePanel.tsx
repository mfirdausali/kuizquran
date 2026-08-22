"use client";

// THE CONTENT-FREEZE PANEL (build-plan step 28, M9) — "may this corpus be
// booked for a qari session."
//
// `Admin\ContentFreezeController` (`GET /api/admin/content-freeze`) shipped
// fully tested — `tests/Feature/ContentFreeze/ContentFreezeTest.php` — with
// no route under `apps/web` ever calling it. This panel is that missing face,
// mirroring `SystemHealthPanel`'s load/unavailable/ready discipline exactly,
// for the same reason: a screen that cannot tell "0 criteria met" from "we
// could not ask" is worse than no screen, and here the stakes are booking a
// scholar against content nobody actually checked.
//
// WHAT THIS PANEL DELIBERATELY DOES NOT DO. The controller's own docblock is
// explicit: "THIS ENDPOINT NEVER FREEZES ANYTHING. Freezing is a human act."
// This panel has no freeze/book button — it only reports. The build-artifact
// half of the gate (scene beats, hashSpecVersion, QA sample sign-off) lives in
// `scripts/content-freeze.mjs`, run by hand; this panel renders only the
// database-side criteria the controller itself computes, and says so via the
// controller's own `note` field.
//
// EGRESS: through `lib/admin/contentFreeze.ts`, which itself goes through
// `apiFetch` only (check-boundaries.mjs clause 6).

import { useEffect, useState } from "react";
import { loadContentFreeze, type FreezeLoad } from "@/lib/admin/contentFreeze";

export function ContentFreezePanel() {
  const [load, setLoad] = useState<FreezeLoad>({ state: "loading" });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const result = await loadContentFreeze();
      if (alive) setLoad(result);
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  return (
    <div className="stack">
      {!report.bookable ? (
        <div className="banner banner--warn" role="alert">
          <p>Not bookable — at least one database-side criterion is not met.</p>
        </div>
      ) : null}

      <section className="card" aria-labelledby="freeze-criteria-h">
        <div className="card-header">
          <h2 id="freeze-criteria-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
            FREEZE CRITERIA — SURAH{report.surahs.length > 1 ? "S" : ""}{" "}
            <span className="ltr-island">{report.surahs.join(", ")}</span>
          </h2>
        </div>
        <ul className="stack stack--tight" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {report.criteria.map((c) => (
            <li key={c.name} className="stack stack--tight">
              <p>
                <span aria-hidden="true">{c.met ? "✓" : "✗"}</span>{" "}
                <span className="sr-only">{c.met ? "Met: " : "Not met: "}</span>
                {c.name}
              </p>
              {c.evidence.length > 0 ? (
                <ul className="caption" style={{ margin: 0, paddingInlineStart: "1.5em" }}>
                  {c.evidence.map((e, i) => (
                    // Evidence lines are free text composed server-side from
                    // ayah numbers and counts, never user input — a stable
                    // index key is fine, the list is never reordered.
                    // eslint-disable-next-line react/no-array-index-key
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="caption">{report.note}</p>
      </section>
    </div>
  );
}
