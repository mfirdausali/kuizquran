// S2 word-by-word fill: the gapped ayah is the hero; Arabic options for the
// current blank below (.option--arabic). A wrong option is a slip (coral); the
// blank stays put until correct.

import type { DrillItem } from "engine";
import { GappedAyah } from "../components/AyahHero.tsx";
import type { Feedback } from "../session/useLadder.ts";
import { seededShuffle } from "../session/shuffle.ts";

type S2 = Extract<DrillItem, { rung: "S2" }>;

export function S2Fill({
  item,
  feedback,
  onSubmit,
  onProceed,
  committing,
}: {
  item: S2;
  feedback: Feedback;
  onSubmit: (choice: string) => void;
  onProceed: () => void;
  committing: boolean;
}) {
  const opts = seededShuffle(item.options, `s2:${item.blankPosition}`);
  // Feedback only matters if it concerns the current blank.
  const answered = feedback !== null && feedback.position === item.blankPosition;
  const wasCorrect = answered && feedback?.correct === true;

  return (
    <div className="card">
      <div className="card-header">
        <span>Learn 12:4 · fill</span>
        <span>
          word {item.index} / {item.total}
        </span>
      </div>

      <GappedAyah
        words={item.ayahWords}
        filledThrough={item.blankPosition - 1}
        blankPosition={item.blankPosition}
      />
      <p className="voice">Choose the word that fills the blank.</p>

      {opts.map((o) => {
        let cls = "option option--arabic";
        if (answered) {
          if (o === item.correct && wasCorrect) cls += " is-ok";
          else if (o === feedback?.choice && !wasCorrect) cls += " is-err";
        }
        return (
          <button
            key={o}
            className={cls}
            disabled={committing || wasCorrect}
            onClick={() => (answered && !wasCorrect ? onProceed() : onSubmit(o))}
          >
            {o}
          </button>
        );
      })}

      {wasCorrect && (
        <button className="btn btn--primary" onClick={onProceed}>
          Next
        </button>
      )}
      {answered && !wasCorrect && <p className="caption">Not quite — tap any option to retry.</p>}
    </div>
  );
}
