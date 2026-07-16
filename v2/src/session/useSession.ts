// Session orchestrator (ROADMAP Phase 2). Rebuilds the atoms cache from the
// event log, assembles the FR3 queue via the engine's assembleQueue, and wires
// pace mode in. This is the fix for v2-BUG-1 and v2-BUG-2: v1's useSession.ts
// hardcoded `budgetMin:8` (every pace mode collapsed to the same drip) and
// `lastActiveDay:null` (the make-up merge never fired live). Here both are real:
// budgetMin comes from the persisted PaceConfig, lastActiveDay comes straight
// from the append-only event log via the engine's lastActiveDayMs(). The heavy
// logic (scheduler, gates, pace) is all in the pure engine; this hook only owns
// "now" and IndexedDB.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assembleQueue,
  ayahWords,
  candidatesForPace,
  DEFAULT_DAY_CONFIG,
  lastActiveDayMs,
  paceConfig,
  type AtomsMap,
  type Corpus,
  type DrillEvent,
  type PaceMode,
  type QueueItem,
} from "engine";
import { rebuildAtoms } from "../db/atoms.ts";
import { getAll } from "../db/eventLog.ts";
import { getPaceMode, setPaceMode as persistPaceMode } from "./pace.ts";
import { loadPlacement } from "./placement.ts";

// A small learn window of ayat immediately after the highest ENCODED ayah — the
// same "continue from where the learner actually is" pattern v1 used, clipped to
// the pace mode's new-ayah ceiling (v2-D09) before it ever reaches assembleQueue.
const LEARN_WINDOW = 6;

/**
 * Where the Learn window should start. Once anything is encoded, always
 * continue from maxEncoded+1 (never skip back). Before that (day 1, nothing
 * encoded yet), fall back to a returning-hifz learner's placement start ayah
 * (ROADMAP Phase 3) rather than a hardcoded 1 — otherwise placement would
 * re-Learn ayat the learner told onboarding they already carry. Pure and
 * exported so the fallback is unit-testable without a React render.
 */
export function learnWindowStart(
  maxEncoded: number,
  placementStartAyah: number | null,
  ayahCount: number,
): number {
  const fallback = maxEncoded > 0 ? maxEncoded + 1 : (placementStartAyah ?? 1);
  return Math.min(Math.max(1, fallback), ayahCount);
}

export interface SessionPlan {
  loading: boolean;
  /** The assembled queue (FR3 order), already pace- and gate-tolerance-scoped. */
  queue: QueueItem[];
  /** The first item to work, or null when today's session is empty/done. */
  current: QueueItem | null;
  atoms: AtomsMap;
  mode: PaceMode;
  /** Mid-surah editable (v2-D09) — persists and re-plans immediately. */
  setMode: (mode: PaceMode) => void;
  /** Re-plan from the freshly-written event log (call after any completed item). */
  refresh: () => Promise<QueueItem[]>;
}

export function useSession(corpus: Corpus, now: () => number = Date.now): SessionPlan {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [atoms, setAtoms] = useState<AtomsMap>(new Map());
  const [mode, setModeState] = useState<PaceMode>(() => getPaceMode());

  const setMode = useCallback((next: PaceMode) => {
    persistPaceMode(next);
    setModeState(next);
  }, []);

  const plan = useCallback(async (): Promise<QueueItem[]> => {
    const [rebuilt, events] = await Promise.all([rebuildAtoms(DEFAULT_DAY_CONFIG), getAll()]);
    // v2-BUG-2 fix: derived from the real durable log, never hardcoded null.
    const lastActiveDay = lastActiveDayMs(events as DrillEvent[]);

    let maxEncoded = 0;
    for (const a of rebuilt.values()) {
      if (a.kind === "ayah" && a.encoded && a.ref > maxEncoded) maxEncoded = a.ref;
    }
    const windowStart = learnWindowStart(maxEncoded, loadPlacement()?.startAyah ?? null, corpus.meta.ayahCount);
    const window: number[] = [];
    for (let a = windowStart; a < windowStart + LEARN_WINDOW && a <= corpus.meta.ayahCount; a++) {
      window.push(a);
    }
    const learnCandidates = candidatesForPace(window, mode);
    const wordCounts = new Map<number, number>();
    for (const c of window) wordCounts.set(c, ayahWords(corpus, c).length);

    // v2-BUG-1 fix: budgetMin (and the v2-D07 gate tolerance) come from the real,
    // persisted, mode-scoped PaceConfig — not a hardcoded 8.
    const pc = paceConfig(mode);
    const q = assembleQueue({
      atoms: [...rebuilt.values()],
      now: now(),
      lastActiveDay,
      wordCounts,
      cfg: {
        day: DEFAULT_DAY_CONFIG,
        learnCandidates,
        budgetMin: pc.budgetMin,
        gateTolerance: pc.gateTolerance,
      },
    });

    setAtoms(rebuilt);
    setQueue(q);
    setLoading(false);
    return q;
  }, [corpus, mode, now]);

  useEffect(() => {
    setLoading(true);
    void plan();
  }, [plan]);

  const current = useMemo(() => queue[0] ?? null, [queue]);

  return { loading, queue, current, atoms, mode, setMode, refresh: plan };
}
