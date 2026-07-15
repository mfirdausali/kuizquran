// Chain drill (FR4 Carry): tap-through a run of ayat —
//   ayah n → junction(n→n+1) → ayah n+1 …
// An ayah step is a full-ayah production (tap words in reading order, S3-form
// bank); a junction step is a "which ayah opens next?" MCQ. On completion the
// caller FIRe-credits every traversed atom. Consumes iman-ui.css verbatim
// (.bank/.tile for ayah steps, .option--arabic for junctions).

import { useMemo, useState } from "react";
import { chainSteps, junctionItem, type ChainStep, type ChainStepResult, type Corpus } from "engine";
import { ayahWords } from "engine";
import { seededShuffle } from "../session/shuffle.ts";

export function ChainDrill({
  corpus,
  fromAyah,
  toAyah,
  onComplete,
  onTap,
}: {
  corpus: Corpus;
  fromAyah: number;
  toAyah: number;
  /** Called once with every step's correctness (for FIRe credit) when the chain finishes. */
  onComplete: (results: ChainStepResult[]) => void;
  onTap?: () => void;
}) {
  const steps = useMemo(() => chainSteps(fromAyah, toAyah), [fromAyah, toAyah]);
  const [stepIdx, setStepIdx] = useState(0);
  const [results, setResults] = useState<ChainStepResult[]>([]);
  // per-ayah-step tap progress
  const [expectedPos, setExpectedPos] = useState(1);
  const [hadErrorThisStep, setHadErrorThisStep] = useState(false);
  const [slip, setSlip] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const step = steps[stepIdx];

  function finishStep(correct: boolean) {
    const newResults = [...results, { step: step!, correct }];
    setResults(newResults);
    if (stepIdx + 1 >= steps.length) {
      setDone(true);
      onComplete(newResults);
    } else {
      setStepIdx(stepIdx + 1);
      setExpectedPos(1);
      setHadErrorThisStep(false);
      setSlip(null);
    }
  }

  if (done || !step) {
    return (
      <div className="card">
        <div className="card-header">
          <span>
            Chain 12:{fromAyah} → 12:{toAyah}
          </span>
          <span>complete</span>
        </div>
        <div className="banner banner--ok">
          <p>Chain complete — the connection and both ayat were reviewed.</p>
          <p className="sub">One tap-through credited every verse and junction it crossed.</p>
        </div>
      </div>
    );
  }

  if (step.kind === "ayah") {
    return (
      <AyahStep
        corpus={corpus}
        ayah={step.ref}
        fromAyah={fromAyah}
        toAyah={toAyah}
        expectedPos={expectedPos}
        slip={slip}
        onTap={(word) => {
          onTap?.();
          setSlip(null);
          const expected = ayahWords(corpus, step.ref).find((w) => w.position === expectedPos);
          if (expected && word === expected.text_uthmani) {
            const total = ayahWords(corpus, step.ref).length;
            if (expectedPos >= total) finishStep(!hadErrorThisStep);
            else setExpectedPos(expectedPos + 1);
          } else {
            setHadErrorThisStep(true);
            setSlip(word);
          }
        }}
      />
    );
  }

  // junction step
  return (
    <JunctionStep
      corpus={corpus}
      from={step.from}
      to={step.to}
      slip={slip}
      onChoose={(choice, correct) => {
        onTap?.();
        if (correct) finishStep(true);
        else {
          setSlip(choice);
          setHadErrorThisStep(true);
          // allow retry; a junction records incorrect if first attempt failed
          finishStep(false);
        }
      }}
    />
  );
}

function AyahStep({
  corpus,
  ayah,
  fromAyah,
  toAyah,
  expectedPos,
  slip,
  onTap,
}: {
  corpus: Corpus;
  ayah: number;
  fromAyah: number;
  toAyah: number;
  expectedPos: number;
  slip: string | null;
  onTap: (word: string) => void;
}) {
  const words = useMemo(() => ayahWords(corpus, ayah), [corpus, ayah]);
  const bank = useMemo(() => seededShuffle(words, `chain:${ayah}`), [words, ayah]);
  const used = new Set(words.filter((w) => w.position < expectedPos).map((w) => w.position));
  // The verse the learner is producing, in reading order, growing per correct tap.
  const producedSoFar = words
    .filter((w) => w.position < expectedPos)
    .sort((a, b) => a.position - b.position);
  return (
    <div className="card">
      <div className="card-header">
        <span>
          Chain 12:{fromAyah} → 12:{toAyah}
        </span>
        <span>ayah 12:{ayah}</span>
      </div>
      <p className="voice">Produce ayah 12:{ayah} — tap the words in order.</p>
      {/* The building line: the words you've placed so far, assembling into the
          verse (largest type — the Amiri ayah; invariant #5). Placeholder dashes
          until the first tap so the slot is visible from the start. */}
      <div className="ayah" aria-live="polite">
        {producedSoFar.length === 0
          ? "……"
          : producedSoFar.map((w, i) => (
              <span key={w.position}>
                {w.text_uthmani}
                {i < producedSoFar.length - 1 ? " " : ""}
              </span>
            ))}
      </div>
      <div className="bank">
        {bank.map((w) => {
          const isUsed = used.has(w.position);
          const isSlip = slip === w.text_uthmani && !isUsed;
          let cls = "tile";
          if (isUsed) cls += " is-used";
          else if (isSlip) cls += " is-err";
          return (
            <button
              key={w.position}
              className={cls}
              disabled={isUsed}
              onClick={() => onTap(w.text_uthmani)}
            >
              {w.text_uthmani}
            </button>
          );
        })}
      </div>
      {slip && <p className="caption">Follow the reading order.</p>}
    </div>
  );
}

function JunctionStep({
  corpus,
  from,
  to,
  slip,
  onChoose,
}: {
  corpus: Corpus;
  from: number;
  to: number;
  slip: string | null;
  onChoose: (choice: string, correct: boolean) => void;
}) {
  const j = useMemo(() => junctionItem(corpus, from, to), [corpus, from, to]);
  const opts = useMemo(() => seededShuffle(j.options, `junction:${from}`), [j.options, from]);
  return (
    <div className="card">
      <div className="card-header">
        <span>
          Junction 12:{from} → 12:{to}
        </span>
        <span>what opens next?</span>
      </div>
      <p className="voice">After 12:{from}, which word opens the next ayah?</p>
      {opts.map((o) => {
        let cls = "option option--arabic";
        if (slip === o) cls += " is-err";
        return (
          <button key={o} className={cls} onClick={() => onChoose(o, o === j.correct)}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
