// The post-tap display state — the seam that keeps grading OUT of the views.
//
// A quiz card has two display modes: taking the answer, and showing what
// happened. The second mode needs to know what happened, and there are exactly
// two ways a component can learn that:
//
//   1. work it out itself — compare the tap to `correctIndex`; or
//   2. be TOLD, by whoever already committed the tap to the log.
//
// This file makes (2) the only expressible option. `Reveal` carries the chosen
// index and nothing else the view could grade with; the mapping from
// (index, correctIndex, reveal) to a locked CSS state class is a pure display
// function, written ONCE here, so no component re-derives it.
//
// WHY THIS IS NOT "GRADING IN THE VIEW" (check-boundaries.mjs clause 5).
// The distinction the gate protects is between deciding a LEARNING outcome and
// painting a decision already made. `optionStateClass` decides which of two
// locked classes (`is-ok`, `is-err`) to put on a <button> once the caller has
// declared the card revealed. It touches no strength, no band, no rung, no
// schedule; it cannot influence what gets written to the event log, because by
// the time it runs the write has already happened (invariant #2:
// commit-before-paint — the tap is appended and `tx.done` awaited BEFORE the
// UI animates). DEFECTS.md#B2 was `const rung: Rung = item.full ? "S3" : "S2"`
// in Drill.tsx: React choosing the GRADE. Nothing here chooses a grade.
//
// The `correctIndex` a card receives comes from the engine's own RenderItem.
// The view reads it to mark the right answer green after the fact — the same
// thing a printed answer key does, and the reason `correctIndex` is in the
// render contract at all.

/**
 * What the caller reports back once a tap has been committed. Deliberately
 * minimal: an index, plus the caller's own optional verdict.
 *
 * `chosenIndex` is a LOGICAL index into the item's own array — never a visual
 * position (#81). Every component in this directory reports logical indices
 * and every consumer receives them; there is no coordinate system in play but
 * the engine's.
 */
export interface Reveal {
  /** Which option/tile index the learner tapped. Logical, never visual. */
  chosenIndex: number;
}

/** The locked state classes. `is-ok` / `is-err` exist in `iman-ui.css` for
 *  both `.option` and `.tile`; there is no third state and no new class. */
export type StateClass = "is-ok" | "is-err" | null;

/**
 * Which locked state class an option at `index` should carry.
 *
 * Not revealed yet → nothing. Revealed → the correct option is always marked
 * `is-ok` (the answer key is shown whether or not it was the one tapped), and
 * a tapped WRONG option is additionally marked `is-err`. This is the standard
 * two-signal reveal: the learner sees both what they chose and what was right,
 * which a single signal cannot express.
 *
 * Colour is never the only signal — `.option.is-err` also carries the locked
 * `shake` animation, and callers pair the reveal with text (WIREFRAME §15,
 * "never colour alone").
 */
export function optionStateClass(
  index: number,
  correctIndex: number,
  reveal: Reveal | undefined,
): StateClass {
  if (!reveal) return null;
  if (index === correctIndex) return "is-ok";
  if (index === reveal.chosenIndex) return "is-err";
  return null;
}
