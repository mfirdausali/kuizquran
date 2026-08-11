"use client";

// RENDER SHAPE 4 of 4 — `locateChoice` (render.ts#LocateChoiceItem).
//
// "'Which ayah is this?' — options are ayah NUMBERS, never Faces (the answer
// identifies a coordinate, not text)."
//
// THAT DISTINCTION IS THE WHOLE COMPONENT. Everywhere else in this directory an
// option is a `Face` and gets `dir="rtl" lang="ar"` when its script says so.
// Here the options are `number[]`, so they are LTR chrome — Western digits, in
// the UI's own direction — and giving them Arabic direction attributes would be
// wrong in the precise way #80 describes: a number is not Arabic text, and
// stamping it RTL invites the bidi algorithm to reorder it against the label
// around it.
//
// The PROMPT is still a Face (the whole ayah, `{kind: "verse"}`) and is still
// an RTL Arabic island. So this card is the one place both directions appear in
// the same card by design, which makes it the sharpest test of #80: the RTL
// prompt sits directly above LTR numeric options, and neither may leak into the
// other. Both are isolated.
//
// GRADING: `onAnswer(index)` reports the tapped OPTION INDEX — not the ayah
// number. The index is the coordinate the engine's `correctIndex` is expressed
// in, and passing the ayah number instead would force the caller to search the
// options array to grade, which is exactly the kind of re-derivation that
// eventually disagrees with the engine.

import type { LocateChoiceItem } from "@engine/render.ts";
import { FaceText } from "./FaceText";
import type { Reveal } from "./reveal";
import { optionStateClass } from "./reveal";

export interface LocateChoiceCardProps {
  item: LocateChoiceItem;
  /** Reports the LOGICAL option index tapped — never the ayah number. */
  onAnswer: (index: number) => void;
  reveal?: Reveal;
  label?: string;
  /** Surah number, for the "12:4" style option labels. Chrome only. */
  surah?: number;
}

export function LocateChoiceCard({
  item,
  onAnswer,
  reveal,
  label,
  surah,
}: LocateChoiceCardProps) {
  const locked = reveal !== undefined;

  return (
    <section className="card" aria-labelledby="locate-h">
      <div className="card-header">
        <span id="locate-h">{label ?? "Which ayah is this?"}</span>
      </div>

      {/* The prompt is the whole verse — the locked `.ayah` hero, RTL. */}
      <p className="ayah" dir="rtl" lang="ar">
        <FaceText face={item.prompt} as="bdi" />
      </p>

      <div className="stack stack--tight" role="radiogroup" aria-labelledby="locate-h">
        {item.options.map((ayahNumber, index) => {
          const state = optionStateClass(index, item.correctIndex, reveal);
          return (
            <button
              // The ayah NUMBER is the stable identity here (a pool can never
              // legitimately contain the same ayah twice — buildLocate filters
              // the correct answer out of its own distractors).
              key={ayahNumber}
              type="button"
              role="radio"
              aria-checked={reveal?.chosenIndex === index}
              disabled={locked}
              // NOTE: no `.option--arabic`. These are numbers. The locked
              // `.option` default is `text-align: left`, direction inherited
              // from the LTR chrome — which is correct for a coordinate.
              className={["option", state].filter(Boolean).join(" ")}
              // LOGICAL INDEX, as everywhere: the array position, not the ayah
              // number and not a visual slot.
              onClick={() => onAnswer(index)}
            >
              {/* `.ltr-island` is the EXT layer's inverse of `.rtl-island`: a
                  number or code fragment that must stay LTR. Belt-and-braces
                  against a future RTL UI locale, where the chrome itself flips
                  and an unisolated "12:4" would paint as "4:12". */}
              <span className="ltr-island">
                {surah !== undefined ? `${surah}:${ayahNumber}` : `Ayah ${ayahNumber}`}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
