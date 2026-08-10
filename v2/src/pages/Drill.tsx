// v2 Phase 1 (v2-D05, v2-D23) — the core drill: tap-to-reconstruct against real
// corpus data, emitting real recall events (invariant #2: every tap commits to the
// append-only log BEFORE any UI feedback).
//
// Two modes (v2-D64):
//  • SESSION  (`?session=1`) — driven by the structured session queue (useSession):
//    drills the current queue item, and on ayah_produced advances to the next item;
//    when the queue empties it lands on the calm SessionComplete screen (an ENDING,
//    not an infinite loop — the v1 "when does this stop?" gap fixed). Only the
//    structured session mutates lifecycle state (invariant #4).
//  • FREE     (no `session`) — the learner picks one ayah via prev/next; no ending,
//    no queue. Kept for the "Free drill (pick an ayah)" affordance on Home.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Corpus, ReconstructState, Rung } from "engine";
import {
  advanceReconstruct,
  atomKey,
  bandOf,
  completedDayIndices,
  computeStreak,
  formatDuration,
  initReconstruct,
  makeEvent,
  nextReconstructItem,
  summarizeSession,
  type DrillEvent,
  type SessionSummary,
} from "engine";
import { loadEffectiveCorpus } from "../corpus/loadEffectiveCorpus.ts";
import { useSession } from "../session/useSession.ts";
import { append, getAll } from "../db/eventLog.ts";
import { rebuildAtoms } from "../db/atoms.ts";

const SURAH = 12; // v2 ships Yusuf only (v2-D29); the loader itself takes surah as a param.

// useSession requires a Corpus and hooks can't be conditional, so before the real
// corpus resolves we hand it this inert one (ayahCount 0 → an empty queue). The
// session_start / finish effects are all gated on the real `corpus` state, so this
// placeholder never triggers a premature completion.
const EMPTY_CORPUS: Corpus = {
  meta: { surah: SURAH, ayahCount: 0, wordCount: 0 },
  verses: [],
  words: [],
  distractors: [],
};

interface Completion {
  full: boolean;
  before: number;
  after: number;
}

/** Fisher-Yates. Display-order shuffle only — the engine's option set is stable
 *  and deterministic (v2-D23/Appendix A: "the UI shuffles display order only"). */
