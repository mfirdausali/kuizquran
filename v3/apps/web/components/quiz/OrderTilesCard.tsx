"use client";

// RENDER SHAPE 3 of 4 — `orderTiles` (render.ts#OrderTilesItem).
//
// "Tap-to-order (reorder). `attempt` is the learner's accumulated taps so far."
// A short run of consecutive ayat, tapped back into reading order.
//
// ---------------------------------------------------------------------------
// THIS IS WHERE #81 ACTUALLY BITES
// ---------------------------------------------------------------------------
// The bank is `.bank { direction: rtl }`. Tile 0 of the array paints at the
// RIGHT edge of the row; the LAST tile paints at the left. A learner tapping
// "the first tile" taps the rightmost one, and the naive implementations of
// this component both get it wrong in the same way:
//
//   - reading a visual position back out of the DOM (`indexOf` over
//     `parentNode.children`, a bounding-rect sort, a click's clientX), or
//   - "correcting" for RTL by flipping the index (`length - 1 - i`).
//
// The second is the more dangerous, because it looks like RTL awareness and
// produces a plausible-looking wrong answer: the learner taps the ayah they
// meant and the engine grades a DIFFERENT one — silently, since both are valid
// ayat and neither the log nor the UI shows anything obviously broken. That is
// edge case #81's own words: "grades the mirror position."
//
// THE FIX IS NOT TO HANDLE THE MIRROR. It is to never construct one. This
// component computes NO visual index. Each tile's handler closes over its
// ARRAY index and reports exactly that. The mirroring is done entirely by CSS,
// which is presentation, and presentation never travels back into the data.
// `mapTapToLogicalIndex` below exists to state the rule as a named, testable
// function — an identity, deliberately — so the property has a place to be
// asserted and a future "fix" that introduces a flip fails a test rather than
// a learner.
//
// GRADING: `onTap(index)` reports the tapped tile. `correctOrder` is the answer
// key from the engine and is read only to paint the reveal. This component
// never compares `attempt` to `correctOrder` to decide an outcome — the caller
// does, after committing the tap.

import type { OrderTilesItem } from "@engine/render.ts";
import { FaceText } from "./FaceText";

export interface OrderTilesCardProps {
  item: OrderTilesItem;
  /** Reports the LOGICAL tile index tapped — its index in `item.tiles`. */
  onTap: (index: number) => void;
  /** Marks the run finished so the tiles lock and the answer key shows. */
  reveal?: boolean;
  label?: string;
}

/**
 * The #81 rule, named so it can be tested.
 *
 * Given the array index of the tile whose handler fired, the LOGICAL index is
 * that same number — in RTL exactly as in LTR. Direction is a paint property
 * of the container; it does not renumber the array. This function is an
 * identity ON PURPOSE: the correct implementation of "map a tap to a logical
 * index" in a CSS-mirrored layout is to do nothing, and the way to keep it
 * doing nothing is to give it a test.
 *
 * `bankLength` is accepted and ignored precisely because it is the input a
 * mirroring implementation would need (`bankLength - 1 - tileIndex`). Its
 * presence in the signature and absence from the body is the assertion.
 */
export function mapTapToLogicalIndex(tileIndex: number, _bankLength: number): number {
  return tileIndex;
}

export function OrderTilesCard({ item, onTap, reveal, label }: OrderTilesCardProps) {
  // Which tiles have already been tapped, and in what order. `attempt` holds
  // LOGICAL tile indices — it is the engine's own field, carried in the render
  // contract because a stateless shape could not express it.
  const tapOrder = new Map<number, number>();
  item.attempt.forEach((tileIndex, ordinal) => {
    if (!tapOrder.has(tileIndex)) tapOrder.set(tileIndex, ordinal);
  });

  return (
    <section className="card" aria-labelledby="order-h">
      <div className="card-header">
        <span id="order-h">{label ?? "Put these in order"}</span>
        <span>
          {item.attempt.length} / {item.correctOrder.length}
        </span>
      </div>

      <p className="caption">
        Tap the ayat in reading order.
      </p>

      {/* `.bank` is the locked RTL flex row and it WRAPS — edge case #88's
          "8-long-tile widened banks" is a wrap, not an overflow. The tests
          build a bank at width 8 and assert every tile is present and
          individually tappable. */}
      <div className="bank" role="group" aria-label="Ayat to order">
        {item.tiles.map((face, index) => {
          const ordinal = tapOrder.get(index);
          const used = ordinal !== undefined;
          // The answer key, painted only once the caller reveals. `is-ok` on
          // the tiles that were tapped into their correct slot.
          //
          // buildQuestion#buildReorder builds `tiles` by mapping over
          // `correctOrder`, so tiles[i] IS the answer for slot i — "this tile
          // went to its correct slot" is exactly `ordinal === index`.
          //
          // This was previously written `correctOrder[ordinal] ===
          // correctOrder[index]`, which indexes the SAME array on both sides.
          // That form is NOT a live bug: `correctOrder` is always a strictly
          // increasing run of ayah numbers, so its elements are distinct and
          // `co[a] === co[b]` is equivalent to `a === b` for every input the
          // engine can produce (verified exhaustively over starts 1..200 x
          // counts 1..8). It is rewritten anyway because it only *reads* as if
          // it consults the answer key while in fact it cannot: the equivalence
          // is an accident of distinctness, not an expressed intent, and it
          // would become a real defect the day `correctOrder` is ever allowed
          // to repeat a value or to hold anything but a strictly-ordered run.
          //
          // For the record it is also NOT `correctOrder[ordinal] === index`:
          // `correctOrder` holds AYAH NUMBERS (e.g. [4,5,6]), not tile indices,
          // so that compares an ayah number against a position.
          const correctAtThisOrdinal = reveal && used ? ordinal === index : false;

          return (
            <span className="tile-hit" key={`${index}-${face.from.kind}`}>
              <button
                type="button"
                disabled={used || reveal === true}
                className={[
                  "tile",
                  used ? "is-used" : null,
                  reveal && used ? (correctAtThisOrdinal ? "is-ok" : "is-err") : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                // The whole of #81, in one line. `index` is the ARRAY index;
                // `mapTapToLogicalIndex` is the identity that documents why no
                // mirroring happens. The rightmost tile on screen is tiles[0]
                // and reports 0.
                onClick={() => onTap(mapTapToLogicalIndex(index, item.tiles.length))}
                // Position is announced LOGICALLY (its place in the array),
                // never "the 3rd from the left", so assistive tech and the
                // grader agree.
                data-tile-index={index}
                aria-label={used ? `Tapped ${ordinal + 1}` : undefined}
              >
                <FaceText face={face} as="bdi" />
              </button>
            </span>
          );
        })}
      </div>
    </section>
  );
}
