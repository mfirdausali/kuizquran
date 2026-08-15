"use client";

// THE DRILL, WIRED (v3-D67).
//
// ---------------------------------------------------------------------------
// WHAT THIS COMPONENT IS ALLOWED TO DECIDE: NOTHING
// ---------------------------------------------------------------------------
// It loads a corpus, hands taps to `lib/session/run.ts`, and paints what comes
// back. It performs no strength comparison, no band test, no queue assembly and
// no grading — `check-boundaries.mjs` clause 5 fails the build if any of those
// appear under `components/`, which is what makes DEFECTS.md#B2 impossible by
// construction rather than merely fixed once.
//
// In particular it NEVER decides whether a tap was right. `answerCurrent` awaits
// the durable write and returns a state carrying `lastTap`; this component turns
// that into the card's `reveal` prop. So a verdict on screen always has an event
// behind it (invariant #2) — the ordering is enforced in `run.ts` and covered by
// a test that kills the fire-and-forget mutant.
//
// ---------------------------------------------------------------------------
// WHY IT REUSES `assemblePass` RATHER THAN ASSEMBLING ITS OWN ITEM
// ---------------------------------------------------------------------------
// `lib/onboarding/pass.ts` already turns a `ReconstructState` into a
// `SequenceFillItem`, and its header says why it was extracted: so screen 2 and
// the session loop share ONE assembly instead of two that drift. This is the
// session loop. It uses that one.
//
// NO ARABIC IS WRITTEN HERE. Every glyph arrives inside a `Face` built by
// `buildFace` from a corpus coordinate.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Corpus } from "@engine/types.ts";

import { QuizCard } from "@/components/quiz/QuizCard";
import { fetchCorpus } from "@/lib/corpus/client";
import { assemblePass, filledSoFar } from "@/lib/onboarding/pass";
import { currentTz } from "@/lib/idb/append";
import { writeLock } from "@/lib/idb/writeLock";
import { refreshEntitlementSnapshot } from "@/lib/entitlement/sync";
import {
  answerCurrent,
  clearReveal,
  currentItem,
  sessionSummaryOf,
  startSession,
  type SessionRun,
  type SessionUnavailable,
} from "@/lib/session/run";
import type { SessionSummary } from "@engine/sessionSummary.ts";

export interface SessionIslandProps {
  /** Which surah this session drills. Chosen at onboarding, passed in as data —
   *  this component never picks. */
  surah: number;
}

type Phase =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: SessionUnavailable | "no-corpus" }
  | { kind: "not-writer" }
  | { kind: "failed"; message: string }
  | { kind: "drilling" }
  | { kind: "summary"; summary: SessionSummary };

