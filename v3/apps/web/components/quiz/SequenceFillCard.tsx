"use client";

// RENDER SHAPE 2 of 4 — `sequenceFill` (render.ts#SequenceFillItem).
//
// "Blank-by-blank sequential fill (RC's own shape, and produce-from-cold).
// `cursor` is which blank is currently active." This is the app's PRIMARY
// GRADED DRILL — tap-to-reconstruct. The whole ayah is always on screen
// (v2-D23): non-blank positions render in place, only the blank tail is
// hidden, and blanks fill strictly in reading order.
//
// NOTE FOR WHOEVER WIRES THE SESSION (v3-D37 gap 2): this shape has NO
// producer inside `buildQuestion`. It is RC's shape, and RC is permanently
// CODE (`reconstruct.ts`'s state machine), so a `SequenceFillItem` is
// assembled from `ReconstructState` rather than compiled from a Spec. That is
// the intended architecture, not an omission — but it means this component's
// props come from a different path than the other three, and the tests below
// construct its items directly from corpus Faces for exactly that reason.
//
// ---------------------------------------------------------------------------
// THE TWO THINGS THAT GO WRONG HERE, AND WHY THEY DO NOT
// ---------------------------------------------------------------------------
//
// #80 — BIDI. The ayah line is a mixed-direction row: Arabic words, and gap
// slots which are LTR boxes. Without isolation, a gap slot between two Arabic
// runs can be pulled into a neighbouring run's ordering and paint in the wrong
// place, silently showing the learner a DIFFERENT position than the one being
// graded. Each word and each slot is its own isolated inline element, and the
// `.gap-slot` keeps the locked `min-width: 3ch` so it holds its box in an RTL
// flex context rather than collapsing to zero.
//
// #81 — CURSOR ORDER. `cursor` indexes `blankPositions`, which is in READING
// order — ascending word position, i.e. right-to-left on screen for Arabic.
// The cursor therefore advances 0, 1, 2 … through the ARRAY while moving
// visually right-to-left, and this component never converts between the two.
// There is no visual-index arithmetic anywhere in this file. That is the fix:
// not "handle RTL correctly" but "never compute a visual index at all."
//
// ---------------------------------------------------------------------------
// GRADING. As with every card here: `onAnswer(index)` reports which OPTION
// index was tapped; correctness is the caller's, decided against the engine's
// `correctIndex`. No band, no strength, no blank-count decision — the blank
// COUNT arrives already computed inside `blankPositions` (it is
// `reconstruct.ts`'s call, and naming its function here would itself trip
// check-boundaries clause 5, correctly).

import type { SequenceFillItem } from "@engine/render.ts";
import { FaceText, isArabic } from "./FaceText";
import type { Reveal } from "./reveal";
import { optionStateClass } from "./reveal";

export interface SequenceFillCardProps {
  item: SequenceFillItem;
  /** Reports the LOGICAL option index tapped from the bank. */
  onAnswer: (index: number) => void;
  /** Faces already filled in, keyed by their POSITION in `ayahWords`. Supplied
   *  by the caller from the committed log — the card holds no fill history of
   *  its own, so a reload rebuilds the same screen from the same log. */
  filled?: ReadonlyMap<number, string>;
  reveal?: Reveal;
  label?: string;
}

export function SequenceFillCard({
  item,
  onAnswer,
  filled,
  reveal,
  label,
}: SequenceFillCardProps) {
  const locked = reveal !== undefined;
  // Which word index is the ACTIVE blank. `cursor` indexes blankPositions;
  // blankPositions holds indices into ayahWords. One lookup, no arithmetic.
  const activeWordIndex = item.blankPositions[item.cursor];
  const blanks = new Set(item.blankPositions);

  return (
    <section className="card" aria-labelledby="fill-h">
      <div className="card-header">
        <span id="fill-h">{label ?? "Reconstruct"}</span>
        {/* Progress through the blanks, in logical terms — "blank 2 of 5",
            never "word 2 from the left", which would be a visual claim. */}
        <span>
          blank {item.cursor + 1} / {item.blankPositions.length}
        </span>
      </div>

      {/* THE AYAH. `.ayah` is the locked hero class: direction rtl, the Arabic
          font, and the largest type on the screen (locked §8 rule 1). */}
      <p className="ayah" dir="rtl" lang="ar">
        {item.ayahWords.map((word, wordIndex) => {
          const isBlank = blanks.has(wordIndex);
          const fill = filled?.get(wordIndex);

          if (!isBlank) {
            // A visible scaffold word. Isolated so it cannot reorder against
            // an adjacent slot (#80).
            return (
              <span key={wordIndex}>
                <FaceText face={word} as="bdi" />{" "}
              </span>
            );
          }

          const isCurrent = wordIndex === activeWordIndex;
          return (
            <span key={wordIndex}>
              <span
                className={[
                  "gap-slot",
                  isCurrent ? "is-current" : null,
                  fill !== undefined ? "is-filled" : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                // The slot is an isolated inline box either way: filled it
                // holds Arabic, empty it holds nothing but must still keep its
                // 3ch width in the RTL flow (#80).
                dir="rtl"
                lang="ar"
                // Announced positionally in LOGICAL terms so a screen-reader
                // user hears the same ordering the cursor uses.
                aria-label={
                  fill !== undefined
                    ? undefined
                    : isCurrent
                      ? "current blank"
                      : "blank"
                }
                aria-current={isCurrent ? "true" : undefined}
                data-blank-index={item.blankPositions.indexOf(wordIndex)}
              >
                {fill !== undefined ? <bdi>{fill}</bdi> : null}
              </span>{" "}
            </span>
          );
        })}
      </p>

      {/* THE BANK. `.bank` is the locked flex row (direction: rtl). Its
          children are laid out right-to-left VISUALLY; `index` below stays the
          array index regardless — the #81 guarantee. Edge case #88: the bank
          is a wrapping flex container, so eight long tiles wrap rather than
          overflow, and the tests build one at width 8 to prove it. */}
      <div className="bank" role="group" aria-label="Word choices">
        {item.options.map((face, index) => {
          const state = optionStateClass(index, item.correctIndex, reveal);
          return (
            // `.tile-hit` is the EXT layer's transparent 44px hit-area wrapper
            // (#82): the locked `.tile` is ~32px tall and byte-gated, so the
            // finger target is supplied around it without changing one painted
            // pixel of the tile itself.
            <span className="tile-hit" key={`${index}-${face.from.kind}`}>
              <button
                type="button"
                disabled={locked}
                className={["tile", state].filter(Boolean).join(" ")}
                // LOGICAL INDEX (#81). `.bank { direction: rtl }` means tile 0
                // paints at the RIGHT edge. This handler closes over the ARRAY
                // index, so the rightmost tile reports 0 — the position the
                // engine put it in. Nothing here reads getBoundingClientRect,
                // childNodes order, or a click coordinate, so there is no
                // mirrored index to get wrong.
                onClick={() => onAnswer(index)}
              >
                <FaceText face={face} as={isArabic(face) ? "bdi" : "span"} />
              </button>
            </span>
          );
        })}
      </div>
    </section>
  );
}
