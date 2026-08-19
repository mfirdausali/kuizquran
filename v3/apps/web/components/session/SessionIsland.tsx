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
  acceptGateDemote,
  answerCurrent,
  clearReveal,
  currentItem,
  demoteOfferFor,
  extraLearnOfferFor,
  sessionSummaryOf,
  startExtraLearn,
  startSession,
  startWeakSpotDrill,
  weakSpotOfferFor,
  SessionCommitFailure,
  type SessionRun,
  type SessionUnavailable,
} from "@/lib/session/run";
import type { SessionSummary } from "@engine/sessionSummary.ts";
import type { ExtraLearnGrant, WeakSpot } from "@engine/freeplay.ts";

export interface SessionIslandProps {
  /** Which surah this session drills. Chosen at onboarding, passed in as data —
   *  this component never picks. */
  surah: number;
}

type Phase =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: SessionUnavailable | "no-corpus" }
  | { kind: "not-writer" }
  // `retry`, when present, is a RETRYABLE commit failure (edge case #74):
  // clicking it re-enters `SessionCommitFailure.resume()`, never a fresh
  // `answerCurrent` call — see that class's own header for why.
  | { kind: "failed"; message: string; retry?: () => void }
  | { kind: "drilling" }
  | { kind: "summary"; summary: SessionSummary };

