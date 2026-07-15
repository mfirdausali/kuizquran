// S3 whole-bank: all the ayah's words as a shuffled tile bank, no distractors.
// Tap them in reading order, first word to last — the full-ayah production that
// is the only accomplishment (invariant #1). Correct tile auto-advances (the
// hook proceeds on correct S3 taps); a wrong tile flashes coral (.is-err) and
// the sequence does not advance.

import { useMemo } from "react";
import type { DrillItem } from "engine";
import type { Feedback } from "../session/useLadder.ts";
import { seededShuffle } from "../session/shuffle.ts";

type S3 = Extract<DrillItem, { rung: "S3" }>;

export function S3WholeBank({
  item,
  feedback,
  onSubmit,
  committing,
}: {
  item: S3;
  feedback: Feedback;
  onSubmit: (choice: string) => void;
  committing: boolean;
}) {
  const bank = useMemo(
    () => seededShuffle(item.ayahWords, `s3:${item.ayahWords[0]?.ayah ?? 0}`),
    [item.ayahWords],
  );

  const usedPositions = new Set(
    item.ayahWords.filter((w) => w.position < item.expectedPosition).map((w) => w.position),
  );
  // A slip on the current expected word: flash coral on the tile that was tapped.
  const slipChoice = feedback && !feedback.correct ? feedback.choice : null;

  return (
    <div className="card">
      <div className="card-header">
        <span>Learn 12:4 · whole-bank</span>
        <span>
          word {item.index} / {item.total}
        </span>
      </div>

      <p className="voice">Rebuild the ayah — tap the words in order.</p>

      <div className="bank">
        {bank.map((w) => {
          const used = usedPositions.has(w.position);
          const isSlip = slipChoice === w.text_uthmani && !used;
          let cls = "tile";
          if (used) cls += " is-used";
          else if (isSlip) cls += " is-err";
          return (
            <button
              key={w.position}
              className={cls}
              disabled={used || committing}
              onClick={() => onSubmit(w.text_uthmani)}
            >
              {w.text_uthmani}
            </button>
          );
        })}
      </div>

      {slipChoice && (
        <p className="caption">That's not the next word — follow the reading order.</p>
      )}
    </div>
  );
}
