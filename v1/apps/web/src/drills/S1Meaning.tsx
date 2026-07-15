// S1 meaning pass: the Arabic word is the hero; EN gloss options below. A slip
// paints the wrong option coral (.option.is-err). One .voice line per screen.

import type { DrillItem } from "engine";
import { ContextAyah } from "../components/AyahHero.tsx";
import type { Feedback } from "../session/useLadder.ts";
import { seededShuffle } from "../session/shuffle.ts";

type S1 = Extract<DrillItem, { rung: "S1" }>;

export function S1Meaning({
  item,
  feedback,
  onSubmit,
  onProceed,
  committing,
}: {
  item: S1;
  feedback: Feedback;
  onSubmit: (choice: string) => void;
  onProceed: () => void;
  committing: boolean;
}) {
  const opts = seededShuffle(item.options, `s1:${item.word.ayah}:${item.word.position}`);
  const answered = feedback !== null;

  return (
    <div className="card">
      <div className="card-header">
        <span>Learn {item.word.ayah === 4 ? "12:4" : `12:${item.word.ayah}`} · meaning</span>
        <span>
          word {item.index} / {item.total}
        </span>
      </div>

      <ContextAyah words={item.ayahWords} targetPosition={item.word.position} />
      <p className="voice">What does the lit word mean?</p>

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
          {feedback?.correct ? "Next" : "Try the next word"}
        </button>
      )}
    </div>
  );
}
