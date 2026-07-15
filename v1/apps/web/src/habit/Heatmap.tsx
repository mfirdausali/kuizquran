// Mushaf heatmap (FR9 P1). 111 ayah rows with strength bars; tap a row → per-word
// diagnostics (one tap deeper, diagnostics only — the ayah is the graded unit).
// Reuses engine ayahHeatmap/wordDiagnostics + .meter/.card from iman-ui.css.

import { useEffect, useMemo, useState } from "react";
import { ayahHeatmap, wordDiagnostics, type AtomsMap, type Corpus, type DrillEvent } from "engine";
import { getAll } from "../db/eventLog.ts";

export function Heatmap({
  corpus,
  atoms,
  onClose,
}: {
  corpus: Corpus;
  atoms: AtomsMap;
  onClose: () => void;
}) {
  const rows = useMemo(() => ayahHeatmap(corpus, atoms, Date.now()), [corpus, atoms]);
  const [open, setOpen] = useState<number | null>(null);
  const [events, setEvents] = useState<DrillEvent[]>([]);

  useEffect(() => {
    void getAll().then((e) => setEvents(e as DrillEvent[]));
  }, []);

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>Your Yusuf</span>
          <span>{rows.filter((r) => r.encoded).length} / 111 carried</span>
        </div>
        <p className="caption">Each row is an ayah; the bar is how firmly it's held. Tap to see its words.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map((r) => (
            <div key={r.ayah}>
              <button
                className="btn btn--ghost"
                style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left", padding: "4px 6px" }}
                onClick={() => setOpen(open === r.ayah ? null : r.ayah)}
              >
                <span className="caption" style={{ minWidth: 34 }}>
                  12:{r.ayah}
                </span>
                <span className="meter" style={{ flex: 1 }}>
                  <div style={{ width: `${r.strength}%` }} />
                </span>
                <span className="caption" style={{ minWidth: 34, textAlign: "right" }}>
                  {r.encoded ? `${r.strength}%` : "—"}
                </span>
              </button>
              {open === r.ayah && <WordRow corpus={corpus} events={events} ayah={r.ayah} />}
            </div>
          ))}
        </div>
        <button className="btn btn--primary" onClick={onClose}>
          Back
        </button>
      </div>
    </div>
  );
}

function WordRow({ corpus, events, ayah }: { corpus: Corpus; events: DrillEvent[]; ayah: number }) {
  const diag = wordDiagnostics(corpus, events, ayah);
  return (
    <div className="bank" style={{ padding: "4px 6px 8px" }}>
      {diag.map((w) => (
        <span
          key={w.position}
          className="tile"
          style={{
            opacity: w.accuracy === null ? 0.4 : 0.5 + 0.5 * w.accuracy,
            fontSize: 14,
          }}
          title={w.accuracy === null ? "not practiced" : `${Math.round(w.accuracy * 100)}% (${w.taps})`}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}
