// Session orchestrator (v0.3). Rebuilds the atoms cache from the event log,
// assembles the FR3 queue to pick what to do now, and wires start-stop: on
// re-entry it classifies the gap via the engine's resumePolicy. The heavy logic
// (scheduler, gates, resume, strength) is all in the pure engine; this hook only
// owns "now", IndexedDB, and the DOM visibility wiring.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assembleQueue,
  ayahWords,
  DEFAULT_DAY_CONFIG,
  makeEvent,
  type AtomsMap,
  type Corpus,
  type QueueItem,
  type ResumeAction,
} from "engine";
import { rebuildAtoms } from "../db/atoms.ts";
import { append } from "../db/eventLog.ts";
import { GapClock } from "./gapClock.ts";

const SURAH = 12;
// v0.3: 12:4 is the only fully-populated ayah, so it's the sole Learn candidate.
const LEARN_CANDIDATES = [4];

export interface SessionPlan {
  loading: boolean;
  /** The assembled queue (FR3 order). */
  queue: QueueItem[];
  /** The current item to work (first in the queue), or null when the session is empty/done. */
  current: QueueItem | null;
  /** Last resume classification, surfaced for UI copy ("resumed", "picked up where you left off"). */
  lastResume: ResumeAction | null;
  atoms: AtomsMap;
  /** Learn candidates in effect (placement start ayah window, or default). */
  candidates: number[];
  /** Word counts for the candidates (for cost disclosure). */
  wordCounts: Map<number, number>;
  /** Call after an item completes: re-plans and returns the FRESH queue (empty
   *  ⇒ the whole day's session is done). Callers must branch on this return
   *  value, never on the stale `queue` captured in their render closure. */
  completeCurrent: () => Promise<QueueItem[]>;
  /** Call on every tap so the gap clock stays fresh. */
  touch: () => void;
}

export function useSession(
  corpus: Corpus,
  now: () => number = Date.now,
  startAyah?: number,
): SessionPlan {
  // Open-into-drill timing (FR9 <3s): from hook mount → first item ready.
  const openedAtRef = useRef<number>(now());
  const sessionStartLoggedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [atoms, setAtoms] = useState<AtomsMap>(new Map());
  const [lastResume, setLastResume] = useState<ResumeAction | null>(null);
  const clockRef = useRef<GapClock>(new GapClock(DEFAULT_DAY_CONFIG, now()));
  // Mirror of the queue for the visibility handler (which closes over stale state).
  const queueRef = useRef<QueueItem[]>([]);

  // A small learn window (4 ayat) of ayat fully populated in the corpus, starting
  // at `start`. Pure helper — used both for the initial candidates memo (before
  // atoms exist) and, in plan(), recomputed from the highest ENCODED ayah so the
  // session always continues from where the learner actually is (never skips or
  // jumps back to a hardcoded default).
  const windowFrom = useCallback(
    (start: number): number[] => {
      const s = Math.max(1, Math.min(start, corpus.meta.ayahCount));
      const out: number[] = [];
      for (let a = s; a < s + 4 && a <= corpus.meta.ayahCount; a++) out.push(a);
      return out.length ? out : [LEARN_CANDIDATES[0]!];
    },
    [corpus],
  );

  // Initial candidates (before the first plan() rebuilds atoms): placement start,
  // else the v0.2 default. plan() overrides this from encoded history each cycle.
  const candidates = useMemo(
    () => windowFrom(startAyah && startAyah <= corpus.meta.ayahCount ? startAyah : LEARN_CANDIDATES[0]!),
    [windowFrom, startAyah, corpus.meta.ayahCount],
  );

  const [wordCountsState, setWordCounts] = useState<Map<number, number>>(() => {
    const m = new Map<number, number>();
    for (const c of candidates) m.set(c, ayahWords(corpus, c).length);
    return m;
  });
  const wordCounts = wordCountsState;
  // The live learn window (history-derived), surfaced to the gym. Seeded from the
  // initial candidates; plan() replaces it with the from-last-encoded window.
  const [learnWindowState, setLearnWindow] = useState<number[]>(candidates);

  const plan = useCallback(async (): Promise<QueueItem[]> => {
    const rebuilt = await rebuildAtoms(DEFAULT_DAY_CONFIG);
    // Continue the learn window from the highest encoded ayah (+1), so after
    // finishing 12:2 the next new ayah is 12:3 — not a hardcoded 12:4. Falls back
    // to the placement start (or 12:1) when nothing is encoded yet.
    let maxEncoded = 0;
    for (const a of rebuilt.values()) {
      if (a.kind === "ayah" && a.encoded && a.ref > maxEncoded) maxEncoded = a.ref;
    }
    const start = maxEncoded > 0 ? maxEncoded + 1 : startAyah && startAyah <= corpus.meta.ayahCount ? startAyah : LEARN_CANDIDATES[0]!;
    const learnWindow = windowFrom(start);
    setLearnWindow(learnWindow);
    const wc = new Map<number, number>();
    for (const c of learnWindow) wc.set(c, ayahWords(corpus, c).length);
    setWordCounts(wc);
    const q = assembleQueue({
      atoms: [...rebuilt.values()],
      now: now(),
      lastActiveDay: null,
      wordCounts: wc,
      cfg: { day: DEFAULT_DAY_CONFIG, learnCandidates: learnWindow, budgetMin: 8 },
    });
    setAtoms(rebuilt);
    setQueue(q);
    queueRef.current = q;
    setLoading(false);
    // Open-into-drill latency: log once, when the first drillable item is ready.
    if (!sessionStartLoggedRef.current && q.length > 0) {
      sessionStartLoggedRef.current = true;
      const latency = Math.max(0, now() - openedAtRef.current);
      void append(
        makeEvent({
          type: "session_start",
          ts: now(),
          surah: 12,
          ayah: q[0]!.ayah,
          rung: "S1",
          latency,
        }),
      );
    }
    return q; // surface the fresh queue so callers branch on truth, not closure
  }, [windowFrom, startAyah, corpus, now]);

  useEffect(() => {
    void plan();
  }, [plan]);

  // Start-stop: on tab re-focus, classify the gap and act. <2min resume in place
  // (no-op); larger gaps re-plan the queue. The engine decides; we just react.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const decision = clockRef.current.classify(now());
      setLastResume(decision.action);
      // Record genuine interruptions (a "resume" <2min gap is not one) so the
      // interruption→completion metric (v0.6) can be computed. Tagged with the
      // ayah currently in the queue.
      if (decision.action !== "resume") {
        const ayah = queueRef.current[0]?.ayah ?? 0;
        void append(
          makeEvent({
            type: "interruption",
            ts: now(),
            surah: SURAH,
            ayah,
            rung: "S1",
            resume: decision.action,
          }),
        );
      }
      if (decision.action === "replan" || decision.action === "makeup") {
        void plan();
      }
      clockRef.current.touch(now());
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [plan, now]);

  const touch = useCallback(() => clockRef.current.touch(now()), [now]);

  const completeCurrent = useCallback(async (): Promise<QueueItem[]> => {
    // Re-plan from the freshly-written events (atoms rebuild from truth).
    return await plan();
  }, [plan]);

  return {
    loading,
    queue,
    current: queue[0] ?? null,
    lastResume,
    atoms,
    candidates: learnWindowState,
    wordCounts,
    completeCurrent,
    touch,
  };
}
