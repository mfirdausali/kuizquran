// THE GROWTH SUMMARY — v2-D17/D20's Progress Report growth curve, rendered.
//
// `packages/engine/src/heatmap.ts#growthCurve` has been real and unit-tested
// since the heatmap landed (`habit.test.ts`) but had ZERO production callers
// — v3-D102's sweep found it, scoped it as needing "an actual chart/sparkline
// on /progress — a genuinely new rendering surface", and deliberately left it
// for a future run. This module is that surface's data half, following
// `retention.ts`'s own rule: THE COMPONENT NEVER COMPUTES, IT ONLY PRINTS.
//
// PURE. `(surah, events)` in, data out. No `Date.now`, no IO, no clock — the
// curve is inherently a function of the log alone (unlike retention's
// headline, growth needs no "now" to decay against).
//
// ---------------------------------------------------------------------------
// WHY EACH POINT CARRIES AN "ORDINAL", NOT JUST THE RAW learning-day INDEX
// ---------------------------------------------------------------------------
// `GrowthPoint.day` (from the engine) is `learningDayIndex(ts)` — days since
// the Unix epoch under the tz-explicit daybound rule. That is correct for the
// engine (a stable, comparable integer) and meaningless to a learner ("day
// 20,672"). The ordinal below is the point's own 1-based position in the
// curve — "day 1" is the first learning-day that ever saw a new encode, "day
// 2" the second, and so on — which is what a caption or an accessible label
// should read.

import type { DrillEvent } from "@engine/types.ts";
import type { DayConfig } from "@engine/daybound.ts";
import { growthCurve } from "@engine/heatmap.ts";

/** One bar of the curve. */
export interface GrowthPoint {
  /** 1-based position of this point among the curve's own points — see the
   *  module header for why this, not the raw learning-day index, is what a
   *  caption reads. */
  ordinal: number;
  /** The engine's raw learning-day index, kept for callers that need it
   *  (e.g. a future "jump to that day" link) but never printed directly. */
  day: number;
  cumulativeEncoded: number;
  /** Whole percent of the curve's OWN maximum, floored at 6 so a nonzero bar
   *  is never rounded to invisible — the same discipline `retention.ts`'s
   *  `.dist-bar__fill` uses for its own data-driven widths. */
  heightPct: number;
  /** "3 encoded by day 2" — a real, checkable sentence for every bar, so the
   *  chart is never colour/shape alone (§15 / edge case #87's rule, applied
   *  to a trend rather than a category). */
  label: string;
}

export interface GrowthSummary {
  surah: number;
  /** Total distinct ayat ever encoded — the curve's final cumulative value,
   *  or 0 when nothing has been encoded. */
  encodedCount: number;
  /** "7 encoded" / "Nothing encoded yet". Mirrors v2's own Progress Report
   *  header ("Growth" / "{n} encoded"). */
  encodedLabel: string;
  points: GrowthPoint[];
  /** True when no ayah has ever been encoded — the view's designed
   *  zero-state, never a bare empty chart. */
  unmeasured: boolean;
}

export interface GrowthInput {
  surah: number;
  events: readonly DrillEvent[];
  cfg?: DayConfig;
}

/** The minimum visible height for any bar with real data, in whole percent —
 *  a bar rounded to 0% is indistinguishable from a day with nothing to show. */
const MIN_BAR_HEIGHT_PCT = 6;

export function buildGrowthSummary(input: GrowthInput): GrowthSummary {
  const { surah, events, cfg } = input;
  const curve = growthCurve(events as DrillEvent[], cfg);

  if (curve.length === 0) {
    return {
      surah,
      encodedCount: 0,
      encodedLabel: "Nothing encoded yet",
      points: [],
      unmeasured: true,
    };
  }

  const max = curve[curve.length - 1]!.cumulativeEncoded;
  const points: GrowthPoint[] = curve.map((p, i) => {
    const ordinal = i + 1;
    const pct = max > 0 ? Math.round((p.cumulativeEncoded / max) * 100) : 0;
    return {
      ordinal,
      day: p.day,
      cumulativeEncoded: p.cumulativeEncoded,
      heightPct: Math.max(MIN_BAR_HEIGHT_PCT, pct),
      label: `${p.cumulativeEncoded} encoded by day ${ordinal}`,
    };
  });

  return {
    surah,
    encodedCount: max,
    encodedLabel: `${max} encoded`,
    points,
    unmeasured: false,
  };
}
