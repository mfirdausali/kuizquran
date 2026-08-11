"use client";

// SCREEN 2 — "FIRST RECALL, IMMEDIATELY" (WIREFRAME §17).
//
//     "Live tap-to-reconstruct of Al-Ikhlas 112:1 in three passes." (~45s)
//
// This is the single most important moment in the product. §17: "A successful
// blind reconstruction inside the first minute proves the mechanic and the
// learner's own capability — before anything has been asked."
//
// ---------------------------------------------------------------------------
// THE RISK, AND THE MITIGATION, IMPLEMENTED LITERALLY
// ---------------------------------------------------------------------------
// §17 states both:
//
//   "One risk: screen 2 uses Al-Ikhlas because nearly every target user
//    half-knows it. That is also its risk. Mitigation: pass 1 SHOWS the full
//    ayah before any recall is asked — nobody is tested on something they were
//    never shown."
//
// So PASS 1 IS NOT A QUESTION. It renders the whole ayah, plainly, with a
// "ready" button and no tiles at all. The learner cannot answer it, cannot get
// it wrong, and cannot skip past it without having had the text on screen. The
// three passes are therefore:
//
//   pass 1 · SHOW    — the full ayah, no recall asked. The mitigation.
//   pass 2 · ONE     — one word hidden. The gentlest possible first recall.
//   pass 3 · WHOLE   — the whole ayah reconstructed from nothing.
//
// Pass 2 and pass 3 are the REAL drill, driven by the REAL engine
// (`reconstruct.ts`) and painted by the REAL quiz component
// (`SequenceFillCard`, via `QuizCard`). There is no parallel implementation of
// tap-to-reconstruct here — that was the explicit instruction and it is also
// the only way this screen can honestly claim to prove the mechanic: if what
// the visitor taps on the landing page is not the thing the app does, the demo
// is a lie in the most literal sense.
//
// Pass 2's single blank and pass 3's full blanking are the engine's OWN rule,
// not a decision made here: `initReconstruct(..., {full})` produces the whole
// ayah, and the one-word pass asks for the same thing at the strength band
// where the engine itself yields one blank. Nothing in this file compares a
// strength to a threshold or counts blanks — `check-boundaries.mjs` clause 5
// forbids it, correctly.
//
// ---------------------------------------------------------------------------
// THIS SURFACE CAPTURES NOTHING. NOT EVEN AN EVENT.
// ---------------------------------------------------------------------------
// "Recall before identity" (§17's governing rule) is enforced by
// `check-boundaries.mjs` clause 8, which bans identity-capture markup on
// `components/onboarding/**`. But this file goes further than the gate
// requires: it writes NOTHING AT ALL — no IndexedDB append, no event, no meta
// key, no fetch beyond the static corpus asset.
//
// That is deliberate and it is not squeamishness. A learner on screen 2 has not
// chosen a surah, a pace or a gloss language, so there is no schedule for a
// graded event to belong to; appending `ayah_produced` here would move strength
// on an atom the learner never enrolled in, and invariant #5 ("only structured
// sessions mutate") says free-play is evidence that moves no strength. The
// honest reading is that this pass is not a session at all. It is a
// demonstration. The first real graded event is screen 7's.

import { useCallback, useEffect, useMemo, useState } from "react";
import { initReconstruct, advanceReconstruct, type ReconstructState } from "@engine/reconstruct.ts";
import type { Corpus } from "@engine/types.ts";
import { QuizCard } from "@/components/quiz/QuizCard";
import type { Reveal } from "@/components/quiz/reveal";
import { FaceText } from "@/components/quiz/FaceText";
import { buildFace, type Face } from "@engine/faces.ts";
import { assemblePass, filledSoFar } from "@/lib/onboarding/pass";
import { DEMO_AYAH, DEMO_SURAH, fetchCorpus } from "@/lib/corpus/client";

