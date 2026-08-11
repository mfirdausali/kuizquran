"use client";

// THE INLINE TAP-TO-RECONSTRUCT DEMO — Al-Ikhlas 112:1, live, no install.
//
// ---------------------------------------------------------------------------
// ONE ARTIFACT, TWO MOUNT POINTS — WHICH IS WHY IT LIVES HERE
// ---------------------------------------------------------------------------
// WIREFRAME §18 §2 (the landing page's conversion engine) and §17 screen 2
// ("first recall, immediately", before any identity exists) are the SAME drill:
// a fully working reconstruct of 112:1 that a stranger can complete in ten
// seconds. Two implementations of one drill would drift — and would drift
// invisibly, since each would keep passing its own tests while the two screens
// slowly disagreed about what the product's core mechanic feels like.
//
// So it lives in `components/demo/`, which belongs to NEITHER surface. The
// landing page imports it; onboarding screen 2 imports it. Neither owns it.
//
// ---------------------------------------------------------------------------
// IT DECIDES NOTHING (check-boundaries.mjs clause 5)
// ---------------------------------------------------------------------------
// Which ayah, which band, how many blanks, whether a tap was correct, what the
// caption says — all of it is `lib/demo/reconstruct.ts`, computed as data and
// read off an object here. This file's whole job is: fetch, hold one state
// object, hand a RenderItem to the card the rest of the app already uses.
//
// It reuses `SequenceFillCard` deliberately rather than drawing its own tiles.
// A landing-page mock that merely LOOKS like the drill would be exactly the
// dishonesty §18 warns against ("the mechanic sells itself; describing it does
// not"), and it would rot the moment the real card changed. What the visitor
// taps here is the same component a paying learner taps in a session, driven by
// the same `reconstruct.ts` state machine, over the same compiled corpus.
//
// ---------------------------------------------------------------------------
// PRE-RECALL: NOTHING IS CAPTURED AND NOTHING IS WRITTEN
// ---------------------------------------------------------------------------
// No email field, no notification prompt, no account, no IndexedDB write, no
// analytics call. Gate clause 8 enforces the markup half on every pre-recall
// surface; the no-write half is a property of `lib/demo/`, which has no import
// of `lib/idb` or `lib/sync` at all.
//
// ---------------------------------------------------------------------------
// THE UNAVAILABLE STATE IS DESIGNED, NOT AN ACCIDENT
// ---------------------------------------------------------------------------
// v3-D52 makes the corpus a build artifact: a clean checkout without
// `make compile-corpus` has nothing to stage, and an offline first visit has
// nothing to fetch. Both render a plain, honest line saying the demo could not
// load — never a spinner that never resolves, and never a fabricated ayah.
// The CTA stays reachable in that state, because a visitor who cannot see the
// demo should still be able to start.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Corpus } from "@engine/types.ts";
import { SequenceFillCard } from "@/components/quiz/SequenceFillCard";
import {
  applyTap,
  clearReveal,
  demoCaption,
  startDemo,
  stepOf,
  DEMO_SURAH,
  type DemoState,
  type DemoUnavailable,
} from "@/lib/demo/reconstruct";
import { loadClientCorpus } from "@/lib/demo/loadClientCorpus";

/** How long a wrong tap stays marked before the bank unlocks. Long enough to
 *  read the mark, short enough not to feel like a punishment. Presentation
 *  timing, which is why it is here and not in lib/. */
const SLIP_REVEAL_MS = 700;

export interface InlineDemoProps {
  /** Heading for the card. The landing page and onboarding say different
   *  things around the same drill; the drill itself does not change. */
  label?: string;
  /** Rendered under the completed drill — the landing page puts its CTA here,
   *  onboarding puts its "continue" there. The demo does not know what comes
   *  next and must not: that is the difference between the two surfaces. */
  onDone?: React.ReactNode;
}

type Phase =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: DemoUnavailable | "fetch" }
  | { kind: "ready"; corpus: Corpus; state: DemoState };

export function InlineDemo({ label, onDone }: InlineDemoProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const slipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    void (async () => {
      const corpus = await loadClientCorpus(DEMO_SURAH, controller.signal);
      if (!alive) return;
      if (!corpus) {
        setPhase({ kind: "unavailable", reason: "fetch" });
        return;
      }
      const started = startDemo(corpus);
      if ("unavailable" in started) {
        setPhase({ kind: "unavailable", reason: started.unavailable });
        return;
      }
      setPhase({ kind: "ready", corpus, state: started.state });
    })();

    return () => {
      alive = false;
      controller.abort();
      if (slipTimer.current !== null) clearTimeout(slipTimer.current);
    };
  }, []);

  const onAnswer = useCallback((index: number) => {
    setPhase((current) => {
      if (current.kind !== "ready") return current;
      const next = applyTap(current.state, current.corpus, index);
      // A slip marks the tile and locks the bank for one beat, then clears.
      // A correct tap advances immediately: the reveal for a right answer is
      // the word appearing in its slot, which is already on screen.
      if (next.lastTap && !next.lastTap.correct) {
        if (slipTimer.current !== null) clearTimeout(slipTimer.current);
        slipTimer.current = setTimeout(() => {
          setPhase((p) => (p.kind === "ready" ? { ...p, state: clearReveal(p.state) } : p));
        }, SLIP_REVEAL_MS);
      }
      return { ...current, state: next };
    });
  }, []);

  if (phase.kind === "loading") {
    // A skeleton, never a zero and never a fake ayah (#73's rule, applied to a
    // surface that has no numbers: what is unknown is drawn as unknown).
    return (
      <section className="card demo" aria-busy="true" aria-label="Loading the demo">
        <div className="card-header">
          <span>{label ?? "Try it"}</span>
        </div>
        <span className="skel skel--row" />
        <span className="skel skel--row" />
      </section>
    );
  }

  if (phase.kind === "unavailable") {
    return (
      <section className="card demo" aria-label="Demo">
        <div className="card-header">
          <span>{label ?? "Try it"}</span>
        </div>
        <p className="caption">
          The demo could not load right now. Nothing is wrong with your
          connection to the rest of this page — the drill needs the compiled
          text, and this build could not fetch it.
        </p>
        {onDone}
      </section>
    );
  }

  const { corpus, state } = phase;
  const step = stepOf(state, corpus);

  // The pass is complete: no current blank, so no bank. The finished ayah is
  // shown through the same card with every position filled, which is what the
  // visitor just produced — not a re-render of the verse from somewhere else.
  if (state.done || !step) {
    return (
      <section className="card demo" aria-label="Demo complete">
        <div className="card-header">
          <span>{label ?? "Try it"}</span>
          <span>done</span>
        </div>
        <p className="caption" role="status">
          {demoCaption(state)}
        </p>
        <p className="caption demo-honest">
          That is cued production — the real bar this app schedules toward. It
          is not a claim about your recitation: this app never listens, and a
          teacher is still the one who verifies that.
        </p>
        {onDone}
      </section>
    );
  }

  return (
    <div className="demo">
      <SequenceFillCard
        item={step.item}
        onAnswer={onAnswer}
        filled={step.filled}
        // The reveal is only ever the ENGINE's verdict, passed straight
        // through. This component never compares a tap to an answer.
        reveal={
          state.lastTap && !state.lastTap.correct
            ? { chosenIndex: state.lastTap.index }
            : undefined
        }
        label={label ?? "Try it — Al-Ikhlas 112:1"}
      />
      <p className="caption demo-caption" role="status">
        {demoCaption(state)}
      </p>
    </div>
  );
}
