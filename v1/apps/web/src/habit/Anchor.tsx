// Anchor onboarding (FR9). ONE scheduling question — a daily TIME anchor, kept
// secular (D16/D34: no prayer names). Persists to the server (/settings) when
// signed in, and locally regardless. Consumes iman-ui.css.

import { useState } from "react";
import { WORKER_URL } from "../sync/outbox.ts";

const ANCHOR_KEY = "iman.anchorHour";

export function loadAnchor(): number | null {
  const raw = localStorage.getItem(ANCHOR_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}
export function saveAnchor(hour: number): void {
  try {
    localStorage.setItem(ANCHOR_KEY, String(hour));
  } catch {
    /* non-fatal */
  }
}

// A short list of friendly anchor times (hour of day, 24h).
const CHOICES: { label: string; hour: number }[] = [
  { label: "Early morning", hour: 5.5 },
  { label: "After breakfast", hour: 8 },
  { label: "Midday", hour: 13 },
  { label: "Late afternoon", hour: 17 },
  { label: "Evening", hour: 20 },
  { label: "Before sleep", hour: 22.5 },
];

export function Anchor({ onDone }: { onDone: (hour: number) => void }) {
  const [busy, setBusy] = useState(false);

  const pick = async (hour: number) => {
    setBusy(true);
    saveAnchor(hour);
    // best-effort server persist (ignored if signed out / offline)
    try {
      await fetch(`${WORKER_URL}/settings`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anchorHour: hour }),
      });
    } catch {
      /* offline / signed out — local anchor still set */
    }
    setBusy(false);
    onDone(hour);
  };

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>iman · Yusuf</span>
          <span>your anchor</span>
        </div>
        <p className="voice">When do you want your daily moment with the Qur'an?</p>
        <p className="caption">
          Pick a time you'll remember. We'll anchor your day around it — you can change it later.
        </p>
        {CHOICES.map((c) => (
          <button key={c.hour} className="btn" disabled={busy} onClick={() => void pick(c.hour)}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