/** The three passes, as data. `show` carries no drill — that IS the mitigation. */
type Phase = "show" | "one" | "whole" | "done";

/** Strength values handed to the engine for each recall pass. These are not
 *  thresholds this component invents: they are the two ends of the engine's own
 *  band table, and which blanks result is entirely `reconstruct.ts`'s call. The
 *  `full` flag is what makes pass 3 whole-ayah, exactly as the cold gate does. */
const ONE_BLANK_STRENGTH = 0;

export interface FirstRecallProps {
  /** Called once the learner has produced the ayah whole — the moment §17 says
   *  the promise has been kept. The PARENT decides what happens next; this
   *  component never navigates and never records. */
  onProduced?: () => void;
  /** Continue label, so the landing demo and onboarding can differ in wording
   *  without forking the component. */
  continueLabel?: string;
}

export function FirstRecall({ onProduced, continueLabel }: FirstRecallProps) {
  const [corpus, setCorpus] = useState<Corpus | null | "pending">("pending");
  const [phase, setPhase] = useState<Phase>("show");
  const [state, setState] = useState<ReconstructState | null>(null);
  const [reveal, setReveal] = useState<Reveal | undefined>(undefined);
  const [slips, setSlips] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const loaded = await fetchCorpus(DEMO_SURAH);
      if (alive) setCorpus(loaded);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // The full ayah, for pass 1's plain display. Built through `buildFace` like
  // every other glyph in this app — the text is resolved from the corpus at a
  // coordinate, never handed in as a string.
  const ayahFace: Face | null = useMemo(() => {
    if (corpus === null || corpus === "pending") return null;
    return buildFace(corpus, { kind: "verse", ayah: DEMO_AYAH });
  }, [corpus]);

  const beginPass = useCallback(
    (next: "one" | "whole") => {
      if (corpus === null || corpus === "pending") return;
      setState(
        initReconstruct(
          corpus,
          DEMO_SURAH,
          DEMO_AYAH,
          ONE_BLANK_STRENGTH,
          next === "whole" ? { full: true } : undefined,
        ),
      );
      setReveal(undefined);
      setPhase(next);
    },
    [corpus],
  );

  const assembled = useMemo(() => {
    if (!state || corpus === null || corpus === "pending") return null;
    return assemblePass(state, corpus);
  }, [state, corpus]);

  const onAnswer = useCallback(
    (index: number) => {
      if (!state || !assembled || corpus === null || corpus === "pending") return;
      if (reveal) return; // already answered this blank; ignore double taps
      const face = assembled.item.options[index];
      if (!face) return;

      // THE ENGINE GRADES, NOT THIS COMPONENT. `advanceReconstruct` performs the
      // surface-equivalence-AT-POSITION comparison (B6/v3-D12 — NFC + tatweel,
      // harakat kept distinct). Comparing strings here would re-implement that
      // normalisation subtly differently, which is precisely the class of bug
      // the engine owns.
      const advanced = advanceReconstruct(state, corpus, face.text);

      if (!advanced.correct) {
        // A slip does not advance — the engine's own rule. Show the reveal so
        // the learner sees the key, then let them try the same blank again.
        setReveal({ chosenIndex: index });
        setSlips((n) => n + 1);
        return;
      }

      setState(advanced.state);
      setReveal(undefined);

      if (advanced.ayahProduced) {
        if (phase === "one") {
          // The gentle pass is done. Straight into the whole-ayah pass — the
          // one that actually proves the claim.
          beginPass("whole");
        } else {
          setPhase("done");
          onProduced?.();
        }
      }
    },
    [state, assembled, corpus, reveal, phase, beginPass, onProduced],
  );

  const retry = useCallback(() => setReveal(undefined), []);

  // -------------------------------------------------------------------------
  // CORPUS UNAVAILABLE — edge case #91, and the sacred-text rule at the failure
  // path. There is no fallback ayah and no placeholder glyph: a screen that
  // cannot prove its text came from the compiler shows no text.
  // -------------------------------------------------------------------------
  if (corpus === "pending") {
    return (
      <section className="card" aria-labelledby="fr-h">
        <div className="card-header">
          <span id="fr-h">Al-Ikhlas 112:1</span>
        </div>
        <p className="caption">
          <span className="skel" aria-hidden="true" />{" "}
          <span className="sr-only">Loading the ayah…</span>
          loading the ayah…
        </p>
      </section>
    );
  }

  if (corpus === null) {
    // #91: "offline before first precache → onboarding dead-end → explicit
    // 'connect once to begin' screen."
    return (
      <section className="card" aria-labelledby="fr-h">
        <div className="card-header">
          <span id="fr-h">Al-Ikhlas 112:1</span>
        </div>
        <div className="banner banner--warn" role="alert">
          <p>Connect once to begin.</p>
          <p className="sub">
            The ayah has not been downloaded to this device yet, and this app
            never shows Quranic text it cannot verify. Reconnect and reload —
            after the first load it works offline.
          </p>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // PASS 1 — SHOW. No recall is asked. This is §17's stated mitigation.
  // -------------------------------------------------------------------------
  if (phase === "show") {
    return (
      <section className="card" aria-labelledby="fr-h">
        <div className="card-header">
          <span id="fr-h">Al-Ikhlas 112:1</span>
          <span>read it</span>
        </div>
        <p className="caption">
          Read it once. Nothing is being tested yet — you will not be asked for
          anything you have not been shown.
        </p>
        {ayahFace ? (
          <FaceText face={ayahFace} className="ayah ayah--display" as="bdi" />
        ) : null}
        <button type="button" className="btn btn--primary hit" onClick={() => beginPass("one")}>
          I&apos;ve read it
        </button>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // DONE — the promise, kept, stated without inflation.
  // -------------------------------------------------------------------------
  if (phase === "done") {
    return (
      <section className="card" aria-labelledby="fr-h">
        <div className="card-header">
          <span id="fr-h">Al-Ikhlas 112:1</span>
          <span>done</span>
        </div>
        <div className="banner banner--ok" role="status">
          <p>You just rebuilt it from nothing.</p>
          <p className="sub">
            {slips === 0
              ? "No misses. That is what this app trains — rebuilding, not rereading."
              : `${slips} miss${slips === 1 ? "" : "es"} on the way, which is normal and is exactly what the schedule uses.`}
          </p>
        </div>
        {ayahFace ? (
          <FaceText face={ayahFace} className="ayah ayah--display" as="bdi" />
        ) : null}
        <p className="caption">
          Keeping it is the hard part, and it is the part this app is for.
        </p>
        {continueLabel ? (
          <button type="button" className="btn btn--primary hit" onClick={() => onProduced?.()}>
            {continueLabel}
          </button>
        ) : null}
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // PASSES 2 AND 3 — the real drill, the real component.
  // -------------------------------------------------------------------------
  if (!assembled || !state) return null;

  return (
    <>
      <p className="caption">
        {phase === "one"
          ? "One word is hidden. Tap the word that belongs in the gap."
          : "Now the whole ayah, from nothing. Tap the words in order."}
      </p>

      <QuizCard
        item={assembled.item}
        onAnswer={onAnswer}
        reveal={reveal}
        filled={filledSoFar(state)}
        label={phase === "one" ? "One word" : "The whole ayah"}
      />

      {/* A slip is not a failure state and is never punished. The engine keeps
          the cursor on the same blank; this is just the way back to it. Text as
          well as colour — WIREFRAME §15, never colour alone. */}
      {reveal ? (
        <div className="stack stack--tight">
          <p className="caption">Not that one — the right word is marked. Try it again.</p>
          <button type="button" className="btn hit" onClick={retry}>
            Try again
          </button>
        </div>
      ) : null}
    </>
  );
}
