"use client";

// THE DAILY ANCHOR HOUR (v3-D140) — a secular preferred time of day, purely
// informational. This panel adds NO reminder/notification delivery of any
// kind (there is none anywhere in this app) — the landing page's own FAQ
// promises "no guilt notifications... a reminder that they failed" is not a
// claim this panel touches. It only lets a learner state, and see, when
// their day is centered.
//
// Same three-state discipline as `AccountDeletionPanel`: a failed read never
// paints a false default, and the picker is not offered until the real
// current value is known.

import { useCallback, useEffect, useState } from "react";
import { anchorTime, DEFAULT_DAY_CONFIG } from "@engine/daybound.ts";
import { currentTz } from "@/lib/idb";
import { ANCHOR_CHOICES, fetchAnchorHour, updateAnchorHour } from "@/lib/settings/anchorHour.ts";

type View =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: string }
  /** `saved` is the CONFIRMED value — never the in-flight attempt. A failed
   *  save must keep reporting the value the server actually holds, not the
   *  one that was just rejected. */
  | { kind: "idle"; saved: number }
  | { kind: "saving"; saved: number }
  | { kind: "save-error"; saved: number; reason: string };

function formatHour(hour: number, tz: string): string {
  const now = Date.now();
  const at = anchorTime(now, { ...DEFAULT_DAY_CONFIG, tz, anchorHour: hour });
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(at));
}

export function AnchorHourPanel() {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    void (async () => {
      const result = await fetchAnchorHour();
      if (result.state === "failed") {
        setView({ kind: "unavailable", reason: result.reason });
        return;
      }
      setView({ kind: "idle", saved: result.anchorHour });
    })();
  }, []);

  const choose = useCallback((hour: number, saved: number) => {
    setView({ kind: "saving", saved });
    void (async () => {
      const result = await updateAnchorHour(hour);
      if (result.state === "failed") {
        setView({ kind: "save-error", saved, reason: result.reason });
        return;
      }
      setView({ kind: "idle", saved: result.anchorHour });
    })();
  }, []);

  if (view.kind === "loading") {
    return <p className="caption">Checking your anchor…</p>;
  }
  if (view.kind === "unavailable") {
    return (
      <div className="banner banner--warn" role="alert">
        <p>Could not read your daily anchor.</p>
        <p className="sub">
          Reason: <code>{view.reason}</code>.
        </p>
      </div>
    );
  }

  const tz = currentTz();
  const saved = view.saved;

  return (
    <div className="stack stack--tight">
      <p className="caption">
        A time of day that&apos;s yours — no reminder, no notification, just a
        quiet anchor for when you show up. Changeable any time.
      </p>
      <p role="status" className="caption">
        Today&apos;s anchor: <strong>{formatHour(saved, tz)}</strong>
      </p>
      <div className="stack stack--tight">
        {ANCHOR_CHOICES.map((choice) => (
          <button
            key={choice.label}
            type="button"
            className={choice.hour === saved ? "btn btn--primary hit" : "btn hit"}
            aria-pressed={choice.hour === saved}
            disabled={view.kind === "saving"}
            onClick={() => choose(choice.hour, saved)}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {view.kind === "save-error" ? (
        <div className="banner banner--warn" role="alert">
          <p>Could not save your anchor.</p>
          <p className="sub">
            Reason: <code>{view.reason}</code>. Still set to {formatHour(saved, tz)}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