function shuffled(items: string[]): string[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function Drill() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  // Session mode is opted into by the `?session=1` flag the Home "Start" button sets.
  const inSession = params.get("session") === "1";

  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rc, setRc] = useState<ReconstructState | null>(null);
  const [feedback, setFeedback] = useState<{ tile: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [strengthBefore, setStrengthBefore] = useState(0);
  // Session bookkeeping: the summary shown when the queue drains, and a guard so we
  // only stamp one session_start per visit (its ts anchors summarizeSession's clock).
  const [sessionDone, setSessionDone] = useState<SessionSummary | null>(null);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [startedSession, setStartedSession] = useState(false);
  // Ayat already produced THIS session. The engine may re-surface a just-completed
  // ayah (same-day review as its strength settles) — but for session semantics
  // "I've done that one today," so we skip past it and end when only such items
  // remain. A Set, so re-entry after a produce is idempotent.
  const [doneThisSession] = useState<Set<number>>(() => new Set());
  // Bumped on every advance so the reconstruct-pass effect re-runs even when the
  // next queue item is the SAME ayah number (a stale completed `rc` would otherwise
  // leave the screen bankless — the dead-end this guards against).
  const [passNonce, setPassNonce] = useState(0);

  useEffect(() => {
    loadEffectiveCorpus(SURAH)
      .then((r) => setCorpus(r.corpus))
      .catch((e: unknown) => setError(String(e)));
  }, []);

  // The structured queue (invariant #4: only this drives lifecycle). Harmless in
  // free mode — we simply ignore it and read the ayah from the URL instead.
  const session = useSession(corpus ?? EMPTY_CORPUS);
  // The head of the queue that we haven't already produced this session — the actual
  // next thing to drill (see doneThisSession).
  const queueCurrent = useMemo(
    () => session.queue.find((i) => !doneThisSession.has(i.ayah)) ?? null,
    [session.queue, doneThisSession],
  );

  // In session mode the ayah to drill is the fresh queue head; in free mode, the URL.
  const ayah = inSession ? (queueCurrent?.ayah ?? Number(params.get("ayah") ?? "1")) : Number(params.get("ayah") ?? "1");

  // Stamp exactly one session_start when a session begins, so the completion screen's
  // duration/greeting have a real anchor (summarizeSession slices from this event).
  useEffect(() => {
    if (!inSession || startedSession || !corpus || session.loading) return;
    setStartedSession(true);
    void append(makeEvent({ type: "session_start", ts: Date.now(), surah: SURAH, ayah, rung: "S1" }));
  }, [inSession, startedSession, corpus, session.loading, ayah]);

  // The session is over when the queue head is empty OR only re-serves ayat already
  // produced this session (nothing genuinely new left to do today).
  const noFreshWork = !queueCurrent || doneThisSession.has(queueCurrent.ayah);

  // Fire completion when the session opens with nothing fresh to do (caught-up day).
  useEffect(() => {
    if (!inSession || session.loading || sessionDone || !startedSession) return;
    if (noFreshWork) void finishSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSession, session.loading, noFreshWork, startedSession]);

  // Roll up this session's events (from the last session_start) into the summary +
  // current streak, then flip to the SessionComplete screen. Pure engine does the math.
  const finishSession = useCallback(async () => {
    const events = (await getAll()) as DrillEvent[];
    const lastStart = events.map((e, i) => (e.type === "session_start" ? i : -1)).filter((i) => i >= 0).pop() ?? 0;
    const summary = summarizeSession(events.slice(lastStart));
    const streak = computeStreak(completedDayIndices(events), Date.now());
    setSessionStreak(streak.length);
    setSessionDone(summary);
  }, []);

  // Advance to the next queue item after producing an ayah in session mode: re-plan
  // from the freshly-written log, then either drill the next FRESH item or finish.
  // The engine may keep the just-completed ayah at the head (same-day review as its
  // strength settles); doneThisSession lets us step over those so the session ends
  // instead of looping on one ayah.
  const advanceSession = useCallback(async () => {
    const q = await session.refresh();
    const next = q.find((i) => !doneThisSession.has(i.ayah));
    if (!next) {
      await finishSession();
    } else {
      // Re-arm the drill for the next item; the nonce forces a fresh reconstruct
      // pass even if `next.ayah` equals the previous ayah number.
      setCompletion(null);
      setPassNonce((n) => n + 1);
    }
  }, [session, finishSession, doneThisSession]);

  // A queue item that isn't a plain drill (a cold gate / make-up) routes to /gate,
  // staying in session mode so it returns to the queue afterward.
  const nonDrillNext =
    inSession && queueCurrent && (queueCurrent.kind === "gate" || queueCurrent.kind === "makeup")
      ? queueCurrent
      : null;
  useEffect(() => {
    if (nonDrillNext && !sessionDone) {
      navigate(`/gate?ayah=${nonDrillNext.ayah}&session=1`, { replace: true });
    }
  }, [nonDrillNext, sessionDone, navigate]);

  // (Re)start a pass over `ayah` when the corpus loads, the ayah changes, or the
  // session advances (passNonce) — the last forces a fresh pass even onto the SAME
  // ayah, so a re-served item never leaves a stale completed `rc` (the dead-end bug).
  useEffect(() => {
    if (!corpus) return;
    let cancelled = false;
    setCompletion(null);
    setFeedback(null);
    rebuildAtoms().then((atoms) => {
      if (cancelled) return;
      const strength = atoms.get(atomKey("ayah", ayah))?.strength ?? 0;
      setStrengthBefore(strength);
      setRc(initReconstruct(corpus, SURAH, ayah, strength));
    });
    return () => {
      cancelled = true;
    };
  }, [corpus, ayah, passNonce]);

  const item = useMemo(() => {
    if (!corpus || !rc) return null;
    const next = nextReconstructItem(rc, corpus);
    return "done" in next ? null : next;
  }, [corpus, rc]);

  const tiles = useMemo(() => (item ? shuffled(item.options) : []), [item]);

  async function handleTap(tile: string) {
    if (!corpus || !rc || !item || busy) return;
    setBusy(true);
    const correct = tile === item.correct;
    const rung: Rung = item.full ? "S3" : "S2";
    // Invariant #2: commit to the append-only log BEFORE any UI feedback.
    await append(
      makeEvent({
        type: "reconstruct_tap",
        ts: Date.now(),
        surah: SURAH,
        ayah,
        rung,
        position: item.currentBlank,
        choice: tile,
        correct,
        structured: true,
      }),
    );
    setFeedback({ tile, ok: correct });

    if (!correct) {
      setTimeout(() => {
        setFeedback(null);
        setBusy(false);
      }, 450);
      return;
    }

    const adv = advanceReconstruct(rc, corpus, tile);
    if (adv.ayahProduced) {
      const gradeRung: Rung = adv.full ? "S3" : "S2";
      await append(
        makeEvent({ type: "ayah_produced", ts: Date.now(), surah: SURAH, ayah, rung: gradeRung, structured: true }),
      );
      // Mark this ayah done for the session so advance steps past a same-day re-serve.
      if (inSession) doneThisSession.add(ayah);
      const atoms = await rebuildAtoms();
      const after = atoms.get(atomKey("ayah", ayah))?.strength ?? 0;
      setTimeout(() => {
        setFeedback(null);
        setRc(adv.state);
        setCompletion({ full: adv.full!, before: strengthBefore, after });
        setBusy(false);
      }, 450);
      return;
    }

    setTimeout(() => {
      setFeedback(null);
      setRc(adv.state);
      setBusy(false);
    }, 350);
  }

  function goTo(nextAyah: number) {
    if (!corpus) return;
    const bounded = Math.min(Math.max(1, nextAyah), corpus.meta.ayahCount);
    setParams({ ayah: String(bounded) });
  }

  if (error) {
    return (
      <div className="screen">
        <div className="banner banner--warn">
          <p>Corpus failed to load: {error}</p>
        </div>
      </div>
    );
  }

  // The ending (v2-D64). Calm close, facts not fanfare, no guilt copy — the queue is
  // empty, so there's genuinely nothing left to do today.
  if (sessionDone) {
    return <SessionComplete summary={sessionDone} streak={sessionStreak} onHome={() => navigate("/")} />;
  }

  if (!corpus || !rc) {
    return (
      <div className="screen">
        <p className="voice">Loading…</p>
      </div>
    );
  }

  const band = bandOf(strengthBefore);

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>
            Surah {SURAH}:{ayah} · reconstruct · {band}
          </span>
          {item && (
            <span>
              blank {item.index} / {item.total}
            </span>
          )}
        </div>

        <div className="ayah">
          {rc.words.map((w, i) => {
            const blankIdx = rc.blankPositions.indexOf(w.position);
            if (blankIdx === -1) {
              return <span key={w.position}>{w.text_uthmani}{i < rc.words.length - 1 ? " " : ""}</span>;
            }
            const filled = blankIdx < rc.blankIndex;
            const isCurrent = item?.currentBlank === w.position;
            const cls = ["gap-slot", filled ? "is-filled" : "", isCurrent ? "is-current" : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <span key={w.position} className={cls}>
                {filled ? w.text_uthmani : "   "}
                {i < rc.words.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>

        {completion ? (
          <div className="banner banner--ok">
            <p>
              {completion.full ? "Whole ayah produced." : "Reconstruction complete."} Strength{" "}
              {Math.round(completion.before)} → {Math.round(completion.after)}.
            </p>
            <p className="sub">reconstruct_tap + ayah_produced logged to the append-only event log.</p>
            {inSession ? (
              // The exact next step (another item vs. the completion screen) is
              // decided inside advanceSession after it re-plans the queue.
              <button className="btn btn--primary" disabled={busy} onClick={() => void advanceSession()}>
                Continue →
              </button>
            ) : (
              <Link className="btn btn--primary" to="/">
                ← Back to session
              </Link>
            )}
          </div>
        ) : (
          item && (
            <div className="bank">
              {tiles.map((tile) => {
                const isFeedback = feedback?.tile === tile;
                const cls = ["tile", isFeedback ? (feedback!.ok ? "is-ok" : "is-err") : ""]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button key={tile} className={cls} disabled={busy} onClick={() => handleTap(tile)}>
                    {tile}
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* Free mode lets the learner hand-pick an ayah; in a session the scheduler
            owns ayah selection, so prev/next would break the queue's ordering. */}
        {!inSession && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn" onClick={() => goTo(ayah - 1)} disabled={ayah <= 1}>
              ← Prev ayah
            </button>
            <button className="btn" onClick={() => goTo(ayah + 1)} disabled={ayah >= corpus.meta.ayahCount}>
              Next ayah →
            </button>
          </div>
        )}
        <p>
          <Link className="btn btn--ghost" to="/">
            {inSession ? "Pause — leave session" : "← Home"}
          </Link>
        </p>
      </div>
    </div>
  );
}

const GREETING_LINE: Record<SessionSummary["greeting"], string> = {
  morning: "That's your morning with Yūsuf.",
  afternoon: "That's your afternoon with Yūsuf.",
  evening: "That's your evening with Yūsuf.",
  night: "That's your time with Yūsuf tonight.",
};

/** The session-end screen (v2-D64). Calm and final: facts, not fanfare — no guilt
 *  copy, no "keep going" pressure. Built only from iman-ui.css primitives (invariant
 *  #5); all arithmetic came from the engine's summarizeSession (invariant #6). */
function SessionComplete({
  summary,
  streak,
  onHome,
}: {
  summary: SessionSummary;
  streak: number;
  onHome: () => void;
}) {
  const done = summary.ayatCompleted;
  const recallPct = summary.recall === null ? null : Math.round(summary.recall * 100);
  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>Session complete</span>
          <span>{formatDuration(summary.durationMs)}</span>
        </div>

        <p className="voice">
          {done === 0
            ? "Nothing was due — you're caught up."
            : `${GREETING_LINE[summary.greeting]} ${done} ${done === 1 ? "ayah" : "ayat"} today.`}
        </p>

        <div className="banner banner--ok">
          {done > 0 && (
            <p>
              Completed 12:{summary.ayatRefs.join(", 12:")}
              {recallPct !== null ? ` · ${recallPct}% recall` : ""}
            </p>
          )}
          {streak > 0 && <p className="sub">{streak}-day streak — quietly kept.</p>}
          {done === 0 && streak === 0 && <p className="sub">Come back tomorrow and the queue fills again.</p>}
        </div>

        <button className="btn btn--primary" onClick={onHome}>
          Done for today
        </button>
      </div>
    </div>
  );
}
