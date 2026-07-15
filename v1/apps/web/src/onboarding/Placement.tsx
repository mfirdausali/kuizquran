// Placement onboarding (FR10). "Memorized before?" → adaptive junction probes at
// the 19 act landmarks, binary-searching the carried boundary. Each probe shows a
// scene and a recall MCQ (which word opens this act?) plus a first-class "I don't
// know". ~5 probes → carried map + start ayah + daily plan. Consumes iman-ui.css.

import { useEffect, useMemo, useState } from "react";
import {
  initPlacement,
  nextProbe,
  answerProbe,
  placementResult,
  makeEvent,
  type Corpus,
  type PlacementState,
  type ProbeAnswer,
} from "engine";
import { append } from "../db/eventLog.ts";
import { seededShuffle } from "../session/shuffle.ts";
import type { StoredPlacement } from "./useOnboarding.ts";

type Phase = "intro" | "probing" | "result";

export function Placement({
  corpus,
  onDone,
}: {
  corpus: Corpus;
  onDone: (p: StoredPlacement) => void;
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
            A few quick questions place you on the map — no pressure, "I don't know" is
            always fine.
          </p>
          <button className="btn btn--primary" onClick={() => setPhase("probing")}>
            Yes — check what I carry
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              // brand-new: nothing carried, start at ayah 1
              const r = placementResult(initPlacement(corpus), corpus);
              onDone({ carriedAyat: [], startAyah: r.startAyah, ayahPerDay: r.dailyPlan.ayahPerDay });
            }}
          >
            No — I'm starting fresh
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
              Start at ayah 12:{r.startAyah} · about {r.dailyPlan.ayahPerDay} ayah/day ·
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
                  surah: 12,
                  ayah: r.startAyah,
                  rung: "S1",
                }),
              );
              onDone({
                carriedAyat: r.carriedAyat,
                startAyah: r.startAyah,
                ayahPerDay: r.dailyPlan.ayahPerDay,
              });
            }}
          >
            Start learning
          </button>
        </div>
      </div>
    );
  }

  // probing
  const probe = nextProbe(state, corpus);
  if ("done" in probe) {
    // Guard: if we somehow reach probing with no probe left, render nothing and
    // let the effect below flip to result (no setState during render).
    return <ToResult setPhase={setPhase} />;
  }

  // key by the probed act so each probe REMOUNTS with a fresh (un-answered) state.
  return (
    <Probe
      key={probe.act}
      corpus={corpus}
      state={state}
      setState={setState}
      setPhase={setPhase}
    />
  );
}

// Flips to the result phase in an effect (avoids setState during render).
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
  // We know it's not done here.
  const p = probe as Exclude<typeof probe, { done: true }>;
  const opts = useMemo(() => seededShuffle(p.item.options, `place:${p.act}`), [p.item.options, p.act]);
  const [answered, setAnswered] = useState<ProbeAnswer | null>(null);

  const answer = (a: ProbeAnswer) => {
    void append(
      makeEvent({
        type: "placement_probe",
        ts: Date.now(),
        surah: 12,
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
              setAnswered(o === p.item.correct ? "yes" : "no");
              answer(o === p.item.correct ? "yes" : "no");
            }}
          >
            {o}
          </button>
        ))}
        <button className="btn btn--ghost" disabled={answered !== null} onClick={() => answer("idk")}>
          I don't know this part
        </button>
      </div>
    </div>
  );
}
