// S4 bridge (FR2): after encoding ayah n, introduce ayah n+1's opening vocab as
// meaning items — "what comes next?" — which births the n→n+1 connection. Reuses
// the S1 in-context hero (the next ayah's opening, target word lit) and the
// .option meaning-MCQ, all from iman-ui.css (no restyle).

import type { DrillItem } from "engine";
import { ContextAyah } from "../components/AyahHero.tsx";
import type { Feedback } from "../session/useLadder.ts";
import { seededShuffle } from "../session/shuffle.ts";

type S4 = Extract<DrillItem, { rung: "S4" }>;

export function S4Bridge({
  item,
  feedback,
  onSubmit,
  onProceed,
  committing,
}: {
  item: S4;
  feedback: Feedback;
  onSubmit: (choice: string) => void;
  onProceed: () => void;
  committing: boolean;
}) {
  const opts = seededShuffle(item.options, `s4:${item.fromAyah}:${item.word.position}`);
  const answered = feedback !== null;

  return (
    <div className="card">
      <div className="card-header">
        <span>
          Bridge 12:{item.fromAyah} → 12:{item.toAyah}
        </span>
        <span>
          next word {item.index} / {item.total}
        </span>
      </div>

      <ContextAyah words={item.nextOpening} targetPosition={item.word.position} />
      <p className="voice">What comes next — what does the lit word mean?</p>

      {opts.map((o) => {
        let cls = "option";
        if (answered) {
          if (o === item.correct) cls += " is-ok";
          else if (o === feedback?.choice) cls += " is-err";
        }
        return (
          <button
            key={o}
            className={cls}
            disabled={answered || committing}
            onClick={() => onSubmit(o)}
          >
            {o}
          </button>
        );
      })}

      {answered && (
        <button className="btn btn--primary" onClick={onProceed}>
          Next
        </button>
      )}
    </div>
  );
}
