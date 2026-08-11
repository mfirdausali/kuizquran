// THE RETENTION PANEL — WIREFRAME §10, rendered.
//
// PRESENTATIONAL ONLY. Every value below is a field of `RetentionSummary`,
// already decided in `lib/progress/retention.ts`. There is not one comparison,
// not one threshold, not one lookup table in this file — the same discipline
// `ProgressTable.tsx` follows, and what keeps check-boundaries.mjs clause 5
// satisfied in substance rather than merely in letter.
//
// A SERVER-SAFE component: it reads nothing and holds no state. The island
// above it owns the log read.
//
// ---------------------------------------------------------------------------
// WHY THE DISTRIBUTION IS NOT THE LOCKED `.bands` COMPONENT
// ---------------------------------------------------------------------------
// `iman-ui.css:295-301` defines `.bands` with HARDCODED widths — `b-learn` 40%,
// `b-reinforce` 40%, `b-carry` 20% — because it is a SCALE LEGEND for the
// 0-40/40-80/80+ band boundaries, not a data display. It also has no
// `b-lapsed`. Rendering a learner's actual distribution through it would draw a
// bar whose proportions are identical no matter what the learner knows: a
// decorative widget on the one screen whose governing rule is that nothing is
// decorative.
//
// So the distribution uses `.dist-*` from the EXT layer, which is sized from
// the data. The locked file is byte-gated (`check-locked-css.mjs`) and stays
// untouched.
//
// ---------------------------------------------------------------------------
// NEVER COLOUR ALONE (§15 / edge case #87)
// ---------------------------------------------------------------------------
// Every band renders through `StageBadge` — the ONLY `.stage-dot` renderer in
// the app, enforced by a source scan in `test/progress-list.test.tsx`. The bar
// beside it is `aria-hidden` decoration ON TOP of a row that already reads
// "Carrying — 12 of 41 (29%)" in words and numbers. Remove every colour from
// this panel and it loses nothing.

import type { RetentionSummary } from "@/lib/progress/retention";
import { StageBadge } from "./StageBadge";

interface RetentionPanelProps {
  summary: RetentionSummary;
}

export function RetentionPanel({ summary }: RetentionPanelProps) {
  return (
    <div className="stack stack--tight">
      {/* THE HEADLINE — half-life, per §10. Not a streak, not a percentage
          complete. `.retention-headline` is a number a learner can act on. */}
      <p className="retention-headline">
        <span className="retention-headline__value">{summary.headlineHalfLifeLabel}</span>
      </p>
      <p className="caption">{summary.headlineSentence}</p>

      {/* SLIPPAGE, stated plainly and immediately after the headline — never
          hidden below the fold, which is how a dashboard ends up green while
          the scheduler disagrees. */}
      <p className="retention-slipping">
        {summary.slippingLabel}.
        {summary.slippingReassurance !== null && (
          <span className="retention-slipping__reframe"> {summary.slippingReassurance}</span>
        )}
      </p>

      {/* THE BAND DISTRIBUTION. A list, not a chart: every row carries a word
          and two numbers, and the bar is decoration on top. */}
      <ul className="dist" aria-label="Where your memory graph sits">
        {summary.bands.map((band) => (
          <li key={band.stage} className="dist-row">
            <StageBadge
              stage={band.stage}
              stageLabel={band.label}
              strengthPct={band.pct}
              valueLabel={`${band.pct}%`}
            />
            <span className="dist-count">{band.countLabel}</span>
            {/* Decoration. The row above already said it in words. */}
            <span className="dist-bar" aria-hidden="true">
              <span
                className={`dist-bar__fill dist-bar__fill--${band.stage}`}
                style={{ width: `${band.pct}%` }}
              />
            </span>
          </li>
        ))}
      </ul>

      {/* DECAY MADE VISIBLE — §10's "72% -> 64% since Thursday". Rendered only
          when something actually declined; an empty heading over an empty list
          would imply a measurement nobody made. */}
      {summary.decayRows.length > 0 && (
        <>
          <h3 className="retention-subhead">What moved</h3>
          <ul className="decay-list">
            {summary.decayRows.map((row) => (
              <li key={row.reference} className="decay-row">
                {/* Latin digits in their own LTR island, so a reference never
                    reorders beside neighbouring text (§15's classic bug). */}
                <span className="ltr-island decay-row__ref">{row.reference}</span>
                <span className="decay-row__kind">{row.kindLabel}</span>
                <span className="decay-row__move">{row.sentence}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