export function SessionIsland({ surah }: SessionIslandProps) {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [run, setRun] = useState<SessionRun | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  // Load the corpus, then start (or RESUME) the session. Resume is not a
  // separate path: the queue is derived from the fold of the event log, so a
  // reload re-derives whatever is still due (edge case #93).
  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;

    // OPPORTUNISTIC ENTITLEMENT CACHE WARM — v3-D88's unwired half.
    // `lib/entitlement/sync.ts` was built (GET /api/entitlement + an
    // offline-durable cache) so `permitsIssuance()` could one day be called
    // with real data, but nothing ever called IT either. This is the cache
    // warm only: fire-and-forget, never awaited, and its result gates
    // nothing here — the actual GATING call remains deliberately unwired
    // (v3-D88: a genuine open product question about what "lapsed" means
    // for a queue that mixes new material and review in one assembly,
    // Firdaus's call, not this component's). `refreshEntitlementSnapshot`
    // never throws by its own contract (see its own tests); the `catch` is
    // this codebase's usual belt-and-braces around an effect boundary.
    void refreshEntitlementSnapshot(Date.now()).catch(() => {});

    // Load the corpus and start the session. Only ever entered once THIS TAB
    // is confirmed the writer (v3-D93).
    async function beginAsWriter(): Promise<void> {
      try {
        const c = await fetchCorpus(surah);
        if (!alive) return;
        if (!c) {
          setPhase({ kind: "unavailable", reason: "no-corpus" });
          return;
        }
        setCorpus(c);
        const started = await startSession(
          { surah, now: Date.now(), tz: currentTz() },
          c,
        );
        if (!alive) return;
        if (!started.ok) {
          setPhase({ kind: "unavailable", reason: started.unavailable });
          return;
        }
        setRun(started.run);
        setPhase({ kind: "drilling" });
      } catch (err) {
        // A thrown start must show a state, never leave the learner on a
        // spinner. An infinite "Preparing…" is indistinguishable from a hang.
        if (!alive) return;
        setPhase({
          kind: "failed",
          message: err instanceof Error ? err.message : "Could not start the session.",
        });
      }
    }

    void (async () => {
      try {
        // ACQUIRE THE WRITE LOCK FIRST. `append` re-asserts writer status at
        // commit time (edge case #75) and THROWS if this tab never claimed it.
        // Nothing in the app claimed it before this — the lock sat `pending`
        // forever, so the very first `session_start` append threw and the page
        // hung on "Preparing…". Found by the e2e suite in a real browser; no
        // unit test caught it because they force writer status directly.
        const status = await writeLock.acquire();
        if (!alive) return;
        if (status.role === "writer") {
          await beginAsWriter();
          return;
        }
        // Another tab owns the session right now. Refusing to write here is
        // correct: two tabs appending under one deviceId would fork the
        // per-device ordinal namespace, which is unrepairable.
        setPhase({ kind: "not-writer" });
        // BUT `WriteLock.release()`'s own contract is "a queued tab is
        // promoted without a reload" — the Web Locks request behind
        // `acquire()` is still queued and can be granted LATER, in a task
        // this effect has already returned from. v3-D93: subscribe so that
        // later grant actually starts the session, instead of leaving the
        // learner stuck on this message until they reload by hand.
        unsubscribe = writeLock.subscribe((s) => {
          if (!alive || s.role !== "writer") return;
          unsubscribe?.();
          unsubscribe = null;
          void beginAsWriter();
        });
      } catch (err) {
        if (!alive) return;
        setPhase({
          kind: "failed",
          message: err instanceof Error ? err.message : "Could not start the session.",
        });
      }
    })();
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [surah]);

  const cur = useMemo(() => {
    if (!run || !corpus) return null;
    return currentItem(run, corpus);
  }, [run, corpus]);

  const assembled = useMemo(() => {
    if (!run || !corpus || !cur) return null;
    return assemblePass(run.machine, corpus);
  }, [run, corpus, cur]);

  const filled = useMemo(() => {
    if (!run) return new Map<number, string>();
    return filledSoFar(run.machine);
  }, [run]);

  const onAnswer = useCallback(
    (index: number) => {
      if (!run || !corpus || busy) return;
      // Ignore taps while a verdict is showing: the learner must acknowledge
      // before the next blank, and a double-tap must never double-append.
      if (run.lastTap) return;

      setBusy(true);
      void (async () => {
        // COMMIT BEFORE PAINT: this await is the invariant. `answerCurrent`
        // does not resolve until the event is durable.
        try {
          const next = await answerCurrent(run, corpus, index, {
            now: Date.now(),
            tz: currentTz(),
          });
          setRun(next);

          if (next.done) {
            const summary = await sessionSummaryOf(next);
            setPhase({ kind: "summary", summary });
          }
        } catch (err) {
          // A failed COMMIT must never paint a verdict (invariant #2). Losing
          // the write lock mid-session is the real case: the tap did not land,
          // so the learner is told rather than shown a grade with no event.
          setPhase({
            kind: "failed",
            message:
              err instanceof Error ? err.message : "That tap could not be saved.",
          });
        } finally {
          setBusy(false);
        }
      })();
    },
    [run, corpus, busy],
  );

  const onContinue = useCallback(() => {
    setRun((r) => (r ? clearReveal(r) : r));
  }, []);

  if (phase.kind === "loading") {
    return <p className="caption">Preparing today&apos;s session…</p>;
  }

  if (phase.kind === "not-writer") {
    return (
      <p className="caption">
        This session is open in another tab. Continue there, or close it and
        reload this page.
      </p>
    );
  }

  if (phase.kind === "failed") {
    return (
      <p className="caption" role="alert">
        {phase.message}
      </p>
    );
  }

  if (phase.kind === "unavailable") {
    // Each reason gets its own words. "Nothing due" is success; "no corpus" is
    // a failure. A learner cannot tell them apart from one shared empty state.
    return (
      <p className="caption">
        {phase.reason === "nothing-due"
          ? "Nothing is due right now. Come back later today."
          : "This surah is not available on this device yet."}
      </p>
    );
  }

  if (phase.kind === "summary") {
    const { summary } = phase;
    return (
      <div className="stack" data-testid="session-summary">
        <h2 style={{ margin: 0, fontSize: 16 }}>Session complete</h2>
        <p className="caption">
          {summary.ayatCompleted} ayat · {summary.taps} taps
          {summary.recall !== null
            ? ` · ${Math.round(summary.recall * 100)}% recall`
            : ""}
        </p>
      </div>
    );
  }

  if (!assembled || !cur) {
    return <p className="caption">Nothing left to drill.</p>;
  }

  // The reveal comes from the run's `lastTap`, which only exists after the
  // append landed. The card never grades itself.
  // `Reveal` carries ONLY the tapped index: the card derives right/wrong by
  // comparing it against the item's own correct option. Passing a `correct`
  // boolean in would be this component grading, which is exactly what the
  // shape forbids.
  const reveal = run?.lastTap ? { chosenIndex: run.lastTap.index } : undefined;

  return (
    <div className="stack" data-testid="session-drill">
      <QuizCard
        item={assembled.item}
        onAnswer={onAnswer}
        reveal={reveal}
        filled={filled}
        surah={surah}
      />
      {reveal ? (
        <>
          {/*
            NEVER COLOUR ALONE (WIREFRAME §15), and this caller is why the rule
            needs restating. `optionStateClass` says colour is not the only
            signal because `.option.is-err` also carries the locked `shake`
            animation — but `prefers-reduced-motion` KILLS that animation. For a
            reduced-motion deuteranope, colour would then be the only signal
            left, and right and wrong become indistinguishable.

            LAUNCH-CHECKLIST predicted exactly this: the contract "holds today by
            caller discipline rather than by construction... worth closing when
            the session loop (currently a stub) lands." This is that caller, so
            this is that text. `role="status"` announces it to a screen reader
            without stealing focus mid-drill.
          */}
          <p className="caption" role="status">
            {run?.lastTap?.correct ? "Correct." : "Not quite — try again."}
          </p>
          <button type="button" className="btn" onClick={onContinue}>
            Continue
          </button>
        </>
      ) : null}
    </div>
  );
}
