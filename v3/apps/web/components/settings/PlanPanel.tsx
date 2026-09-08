"use client";

// YOUR PLAN (v3-D182) — the first learner-facing render of the entitlement
// snapshot `lib/entitlement/sync.ts` has fetched and cached since v3-D88, and
// `SessionIsland.tsx`'s mount effect has kept warm since the entry right
// after v3-D89. Until this panel, the only screen that showed entitlement
// data at all was the ADMIN billing console (`/settings/billing`) — a
// learner thirteen days into a fourteen-day trial had no way to see that
// anywhere in their own account.
//
// Same three-state discipline as `AnchorHourPanel`/`AccountDeletionPanel`: a
// failed read never paints a false default. Tries a LIVE refresh first (most
// current answer for a screen a learner opens specifically to check this);
// falls back to the last cached snapshot on failure (never punishes an
// offline learner with a blank card — the same "server is authoritative,
// cache absent/stale never denies" posture `cache.ts`/`gate.ts` already
// hold, applied here to DISPLAY rather than gating); only genuinely
// unavailable (no live fetch AND no prior cache — a brand-new device,
// currently offline) shows the unavailable banner.
//
// Deliberately makes no PERMISSION decision — `permitsIssuance`/
// `permitsReview` stay untouched, unwired-on-purpose (DECISIONS.md
// v3-D88/v3-D151). This only prints what `buildPlanSummary` (pure) computes
// from a snapshot the app already fetched.

import { useEffect, useState } from "react";
import { readEntitlementSnapshot, refreshEntitlementSnapshot } from "@/lib/entitlement/sync";
import { buildPlanSummary } from "@/lib/settings/planSummary";
import type { EntitlementSnapshot } from "@/lib/entitlement/types";

type View =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; snapshot: EntitlementSnapshot; stale: boolean };

export function PlanPanel() {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fresh = await refreshEntitlementSnapshot(Date.now());
      if (cancelled) return;
      if (fresh) {
        setView({ kind: "ready", snapshot: fresh, stale: false });
        return;
      }
      const cached = await readEntitlementSnapshot();
      if (cancelled) return;
      if (cached) {
        setView({ kind: "ready", snapshot: cached, stale: true });
        return;
      }
      setView({ kind: "unavailable" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (view.kind === "loading") {
    return <p className="caption">Checking your plan…</p>;
  }

  if (view.kind === "unavailable") {
    return (
      <div className="banner banner--warn" role="alert">
        <p>Could not read your plan status.</p>
        <p className="sub">Reconnect to check — nothing about your access has changed.</p>
      </div>
    );
  }

  const summary = buildPlanSummary(view.snapshot, Date.now());

  return (
    <div className="stack stack--tight">
      <p role="status" className="caption">
        {summary.stateSentence}
      </p>
      <p className="caption">
        Plan: <strong>{summary.tierLabel}</strong> · Region: <strong>{summary.region}</strong>
      </p>
      {view.stale ? (
        <p className="caption">
          Showing your last known status from{" "}
          <span className="ltr-island">{new Date(view.snapshot.cachedAt).toISOString()}</span> —
          reconnect to refresh.
        </p>
      ) : null}
    </div>
  );
}
