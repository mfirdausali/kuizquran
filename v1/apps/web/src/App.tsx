import { useEffect, useState } from "react";
import type { ChainStepResult, Corpus } from "engine";
import { bridgeItems, makeEvent } from "engine";
import { useLadder } from "./session/useLadder.ts";
import { useSession } from "./session/useSession.ts";
import { append } from "./db/eventLog.ts";
import { S1Meaning } from "./drills/S1Meaning.tsx";
import { S2Fill } from "./drills/S2Fill.tsx";
import { S3WholeBank } from "./drills/S3WholeBank.tsx";
import { S4Bridge } from "./drills/S4Bridge.tsx";
import { ChainDrill } from "./drills/ChainDrill.tsx";
import { SignIn } from "./components/SignIn.tsx";
import { flush, hydrate } from "./sync/outbox.ts";
import { useOnboarding } from "./onboarding/useOnboarding.ts";
import { Placement } from "./onboarding/Placement.tsx";
import { Doors } from "./practice/Doors.tsx";
import { OpenPractice } from "./practice/OpenPractice.tsx";
import { Home } from "./home/Home.tsx";
import { Anchor, loadAnchor } from "./habit/Anchor.tsx";
import { Streak } from "./habit/Streak.tsx";
import { Heatmap } from "./habit/Heatmap.tsx";
import { FloorSession } from "./habit/FloorSession.tsx";
import { InstallPrompt } from "./habit/InstallPrompt.tsx";
import { computeStreak, learningDayIndex, summarizeSession, formatDuration, type AtomsMap, type DrillEvent, type StreakState } from "engine";
import { getAll } from "./db/eventLog.ts";
import { celebrate } from "./session/celebration.ts";
import { useAuth } from "./session/useAuth.ts";

const SURAH = 12;
type Phase = "ladder" | "bridge" | "chain" | "done";

