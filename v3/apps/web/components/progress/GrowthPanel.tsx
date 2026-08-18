// THE GROWTH PANEL — v2-D17/D20's Progress Report growth curve, rendered.
//
// PRESENTATIONAL ONLY. Every value below is a field of `GrowthSummary`,
// already decided in `lib/progress/growth.ts` — the same discipline
// `RetentionPanel.tsx` follows. No threshold, no arithmetic, no filter lives
// here.
//
// A SERVER-SAFE component: it reads nothing and holds no state. The island
// above it owns the log read.
//
// ---------------------------------------------------------------------------
// WHY EVERY BAR CARRIES REAL TEXT, NOT JUST A HEIGHT
// ---------------------------------------------------------------------------
// A bar chart with no accompanying text is exactly the "picture with no text
// alternative" shape §15 exists to forbid — even though this is a trend, not
// a coloured category, the same rule applies: nothing on this screen is
// decoration alone. Each `.growth-bar` is `aria-hidden` (it repeats what its
// row's label already says), and the label beside it is real, visible text —
// `"3 encoded by day 2"` — so a screen reader and a sighted learner get the
// same information.

import type { GrowthSummary } from "@/lib/progress/growth";

interface GrowthPanelProps {
  summary: GrowthSummary;
}

export function GrowthPanel({ summary }: GrowthPanelProps) {
  return (
    <div className="stack stack--tight">
      <div className="card-header">
        <span>Growth</span>
        <span>{summary.encodedLabel}</span>
      </div>

      {summary.unmeasured ? (
        <p className="caption">
          No ayat encoded yet — your first Learn will start this curve.
        </p>
      ) : (
        <ul className="growth-bars" aria-label="Ayat encoded, by learning day">
          {summary.points.map((point) => (
            <li key={point.ordinal} className="growth-bar-row">
              <span
                className="growth-bar"
                aria-hidden="true"
                style={{ height: `${point.heightPct}%` }}
              />
              <span className="growth-bar-row__label sr-only">{point.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
