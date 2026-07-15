// Drives the pure engine ladder and enforces invariant #2: every tap is appended
// to the durable event log BEFORE any UI feedback is shown. This hook holds no
// scheduling/strength/selection logic — all of that lives in `engine`. It only
// wires taps → event log → feedback → next item.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  advance,
  initLadder,
  makeEvent,
  nextItem,
  type Corpus,
  type DrillItem,
  type LadderDone,
  type LadderState,
} from "engine";
import { append } from "../db/eventLog.ts";

export type Feedback = { position: number; choice: string; correct: boolean } | null;

export interface LadderView {
  item: DrillItem | LadderDone;
  feedback: Feedback;
  /** True while an event is being committed (taps are ignored until it clears). */
  committing: boolean;
  submit: (choice: string) => Promise<void>;
  /** Clear feedback and reveal the next item (called after the slip/ok animation). */
  proceed: () => void;
  ayahComplete: boolean;
}

export function useLadder(corpus: Corpus, surah: number, ayah: number): LadderView {
  const stateRef = useRef<LadderState>(initLadder(corpus, surah, ayah));
  const [item, setItem] = useState<DrillItem | LadderDone>(() => nextItem(stateRef.current, corpus));
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [committing, setCommitting] = useState(false);
  const [ayahComplete, setAyahComplete] = useState(false);
  // When the current item was first shown — for per-item tap latency (v0.6).
  const shownAtRef = useRef<number>(Date.now());

  // Emitted once, at session open, so the log records the rung start. The ref
  // guard makes this idempotent under StrictMode's double-invocation.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const cur = nextItem(stateRef.current, corpus);
    if (!("done" in cur)) {
      void append(makeEvent({ type: "rung_start", ts: Date.now(), surah, ayah, rung: cur.rung }));
    }
  }, [corpus, surah, ayah]);

  const submit = useCallback(
    async (choice: string) => {
      if (committing) return; // never overlap a durable commit
      // During feedback: S1 pauses (must press Next) — ignore taps. On a slip
      // (S2/S3) the same-slot retry is allowed, so clear the stale slip first.
      if (feedback) {
        if (feedback.correct) return; // S1 correct: wait for proceed()
        setFeedback(null); // slip retry
      }
      const current = nextItem(stateRef.current, corpus);
      if ("done" in current) return;

      const result = advance(stateRef.current, corpus, choice);
      // The ladder only emits S1/S2/S3 (S4 bridge is driven separately in App).
      const position =
        current.rung === "S1"
          ? current.word.position
          : current.rung === "S2"
            ? current.blankPosition
            : current.rung === "S3"
              ? current.expectedPosition
              : 0;

      // ---- INVARIANT #2: commit BEFORE feedback ----
      setCommitting(true);
      const latency = Math.max(0, Date.now() - shownAtRef.current);
      await append(
        makeEvent({
          type: "tap",
          ts: Date.now(),
          surah,
          ayah,
          rung: current.rung,
          position,
          choice,
          correct: result.correct,
          pretest: result.pretest,
          latency,
        }),
      );
      if (result.rungCompleted) {
        await append(
          makeEvent({
            type: "rung_complete",
            ts: Date.now(),
            surah,
            ayah,
            rung: result.rungCompleted,
          }),
        );
      }
      if (result.ayahCompleted) {
        await append(
          makeEvent({ type: "ayah_complete", ts: Date.now(), surah, ayah, rung: "S3" }),
        );
      }
      // Only now, after the durable write, advance engine state.
      stateRef.current = result.state;
      setCommitting(false);
      if (result.ayahCompleted) setAyahComplete(true);

      // Feedback policy: S1 always pauses on feedback (learner reads the gloss
      // result). S2/S3 auto-advance on correct (keep the reading flow), and pause
      // only on a slip. This keeps commit-before-feedback intact either way.
      const pauseOnCorrect = current.rung === "S1";
      if (result.correct && !pauseOnCorrect && !result.ayahCompleted) {
        setItem(nextItem(result.state, corpus));
        setFeedback(null);
        shownAtRef.current = Date.now(); // next item shown now → reset latency clock
      } else {
        setFeedback({ position, choice, correct: result.correct });
      }
    },
    [committing, feedback, corpus, surah, ayah],
  );

  const proceed = useCallback(() => {
    setFeedback(null);
    setItem(nextItem(stateRef.current, corpus));
    shownAtRef.current = Date.now(); // next item shown → reset latency clock
  }, [corpus]);

  return { item, feedback, committing, submit, proceed, ayahComplete };
}