export function App() {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Restore signed-in state from the session cookie on load (no re-prompt on reload).
  const auth = useAuth();
  const signedInEmail = auth.email;
  const setSignedInEmail = auth.setEmail;

  useEffect(() => {
    fetch("/corpus.json")
      .then((r) => {
        if (!r.ok) throw new Error(`corpus ${r.status}`);
        return r.json();
      })
      .then((c: Corpus) => setCorpus(c))
      .catch((e) => setErr(String(e)));
  }, []);

  // Bumped when a hydrate pull adds server events locally → forces the session to
  // remount and re-plan from the reconciled log (so a fresh device shows real
  // progress instead of 0/111).
  const [hydrateVersion, setHydrateVersion] = useState(0);

  // Background sync: once signed in, (1) HYDRATE — pull the account's history down
  // so a fresh device reflects it; (2) FLUSH unsynced local events up. Both on
  // load + when the tab comes online / regains focus. Local commit is unaffected
  // (invariant #2); sync is purely additive (idempotent by event id).
  useEffect(() => {
    if (!signedInEmail) return;
    const doSync = async () => {
      const added = await hydrate(true);
      if (added > 0) setHydrateVersion((v) => v + 1);
      await flush(true);
    };
    void doSync();
    const onEvent = () => void doSync();
    window.addEventListener("online", onEvent);
    window.addEventListener("focus", onEvent);
    return () => {
      window.removeEventListener("online", onEvent);
      window.removeEventListener("focus", onEvent);
    };
  }, [signedInEmail]);

  // Streak (FR9): completed-session learning-days from the event log.
  const [streak, setStreak] = useState<StreakState | null>(null);
  useEffect(() => {
    void getAll().then((events) => {
      const days = new Set<number>();
      for (const e of events) {
        if (e.type === "ayah_complete" || e.type === "rung_complete" || e.type === "gate_result") {
          days.add(learningDayIndex(e.ts));
        }
      }
      setStreak(computeStreak(days, Date.now()));
    });
  }, []);

  if (err) {
    return (
      <div className="screen">
        <div className="card">
          <p className="caption">Could not load the corpus: {err}</p>
        </div>
      </div>
    );
  }
  if (!corpus) {
    return (
      <div className="screen">
        <div className="card">
          <p className="caption">Loading…</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="screen" style={{ paddingBottom: 0 }}>
        <div className="card-header">
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            iman · Yusuf {streak && <Streak streak={streak} />}
          </span>
          {signedInEmail ? (
            <span className="pill-streak">synced · {signedInEmail}</span>
          ) : (
            <SignIn onSignedIn={setSignedInEmail} />
          )}
        </div>
        <InstallPrompt />
      </div>
      <Gate key={hydrateVersion} corpus={corpus} returning={auth.hasHistory} authLoading={auth.loading} />
    </div>
  );
}

// Onboarding gate: first run → placement → anchor (FR9); else the session. A
// signed-in returning user (server-side history) skips onboarding entirely and
// does NOT depend on the local event-log read (which can be slow/blocked).
function Gate({
  corpus,
  returning,
  authLoading,
}: {
  corpus: Corpus;
  returning: boolean;
  authLoading: boolean;
}) {
  // Wait only on the (fast, server-backed) auth check.
  if (authLoading) {
    return (
      <div className="screen">
        <div className="card">
          <p className="caption">Loading…</p>
        </div>
      </div>
    );
  }
  // Returning signed-in user → straight to the session (no local IDB dependency).
  if (returning) {
    return <Session corpus={corpus} />;
  }
  return <NewUserGate corpus={corpus} />;
}

// The onboarding path for a genuinely new user (first run, not returning).
function NewUserGate({ corpus }: { corpus: Corpus }) {
  const { status, placement, completePlacement } = useOnboarding();
  const [anchorHour, setAnchorHour] = useState<number | null>(loadAnchor());

  if (status === "loading") {
    return (
      <div className="screen">
        <div className="card">
          <p className="caption">Loading…</p>
        </div>
      </div>
    );
  }
  if (status === "needs-placement") {
    return <Placement corpus={corpus} onDone={completePlacement} />;
  }
  if (anchorHour === null) {
    return <Anchor onDone={(h) => setAnchorHour(h)} />;
  }
  return <Session corpus={corpus} learnCandidates={placement?.carriedAyat} startAyah={placement?.startAyah} />;
}

type View = "home" | "session" | "complete" | "gym" | "open" | "floor" | "heatmap";

function Session({
  corpus,
  startAyah,
}: {
  corpus: Corpus;
  learnCandidates?: number[];
  startAyah?: number;
}) {
  const session = useSession(corpus, undefined, startAyah);
  // Home base is the landing view; training screens launch from it and return to it.
  const [view, setView] = useState<View>("home");
  // The last ayah carried this session — the hero of the completion screen.
  const [lastAyah, setLastAyah] = useState<number | null>(null);

  // Streak for the dashboard header (completed-session learning-days).
  const [streak, setStreak] = useState<StreakState | null>(null);
  useEffect(() => {
    void getAll().then((events) => {
      const days = new Set<number>();
      for (const e of events) {
        if (e.type === "ayah_complete" || e.type === "rung_complete" || e.type === "gate_result") {
          days.add(learningDayIndex(e.ts));
        }
      }
      setStreak(computeStreak(days, Date.now()));
    });
  }, [session.atoms]);

  if (session.loading) {
    return (
      <div className="screen">
        <div className="card">
          <p className="caption">Planning your day…</p>
        </div>
      </div>
    );
  }

  const home = () => setView("home");

  // ── Training screens (each returns to home; only "session" mutates lifecycle) ──
  if (view === "heatmap") {
    return <Heatmap corpus={corpus} atoms={session.atoms} onClose={home} />;
  }
  if (view === "floor") {
    return <FloorSession corpus={corpus} atoms={session.atoms} onClose={home} />;
  }
  if (view === "open") {
    return <OpenPractice corpus={corpus} onClose={home} />;
  }
  if (view === "gym") {
    // Weak-spot gym = the free-practice doors (extra Learn / gym / open practice).
    return (
      <Doors
        corpus={corpus}
        atoms={session.atoms}
        learnCandidates={session.candidates}
        wordCounts={session.wordCounts}
        onClose={home}
      />
    );
  }
  if (view === "complete") {
    return (
      <SessionComplete
        corpus={corpus}
        lastAyah={lastAyah}
        streak={streak}
        onDone={() => {
          setLastAyah(null);
          home();
        }}
      />
    );
  }
  if (view === "session") {
    const target = session.current;
    if (!target) return <HomeScreen />; // queue drained mid-session → back home
    // Leave the session at any point (ladder / bridge / chain). If anything was
    // completed today, land on the summary for closure; otherwise straight home.
    const endSession = () => {
      const encodedToday = [...session.atoms.values()].some((a) => a.kind === "ayah" && a.encoded);
      if (encodedToday) {
        setLastAyah((prev) => prev ?? target.ayah);
        setView("complete");
      } else {
        home();
      }
    };
    return (
      <>
        {/* Always-available escape from the session, at every sub-phase (ladder /
            bridge / chain). Sits above the drill card, matching .screen centering
            (no double .screen wrap). The drill was "heavily continuous" — this is
            the way out. */}
        <div
          style={{
            maxWidth: 420,
            margin: "0 auto 8px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            className="btn btn--ghost"
            style={{ width: "auto", padding: "6px 12px", fontSize: 13 }}
            onClick={endSession}
          >
            End session
          </button>
        </div>
        {/* Key by ayah so advancing REMOUNTS the ladder with fresh state. */}
        <LadderScreen
          key={target.ayah}
          corpus={corpus}
          ayah={target.ayah}
          onComplete={async () => {
            const finished = target.ayah;
            // Branch on the FRESH queue the re-plan returns — never the stale
            // `session.queue` closed over by this render (that's the old bug).
            const nextQueue = await session.completeCurrent();
            if (nextQueue.length === 0) {
              // Whole day's session done → land on the completion screen (once).
              setLastAyah(finished);
              setView("complete");
            }
            // else: session.current flips to the next item; LadderScreen remounts.
          }}
          onTap={session.touch}
        />
      </>
    );
  }

  // ── Home base ──
  function HomeScreen() {
    return (
      <Home
        corpus={corpus}
        atoms={session.atoms}
        queue={session.queue}
        current={session.current}
        streak={streak}
        onSelect={(v) => setView(v)}
      />
    );
  }
  return <HomeScreen />;
}

// Session-complete screen (FR9 + D38): a rewarding Duolingo-style close when the
// day's structured session is done — a big animated streak flame, a stat row
// (duration · recall · ayat), the meter sweep, and a confetti + chime burst.
// D38 (decisions.md) carves THIS screen out of the calm-only reading of invariant
// #5 by explicit product decision. Still binding here: the Amiri ayah stays the
// largest type; whole-ayah tally only (#1); recall arithmetic lives in the engine
// summarizeSession helper (#6); and NO guilt copy — a paused/at-risk streak reads
// neutral, never punished. Effects self-disable under prefers-reduced-motion.
function SessionComplete({
  corpus,
  lastAyah,
  streak,
  onDone,
}: {
  corpus: Corpus;
  lastAyah: number | null;
  streak: StreakState | null;
  onDone: () => void;
}) {
  const verse = lastAyah != null ? corpus.verses.find((v) => v.ayah === lastAyah) : undefined;

  // Load this session's events (from the most recent session_start onward) and
  // summarize them — duration, recall, ayat — via the pure engine helper.
  const [summary, setSummary] = useState<ReturnType<typeof summarizeSession> | null>(null);
  useEffect(() => {
    void getAll().then((events) => {
      const evs = events as DrillEvent[];
      let startIdx = 0;
      for (let i = evs.length - 1; i >= 0; i--) {
        if (evs[i]!.type === "session_start") {
          startIdx = i;
          break;
        }
      }
      setSummary(summarizeSession(evs.slice(startIdx)));
    });
  }, []);

  // Recall drives the meter sweep. Render at 0, then set to the value on mount so
  // the CSS .7s transition runs exactly once (D38 celebration + calm reward).
  const recallPct = summary?.recall != null ? Math.round(summary.recall * 100) : null;
  const [fillW, setFillW] = useState(0);
  useEffect(() => {
    if (recallPct == null) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setFillW(recallPct)));
    return () => cancelAnimationFrame(id);
  }, [recallPct]);

  // Fire the celebration (confetti + chime) once, when the summary is ready.
  const firedRef = useState(() => ({ done: false }))[0];
  useEffect(() => {
    if (!summary || firedRef.done) return;
    firedRef.done = true;
    const cleanup = celebrate();
    return cleanup;
  }, [summary, firedRef]);

  const greetingWord =
    summary?.greeting === "morning"
      ? "this morning"
      : summary?.greeting === "afternoon"
        ? "this afternoon"
        : summary?.greeting === "night"
          ? "tonight"
          : "this evening";

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>Today&apos;s session</span>
          <span>complete</span>
        </div>

        {/* Prominent streak — the flame, animated (D38 carve-out). */}
        {streak && streak.length > 0 && <StreakBig streak={streak} />}

        {/* The ayah hero — largest type (invariant #5 holds even here). */}
        {verse && (
          <>
            <p className="caption" style={{ textAlign: "center" }}>Last ayah you carried</p>
            <div className="ayah ayah--display">{verse.text_uthmani}</div>
            <p className="caption" style={{ textAlign: "center" }}>Yusuf · 12:{lastAyah}</p>
          </>
        )}

        <hr style={{ height: 0, border: 0, borderTop: "0.5px solid var(--border)", margin: "2px 0" }} />

        {/* Stat row — duration · recall · ayat. */}
        <div style={{ display: "flex", gap: 12 }}>
          <Stat value={summary ? formatDuration(summary.durationMs) : "—"} label="Duration" />
          <Stat value={recallPct != null ? `${recallPct}%` : "—"} label="Recall" />
          <Stat value={summary ? String(summary.ayatCompleted) : "—"} label="Ayat" />
        </div>

        {/* The meter reward — sweeps to recall. */}
        <div className="meter">
          <div style={{ width: `${fillW}%` }} />
        </div>
        <p className="caption" style={{ textAlign: "center" }}>
          Recalled cleanly {greetingWord}
        </p>

        <p className="voice" style={{ textAlign: "center" }}>
          You held what you set out to hold.
        </p>

        <button className="btn btn--primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

// One stat column in the session-end row (tabular numerals, held below the ayah).
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{value}</div>
      <div
        className="caption"
        style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3 }}
      >
        {label}
      </div>
    </div>
  );
}

