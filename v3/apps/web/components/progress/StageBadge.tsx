// THE ONLY PLACE IN THE APP THAT RENDERS A STAGE.
//
// Edge case #87, verbatim: "Deuteranopia teal/coral → colour-only stage.
// StageBadge (dot+label+number) is the ONLY stage renderer."
//
// "The only" is the whole design. A second place that draws a `.stage-dot` is
// a second place that can drop the word next to it, and the drop will happen
// in a "compact" variant six months from now, in a component nobody thinks of
// as a stage renderer. So the rule is enforced by a test that scans `app/**`
// and `components/**` for the class and expects to find it here and nowhere
// else — the same shape check-boundaries.mjs uses for its own clauses.
//
// WHAT THE BADGE GUARANTEES
//
//   dot (aria-hidden) + WORD + NUMBER, always all three.
//
// Teal and coral are near-indistinguishable to the ~8% of men with
// deuteranopia, so the dot is decoration ON TOP of the information and never
// the information itself. It is aria-hidden because a screen reader must not
// be told about a colour it cannot convey.
//
// WHAT THE BADGE DOES NOT DO: decide anything. `stage` and `stageLabel` both
// arrive as props, already derived in `lib/progress/rows.ts`. A lookup table
// mapping stage → word inside this file would be a decision in a view, and
// decisions arrive as data (check-boundaries.mjs clause 5 / DEFECTS.md#B2).
//
// A SERVER COMPONENT. It reads nothing and holds no state.

import type { Stage } from "@engine/atom.ts";

interface StageBadgeProps {
  /** The band, already decayed to `now` by the engine. Used ONLY to pick a
   *  class name — never compared, never thresholded. */
  stage: Stage;
  /** The word. Carried in the data so there is no code path that renders a
   *  dot without one. */
  stageLabel: string;
  /** The number, 0-100. */
  strengthPct: number;
  /** How the number is printed — "48%" or "—" for an unmeasured atom. The
   *  caller decides, because "0%" and "unmeasured" are different facts and
   *  only the row builder knows which one this is. */
  valueLabel?: string;
}

/**
 * The locked file (iman-ui.css:123-127) defines dots for learn / reinforce /
 * carry only, but `atom.ts` has FOUR stages. `.stage-dot--lapsed` is supplied
 * by the EXT layer — an addition, not a restyle, and the locked file stays
 * byte-identical.
 *
 * A note for whoever reads this next: the locked file sets
 * `--stage-carry: var(--coral-500)`, assigning coral — which the same file's
 * §8 rule 2 reserves for "something slipped" — to CARRY, the strongest band.
 * That is why the lapsed dot is differentiated by WEIGHT AND BORDER rather
 * than by hue: two coral dots that differ only in shade would be one dot to a
 * deuteranope, which is precisely the failure this component exists to
 * prevent. The token oddity is flagged for a decision; the locked file is not
 * touched.
 */
const DOT_CLASS: Record<Stage, string> = {
  learn: "stage-dot stage-dot--learn",
  reinforce: "stage-dot stage-dot--reinforce",
  carry: "stage-dot stage-dot--carry",
  lapsed: "stage-dot stage-dot--lapsed",
};

export function StageBadge({ stage, stageLabel, strengthPct, valueLabel }: StageBadgeProps) {
  return (
    <span className="stage-label">
      <span className={DOT_CLASS[stage]} aria-hidden="true" />
      <span className="stage-label__name">{stageLabel}</span>
      <span className="stage-label__value">{valueLabel ?? `${strengthPct}%`}</span>
    </span>
  );
}
