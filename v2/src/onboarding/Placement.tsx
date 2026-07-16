// Placement onboarding (FR10, v2-D12/D29). "Memorized before?" → adaptive
// junction probes at the 19 act landmarks, BINARY-SEARCHING the carried
// boundary (engine/src/placement.ts, ≤5 probes). Each probe shows a recall MCQ
// (which word opens this act?) plus a first-class "I don't know". Ported from
// v1's apps/web/src/onboarding/Placement.tsx onto v2's router/event-log.

import { useEffect, useMemo, useState } from "react";
import {
  initPlacement,
  nextProbe,
  answerProbe,
  placementResult,
  makeEvent,
  type Corpus,
  type PlacementResult,
  type PlacementState,
  type ProbeAnswer,
} from "engine";
import { append } from "../db/eventLog.ts";

const SURAH = 12; // v2 ships Yusuf only (v2-D29).

/** Fisher-Yates. Display-order shuffle only — option SET is stable/deterministic. */
function shuffled(items: string[]): string[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type Phase = "intro" | "probing" | "result";

export function Placement({
  corpus,
  onDone,
}: {
  corpus: Corpus;
  onDone: (r: PlacementResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [state, setState] = useState<PlacementState>(() => initPlacement(corpus));

  if (phase === "intro") {
    return (
      <div className="screen">
        <div className="card">
          <div className="card-header">
            <span>iman · Yusuf</span>
            <span>placement</span>
          </div>
          <p className="voice">Have you memorized part of Surah Yusuf before?</p>
          <p className="caption">
            A few quick questions place you on the map — no pressure, &quot;I don&apos;t know&quot;
            is always fine.
          </p>
          <button className="btn btn--primary" onClick={() => setPhase("probing")}>
            Yes — check what I carry
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onDone(placementResult(initPlacement(corpus), corpus))}
          >
            No — I&apos;m starting fresh
          </button>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const r = placementResult(state, corpus);
    return (
      <div className="screen">
        <div className="card">
          <div className="card-header">
            <span>Your placement</span>
            <span>{r.probeCount} questions</span>
          </div>
          <div className="banner banner--ok">
            <p>
              You carry {r.carriedActs.length} of 19 scenes ({r.carriedAyat.length} ayat).
            </p>
            <p className="sub">
              Start at ayah {SURAH}:{r.startAyah} · about {r.dailyPlan.ayahPerDay} ayah/day ·
              ~{r.dailyPlan.etaDays} days to finish.
            </p>
          </div>
          <button
            className="btn btn--primary"
            onClick={() => {
              void append(
                makeEvent({
                  type: "placement_result",
                  ts: Date.now(),
                  surah: SURAH,
                  ayah: r.startAyah,
                  rung: "S1",
                }),
              );
              onDone(r);
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // probing
  const probe = nextProbe(state, corpus);
  if ("done" in probe) {
    // Guard: if we somehow reach probing with no probe left, flip in an effect
    // (avoids setState during render).
    return <ToResult setPhase={setPhase} />;
  }

  // key by the probed act so each probe REMOUNTS with a fresh (un-answered) state.
  return <Probe key={probe.act} corpus={corpus} state={state} setState={setState} setPhase={setPhase} />;
}

function ToResult({ setPhase }: { setPhase: (p: Phase) => void }) {
  useEffect(() => setPhase("result"), [setPhase]);
  return null;
}

function Probe({
  corpus,
  state,
  setState,
  setPhase,
}: {
  corpus: Corpus;
  state: PlacementState;
  setState: (s: PlacementState) => void;
  setPhase: (p: Phase) => void;
}) {
  const probe = nextProbe(state, corpus);
  const p = probe as Exclude<typeof probe, { done: true }>;
  const opts = useMemo(() => shuffled(p.item.options), [p.item.options]);
  const [answered, setAnswered] = useState<ProbeAnswer | null>(null);

  const answer = (a: ProbeAnswer) => {
    void append(
      makeEvent({
        type: "placement_probe",
        ts: Date.now(),
        surah: SURAH,
        ayah: p.item.to,
        rung: "S1",
        choice: a,
      }),
    );
    const next = answerProbe(state, a);
    setState(next);
    if (next.done) setPhase("result");
  };

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>Placement · scene {p.act} / 19</span>
          <span>ayat {p.ayahRange}</span>
        </div>
        <p className="voice">Do you recall how this part goes — which word opens it?</p>
        {opts.map((o) => (
          <button
            key={o}
            className="option option--arabic"
            disabled={answered !== null}
            onClick={() => {
              const a = o === p.item.correct ? "yes" : "no";
              setAnswered(a);
              answer(a);
            }}
          >
            {o}
          </button>
        ))}
        <button className="btn btn--ghost" disabled={answered !== null} onClick={() => answer("idk")}>
          I don&apos;t know this part
        </button>
      </div>
    </div>
  );
}
