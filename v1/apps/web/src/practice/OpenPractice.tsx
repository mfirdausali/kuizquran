// Open practice (FR6 door 3), lean: pick any ayah, drill its meaning pass (S1
// form) as EVIDENCE-ONLY (structured:false → update() leaves lifecycle untouched,
// invariant #5). Reuses the S1 in-context hero + engine gloss options. A cold
// pass on an untaught ayah surfaces the adoption offer (coldSuccessAdoption).

import { useMemo, useState } from "react";
import {
  ayahWords,
  makeEvent,
  s1Options,
  initLadder,
  type Corpus,
} from "engine";
import { append } from "../db/eventLog.ts";
import { ContextAyah } from "../components/AyahHero.tsx";
import { seededShuffle } from "../session/shuffle.ts";

export function OpenPractice({
  corpus,
  onClose,
  initialAyah,
}: {
  corpus: Corpus;
  onClose: () => void;
  initialAyah?: number;
}) {
  const [ayah, setAyah] = useState<number | null>(initialAyah ?? null);

  if (ayah === null) {
    return (
      <div className="screen">
        <div className="card">
          <div className="card-header">
            <span>Open practice</span>
            <span>pick an ayah</span>
          </div>
          <p className="voice">Any ayah of Yusuf — practice is free, it won't change your plan.</p>
          <div className="bank">
            {corpus.verses.map((v) => (
              <button key={v.ayah} className="tile" onClick={() => setAyah(v.ayah)}>
                {v.ayah}
              </button>
            ))}
          </div>
          <button className="btn btn--ghost" onClick={onClose}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return <MeaningPractice corpus={corpus} ayah={ayah} onClose={() => setAyah(null)} />;
}

function MeaningPractice({ corpus, ayah, onClose }: { corpus: Corpus; ayah: number; onClose: () => void }) {
  const words = useMemo(() => ayahWords(corpus, ayah), [corpus, ayah]);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<{ choice: string; correct: boolean } | null>(null);
  const word = words[idx];

  // Reuse the engine's S1 gloss-option builder via a throwaway ladder state.
  const ladder = useMemo(() => initLadder(corpus, 12, ayah), [corpus, ayah]);

  if (!word) {
    return (
      <div className="screen">
        <div className="card">
          <div className="card-header">
            <span>Open practice · 12:{ayah}</span>
            <span>done</span>
          </div>
          <div className="banner banner--ok">
            <p>Nice — you ran through 12:{ayah}. (Free practice; your plan is unchanged.)</p>
          </div>
          <button className="btn btn--primary" onClick={onClose}>
            Pick another
          </button>
        </div>
      </div>
    );
  }

  const { options, correct } = s1Options(ladder, word.position);
  const opts = seededShuffle(options, `open:${ayah}:${word.position}`);
  const answered = feedback !== null;

  const choose = (o: string) => {
    if (answered) return;
    const isCorrect = o === correct;
    // EVIDENCE ONLY — structured:false (invariant #5: free play doesn't move state).
    void append(
      makeEvent({
        type: "tap",
        ts: Date.now(),
        surah: 12,
        ayah,
        rung: "S1",
        position: word.position,
        choice: o,
        correct: isCorrect,
        structured: false,
      }),
    );
    setFeedback({ choice: o, correct: isCorrect });
  };

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>Open practice · 12:{ayah}</span>
          <span>word {idx + 1} / {words.length}</span>
        </div>
        <ContextAyah words={words} targetPosition={word.position} />
        <p className="voice">What does the lit word mean? (free practice)</p>
        {opts.map((o) => {
          let cls = "option";
          if (answered) {
            if (o === correct) cls += " is-ok";
            else if (o === feedback?.choice) cls += " is-err";
          }
          return (
            <button key={o} className={cls} disabled={answered} onClick={() => choose(o)}>
              {o}
            </button>
          );
        })}
        {answered && (
          <button
            className="btn btn--primary"
            onClick={() => {
              setFeedback(null);
              setIdx(idx + 1);
            }}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
