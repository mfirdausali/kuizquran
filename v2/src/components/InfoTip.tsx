// Reusable plain-language jargon tooltip (v2-D19). First applied to "half-life"
// on the Progress Report. Tap-to-toggle, not hover-only (v2-D28 — hover-only
// affordances fail on a phone, the primary surface).
import { useState, type ReactNode } from "react";

export function InfoTip({ label = "?", children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="infotip">
      <button
        type="button"
        className="infotip-trigger"
        aria-expanded={open}
        aria-label="More info"
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <span className="infotip-bubble" role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}
