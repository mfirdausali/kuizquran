// THE TEST HISTORY PANEL — v2-D17 Progress Report's per-Test history list,
// rendered.
//
// PRESENTATIONAL ONLY. Every value below is a field of `TestHistorySummary`,
// already decided in `lib/progress/testHistory.ts` — the same discipline
// `RetentionPanel.tsx`/`GrowthPanel.tsx` follow. No threshold, arithmetic, or
// filter lives here.
//
// A SERVER-SAFE component: it reads nothing and holds no state. The island
// above it owns the log read.

import type { TestHistorySummary } from "@/lib/progress/testHistory";

interface TestHistoryPanelProps {
  summary: TestHistorySummary;
}

export function TestHistoryPanel({ summary }: TestHistoryPanelProps) {
  return (
    <div className="stack stack--tight">
      <div className="card-header">
        <span>Test history</span>
        <span>{summary.countLabel}</span>
      </div>

      {summary.unmeasured ? (
        <p className="caption">No Tests taken yet.</p>
      ) : (
        <ul className="test-history-list">
          {summary.rows.map((row) => (
            <li key={row.ts} className="test-history-row">
              <span>{row.rangeLabel} · {row.scoreLabel}</span>
              <span className="test-history-row__meta">
                {row.dateLabel}
                {row.sentToReviews ? " · sent to reviews" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
