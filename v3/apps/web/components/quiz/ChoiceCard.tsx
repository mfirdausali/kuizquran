"use client";

// RENDER SHAPE 1 of 4 — `choice` (render.ts#ChoiceItem).
//
// "A small fixed option set, exactly one correct (s1/cloze/junction today)."
// Three engine lanes produce this shape and this component does not know which
// — that is the whole value of a closed render contract. A fourth lane
// producing `choice` needs no change here.
//
// GRADING IS NOT DECIDED HERE. The component reports WHICH INDEX was tapped
// via `onAnswer(index)`. It never compares that index to `correctIndex` to
// decide what happened. `correctIndex` is used for exactly one thing — marking
// the correct option AFTER the caller has moved the card into a revealed state
// — and the caller owns that state because the caller is what commits the tap
// to the log first (invariant #2, commit-before-paint). A component that
// graded its own tap would be free to paint before the write landed.
//
// The `reveal` prop is therefore DATA arriving from above, not a conclusion
// drawn here. No strength comparison, no band logic, no queue assembly — check
// -boundaries.mjs clause 5 fails the build on any of them, which is how
// DEFECTS.md#B2 (React deciding the grading rung) stays impossible by
// construction rather than merely fixed once.

import type { ChoiceItem } from "@engine/render.ts";
import { FaceText, isArabic } from "./FaceText";
import type { Reveal } from "./reveal";
import { optionStateClass } from "./reveal";

export interface ChoiceCardProps {
  item: ChoiceItem;
  /** Reports the LOGICAL option index that was tapped. Grading happens above. */
  onAnswer: (index: number) => void;
  /** Post-tap display state, supplied by the caller once the tap is committed. */
  reveal?: Reveal;
  /** Card header text, e.g. "Learn 12:4 · meaning". Latin chrome. */
  label?: string;
}

export function ChoiceCard({ item, onAnswer, reveal, label }: ChoiceCardProps) {
  const locked = reveal !== undefined;

  return (
    <section className="card" aria-labelledby="choice-prompt">
      {label ? (
        <div className="card-header">
          <span>{label}</span>
          <span>
            {item.options.length} option{item.options.length === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}

      {/* The prompt. For s1 it is the Arabic WORD (answer = its gloss); for
          cloze and junction it is Arabic too. `.ayah--display` is the locked
          file's own borderless centred treatment — reused, not reinvented. */}
      <p
        id="choice-prompt"
        className={isArabic(item.prompt) ? "ayah ayah--display" : "voice"}
      >
        <FaceText face={item.prompt} />
      </p>

      {/* A radiogroup, not a list of buttons: exactly one may be chosen, which
          is what the shape's own docstring guarantees ("exactly one correct").
          Arrow-key semantics come free and screen readers announce the set
          size — both of which a pile of <button>s would have to fake. */}
      <div className="stack stack--tight" role="radiogroup" aria-labelledby="choice-prompt">
        {item.options.map((face, index) => {
          const arabic = isArabic(face);
          const state = optionStateClass(index, item.correctIndex, reveal);
          return (
            <button
              key={`${index}-${face.from.kind}`}
              type="button"
              role="radio"
              aria-checked={reveal?.chosenIndex === index}
              disabled={locked}
              // `.option` is the locked class; `--arabic` its locked Arabic
              // modifier (font, size, right-align, direction). The state class
              // is `is-ok`/`is-err`, also locked.
              className={["option", arabic ? "option--arabic" : null, state]
                .filter(Boolean)
                .join(" ")}
              // THE LOGICAL INDEX (#81). `index` is this option's position in
              // `item.options` — the array the engine built. It is NOT derived
              // from anything the browser laid out, so a right-to-left visual
              // order cannot change which number is reported. This holds here
              // trivially because options are a vertical stack; it is stated
              // anyway because the same guarantee is load-bearing and NOT
              // trivial in OrderTilesCard, and the two must agree.
              onClick={() => onAnswer(index)}
            >
              <FaceText face={face} as="bdi" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