export function SessionIsland({ surah }: SessionIslandProps) {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [run, setRun] = useState<SessionRun | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  // FR6 Door 1 ("extra Learn", v3-D98) — the offer this DONE session's own
  // fold makes for one more gate-intact, cost-disclosed ayah. Computed only
  // once the summary is reached (see the effect below); null before that, and
  // reset the moment the learner either extends into it or finishes it.
  const [extraOffer, setExtraOffer] = useState<ExtraLearnGrant | null>(null);
  // FR6 Door 2 ("weak-spot gym", v3-D106) — the weakest carried atom this
  // DONE session's own fold ranks highest-risk, offered as an extra REVIEW
  // rep. Same lifecycle as `extraOffer`: computed only once the summary is
  // reached, null before that and reset the moment the learner acts on it.
  const [weakSpotOffer, setWeakSpotOffer] = useState<WeakSpot | null>(null);
  // v3-D107 — the gate forgiveness ladder's demote offer (v2-D08): once the
  // CURRENT queue item is a due cold gate the engine has decided has failed
  // DEMOTE_OFFER_AFTER_FAILS times running, this replaces the quiz card with
  // "send this verse back to Learn" — tap-gated, never automatic. Null
  // whenever `demoteOfferFor` says there is nothing to offer, INCLUDING the
  // ayah the learner just chose "try the gate anyway" for this session
  // (`dismissedDemoteAyah`), so declining does not re-ask on every render.
  const [demoteOffer, setDemoteOffer] = useState<{ ayah: number } | null>(null);
  const [dismissedDemoteAyah, setDismissedDemoteAyah] = useState<number | null>(null);

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

  // Run one commit-producing action (a fresh tap, or a retried
  // `SessionCommitFailure.resume()`) and paint whatever it settles into. A
  // RETRYABLE failure (edge case #74 — e.g. QuotaExceeded on a tap write)
  // gets a `retry` the learner can act on, wired straight to `resume()` —
  // never to re-invoking `answerCurrent`, which would re-append an
  // already-landed tap under a fresh id (see `SessionCommitFailure`'s own
  // header). Any OTHER error is not retryable this way and keeps the plain
  // message the learner previously saw.
  const commit = useCallback((action: () => Promise<SessionRun>) => {
    setBusy(true);
    void (async () => {
      // COMMIT BEFORE PAINT: this await is the invariant. Neither a fresh
      // `answerCurrent` nor a resumed retry resolves until the event is
      // durable.
      try {
        const next = await action();
        setRun(next);
        // Escape a prior "failed" phase now that the commit landed — the
        // quiz card only renders once phase is no longer one of the named
        // states, so a successful retry must clear it explicitly.
        setPhase((p) => (p.kind === "failed" ? { kind: "drilling" } : p));

        if (next.done) {
          const summary = await sessionSummaryOf(next);
          setPhase({ kind: "summary", summary });
        }
      } catch (err) {
        // A failed COMMIT must never paint a verdict (invariant #2). Losing
        // the write lock mid-session is the real case: the tap did not land,
        // so the learner is told rather than shown a grade with no event.
        if (err instanceof SessionCommitFailure) {
          setPhase({
            kind: "failed",
            message: err.message,
            retry: () => commit(() => err.resume()),
          });
        } else {
          setPhase({
            kind: "failed",
            message:
              err instanceof Error ? err.message : "That tap could not be saved.",
          });
        }
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const onAnswer = useCallback(
    (index: number) => {
      if (!run || !corpus || busy) return;
      // Ignore taps while a verdict is showing: the learner must acknowledge
      // before the next blank, and a double-tap must never double-append.
      if (run.lastTap) return;

      commit(() =>
        answerCurrent(run, corpus, index, { now: Date.now(), tz: currentTz() }),
      );
    },
    [run, corpus, busy, commit],
  );

  const onContinue = useCallback(() => {
    setRun((r) => (r ? clearReveal(r) : r));
  }, []);

  // FR6 Door 1 — once the assembled queue is genuinely done, ask the engine
  // (via `extraLearnOfferFor`, which re-derives the fold — never this
  // component deciding anything) whether one more gate-intact ayah is on
  // offer. A fetch failure here must never block the summary the learner
  // already earned — same "cache warm, never a precondition" discipline the
  // entitlement snapshot effect above uses (#103).
  useEffect(() => {
    if (phase.kind !== "summary" || !run || !corpus) return;
    let alive = true;
    void extraLearnOfferFor(run, corpus, Date.now())
      .then((offer) => {
        if (alive) setExtraOffer(offer);
      })
      .catch(() => {
        if (alive) setExtraOffer(null);
      });
    return () => {
      alive = false;
    };
  }, [phase, run, corpus]);

  const onExtraLearn = useCallback(() => {
    if (!run || !corpus || !extraOffer?.granted || extraOffer.ayah === null) return;
    const extended = startExtraLearn(run, corpus, extraOffer.ayah);
    setExtraOffer(null);
    setRun(extended);
    setPhase({ kind: "drilling" });
  }, [run, corpus, extraOffer]);

  // FR6 Door 2 — once the assembled queue is genuinely done, ask the engine
  // (via `weakSpotOfferFor`, which re-derives the fold — never this
  // component ranking risk itself) which carried atom is weakest right now.
  // Same "never blocks the summary" discipline as Door 1's effect above.
  useEffect(() => {
    if (phase.kind !== "summary" || !run) return;
    let alive = true;
    void weakSpotOfferFor(run, Date.now())
      .then((offer) => {
        if (alive) setWeakSpotOffer(offer);
      })
      .catch(() => {
        if (alive) setWeakSpotOffer(null);
      });
    return () => {
      alive = false;
    };
  }, [phase, run]);

  const onPracticeWeakSpot = useCallback(() => {
    if (!run || !corpus || !weakSpotOffer) return;
    const ayah = weakSpotOffer.ref;
    setWeakSpotOffer(null);
    void startWeakSpotDrill(run, corpus, ayah).then((extended) => {
      setRun(extended);
      setPhase({ kind: "drilling" });
    });
  }, [run, corpus, weakSpotOffer]);

  // v3-D107 — ask the engine (via `demoteOfferFor`, which re-derives the
  // fold — never this component reading `gateFails` itself, which clause 5
  // would refuse to let it do) whether the CURRENT queue item is a due gate
  // the ladder says to offer demoting. Re-checked whenever `run` changes
  // (every tap, every advance to a new queue item), so a later gate item in
  // the same session gets its own independent offer.
  useEffect(() => {
    if (phase.kind !== "drilling" || !run) {
      setDemoteOffer(null);
      return;
    }
    let alive = true;
    void demoteOfferFor(run)
      .then((offer) => {
        if (!alive) return;
        setDemoteOffer(offer && offer.ayah === dismissedDemoteAyah ? null : offer);
      })
      .catch(() => {
        if (alive) setDemoteOffer(null);
      });
    return () => {
      alive = false;
    };
  }, [phase, run, dismissedDemoteAyah]);

  const onAcceptDemote = useCallback(() => {
    if (!run || !corpus || !demoteOffer) return;
    setDemoteOffer(null);
    commit(() =>
      acceptGateDemote(run, corpus, { now: Date.now(), tz: currentTz() }),
    );
  }, [run, corpus, demoteOffer, commit]);

  const onDismissDemote = useCallback(() => {
    if (!demoteOffer) return;
    setDismissedDemoteAyah(demoteOffer.ayah);
    setDemoteOffer(null);
  }, [demoteOffer]);

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
      <div className="stack">
        <p className="caption" role="alert">
          {phase.message}
        </p>
        {phase.retry ? (
          <button type="button" className="btn" onClick={phase.retry}>
            Retry
          </button>
        ) : null}
      </div>
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
        {/* FR6 Door 1: only ever shown once the engine itself grants it — this
            component never decides whether one more ayah fits the gate. */}
        {extraOffer?.granted && extraOffer.ayah !== null ? (
          <button type="button" className="btn" onClick={onExtraLearn}>
            Learn one more ayah (~{extraOffer.costMin} min)
          </button>
        ) : null}
        {/* FR6 Door 2: only ever shown once the engine itself ranks a weak
            spot — this component never decides which atom is weakest. */}
        {weakSpotOffer ? (
          <button type="button" className="btn" onClick={onPracticeWeakSpot}>
            Practice your weakest spot (ayah {weakSpotOffer.ref})
          </button>
        ) : null}
      </div>
    );
  }

  // v3-D107 — shown INSTEAD of the quiz card: a learner offered this must
  // never be shown a cold-gate reconstruction bank for an ayah the engine has
  // already decided to offer sending back to Learn. Mirrors v2's own
  // `Gate.tsx` `stage === "demote-offer"` wording and two-button shape.
  if (phase.kind === "drilling" && demoteOffer) {
    return (
      <div className="stack" data-testid="session-gate-demote-offer">
        <p className="caption" role="alert">
          This verse has failed its cold gate several times.
        </p>
        <p className="caption">
          You can send it back to Learn — it will be re-taught, not abandoned.
        </p>
        <button type="button" className="btn" onClick={onAcceptDemote}>
          Send it back to Learn
        </button>
        <button type="button" className="btn btn--ghost" onClick={onDismissDemote}>
          Try the gate anyway
        </button>
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