// The prominent, animated streak for the session-end screen (D38: this screen is
// exempt from the calm-streak reading of invariant #5). A large flame + count that
// scales in on mount. NO guilt on a paused/at-risk streak — those read as neutral.
function StreakBig({ streak }: { streak: StreakState }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const note = streak.atRisk
    ? "today's session keeps it going"
    : streak.pausedOnMiss
      ? streak.makeupAvailable
        ? "a make-up today restores it"
        : "resting — pick it back up"
      : `${streak.length === 1 ? "day" : "days"} in a row`;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "6px 0 2px",
        transform: shown ? "scale(1)" : "scale(0.6)",
        opacity: shown ? 1 : 0,
        transition: "transform .45s cubic-bezier(.2,1.3,.4,1), opacity .35s ease",
      }}
    >
      <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden="true">🔥</div>
      <div
        style={{
          fontSize: 34,
          fontVariantNumeric: "tabular-nums",
          color: "var(--amber-600)",
          lineHeight: 1.1,
          fontWeight: 600,
        }}
      >
        {streak.length}
      </div>
      <div className="caption">{note}</div>
    </div>
  );
}

function LadderScreen({
  corpus,
  ayah,
  onComplete,
  onTap,
}: {
  corpus: Corpus;
  ayah: number;
  onComplete: () => void;
  onTap: () => void;
}) {
  const { item, feedback, committing, submit, proceed, ayahComplete } = useLadder(
    corpus,
    SURAH,
    ayah,
  );
  const [phase, setPhase] = useState<Phase>("ladder");
  const [finishing, setFinishing] = useState(false); // latch: guard double-tap of "Done for now"
  const hasNext = corpus.verses.some((v) => v.ayah === ayah + 1);

  // Keep the gap clock fresh on every tap (start-stop resume classification).
  const submitAndTouch = (choice: string) => {
    onTap();
    return submit(choice);
  };

  // ---- S4 bridge phase: introduce 12:(ayah+1)'s opening; birth the connection ----
  const ladderDone = ayahComplete || "done" in item;
  useEffect(() => {
    if (ladderDone && phase === "ladder") setPhase(hasNext ? "bridge" : "done");
  }, [ladderDone, phase, hasNext]);

  if (phase === "bridge" && hasNext) {
    return (
      <BridgePhase
        corpus={corpus}
        fromAyah={ayah}
        onTap={onTap}
        onDone={async () => {
          // Birth the connection atom in the durable log (invariant #2).
          await append(
            makeEvent({ type: "connection_born", ts: Date.now(), surah: SURAH, ayah, rung: "S4", to: ayah + 1 }),
          );
          setPhase("chain");
        }}
      />
    );
  }

  if (phase === "chain" && hasNext) {
    return (
      <div className="screen">
        <ChainDrill
          corpus={corpus}
          fromAyah={ayah}
          toAyah={ayah + 1}
          onTap={onTap}
          onComplete={async (results: ChainStepResult[]) => {
            // FIRe: emit a chain_step event per traversed atom.
            for (const r of results) {
              const stepAyah = r.step.kind === "ayah" ? r.step.ref : r.step.from;
              await append(
                makeEvent({
                  type: "chain_step",
                  ts: Date.now(),
                  surah: SURAH,
                  ayah: stepAyah,
                  rung: "S4",
                  stepKind: r.step.kind,
                  to: r.step.kind === "junction" ? r.step.to : undefined,
                  correct: r.correct,
                }),
              );
            }
            setPhase("done");
          }}
        />
      </div>
    );
  }

  if (phase === "done" || ayahComplete || "done" in item) {
    const verse = corpus.verses.find((v) => v.ayah === ayah);
    return (
      <div className="screen">
        <div className="card">
          <div className="card-header">
            <span>Learn 12:{ayah}</span>
            <span>encoded + bridged</span>
          </div>
          <div className="ayah ayah--display">{verse?.text_uthmani}</div>
          <div className="banner banner--ok">
            <p>Ayah 12:{ayah} encoded, and its link to 12:{ayah + 1} was reviewed.</p>
            <p className="sub">Its cold gate is set for your next day. A new day begins at your daily anchor.</p>
          </div>
          <button
            className="btn btn--primary"
            disabled={finishing}
            onClick={() => {
              setFinishing(true);
              onComplete();
            }}
          >
            Done for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      {item.rung === "S1" && (
        <S1Meaning
          item={item}
          feedback={feedback}
          onSubmit={submitAndTouch}
          onProceed={proceed}
          committing={committing}
        />
      )}
      {item.rung === "S2" && (
        <S2Fill
          item={item}
          feedback={feedback}
          onSubmit={submitAndTouch}
          onProceed={proceed}
          committing={committing}
        />
      )}
      {item.rung === "S3" && (
        <S3WholeBank
          item={item}
          feedback={feedback}
          onSubmit={submitAndTouch}
          committing={committing}
        />
      )}
    </div>
  );
}

// Drives the S4 bridge meaning items for fromAyah → fromAyah+1, committing each
// answered item, then births the connection via onDone.
function BridgePhase({
  corpus,
  fromAyah,
  onTap,
  onDone,
}: {
  corpus: Corpus;
  fromAyah: number;
  onTap: () => void;
  onDone: () => void | Promise<void>;
}) {
  const items = bridgeItems(corpus, fromAyah);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<{ choice: string; correct: boolean } | null>(null);
  const [committing, setCommitting] = useState(false);
  const current = items[idx];

  if (!current) {
    // All bridge items answered — S4 rung complete → birth the connection.
    return (
      <div className="screen">
        <div className="card">
          <p className="caption">Linking to 12:{fromAyah + 1}…</p>
        </div>
      </div>
    );
  }

  const submit = async (choice: string) => {
    if (committing || feedback) return;
    onTap();
    setCommitting(true);
    const correct = choice === current.correct;
    await append(
      makeEvent({
        type: "tap",
        ts: Date.now(),
        surah: SURAH,
        ayah: current.toAyah,
        rung: "S4",
        position: current.word.position,
        choice,
        correct,
      }),
    );
    setCommitting(false);
    setFeedback({ choice, correct });
  };

  const proceed = async () => {
    setFeedback(null);
    if (idx + 1 >= items.length) {
      // Emit the S4 rung_complete then birth the connection.
      await append(
        makeEvent({ type: "rung_complete", ts: Date.now(), surah: SURAH, ayah: current.toAyah, rung: "S4" }),
      );
      await onDone();
    } else {
      setIdx(idx + 1);
    }
  };

  return (
    <div className="screen">
      <S4Bridge
        item={current}
        feedback={feedback ? { position: current.word.position, ...feedback } : null}
        onSubmit={submit}
        onProceed={proceed}
        committing={committing}
      />
    </div>
  );
}
