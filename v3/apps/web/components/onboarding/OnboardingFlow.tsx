"use client";

// THE SEVEN SCREENS (WIREFRAME §17), as one state machine.
//
// | # | Screen              | Skippable        | Captures            |
// |---|---------------------|------------------|---------------------|
// | 1 | The honest promise  | no (~5s)         | nothing             |
// | 2 | First recall        | no (~45s)        | NOTHING             |
// | 3 | Gloss language      | no, one tap      | glossLang           |
// | 4 | Placement probe     | YES, default fresh | placement priors  |
// | 5 | Choose your surah   | no, pre-selected | surah               |
// | 6 | Pace                | no, pre-selected | pace                |
// | 7 | First real session  | —                | commits all four    |
//
// ---------------------------------------------------------------------------
// WHAT THIS COMPONENT REFUSES TO DO
// ---------------------------------------------------------------------------
// It asks four questions because four answers change what the engine does
// tomorrow. It asks nothing else. §17: "if a question doesn't change what the
// engine does tomorrow, it isn't asked." Every screen below either feeds a
// named engine input or feeds nothing and asks nothing.
//
// Screens 1 and 2 write NOTHING — no field, no event, no meta key, not even a
// "started onboarding" timestamp. `check-boundaries.mjs` clause 8 enforces the
// no-identity-capture half structurally; the no-write half is enforced by there
// being no writer on this path until `commitOnboarding` at screen 7.
//
// ---------------------------------------------------------------------------
// PRE-SELECTED IS NOT PRE-DECIDED
// ---------------------------------------------------------------------------
// Screens 5 and 6 arrive with a default already chosen, per §17 ("no,
// pre-selected"). The default is a real, defensible choice the learner can
// accept with one tap — not a dark pattern that hides the alternatives. Every
// option stays visible, and the cost of each is stated before the tap, not
// after.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GlossLang } from "@engine/types.ts";
import { DEFAULT_PACE_MODE, paceConfig, type PaceMode } from "@engine/pace.ts";
import { FirstRecall } from "./FirstRecall";
import {
  commitOnboarding,
  defaultGlossLang,
  type OnboardingChoices,
  type PlacementOutcome,
} from "@/lib/onboarding/choices";
import { OFFERED_SURAHS, DEFAULT_SURAH, surahLabel } from "@/lib/onboarding/surahs";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEP_COUNT = 7;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // The four answers. Held here, committed once, at screen 7.
  const [glossLang, setGlossLang] = useState<GlossLang>("en");
  const [placement, setPlacement] = useState<PlacementOutcome>({ kind: "skipped" });
  const [surah, setSurah] = useState<number>(DEFAULT_SURAH);
  const [pace, setPace] = useState<PaceMode>(DEFAULT_PACE_MODE);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  // §17 screen 3: "Default = device locale." Read once on mount — a default is
  // a starting position for a control the learner still has to tap, never a
  // decision made on their behalf.
  useEffect(() => {
    setGlossLang(defaultGlossLang());
  }, []);

  const go = useCallback((next: Step) => setStep(next), []);

  const finish = useCallback(async () => {
    setCommitting(true);
    setCommitError(null);
    const choices: OnboardingChoices = { glossLang, surah, pace, placement };
    try {
      // The FIRST and ONLY write of the whole flow.
      await commitOnboarding(choices, Date.now());
      router.replace("/home");
    } catch {
      // A device that cannot store the choices cannot run a schedule, and
      // pretending otherwise would strand the learner on a dashboard with no
      // enrollment. Say so, and let them retry.
      setCommitting(false);
      setCommitError(
        "Your choices could not be saved on this device. Private browsing blocks storage — reopen in a normal window and try again.",
      );
    }
  }, [glossLang, surah, pace, placement, router]);

  return (
    <div className="stack">
      <Progress step={step} />

      {step === 1 ? <ScreenPromise onNext={() => go(2)} /> : null}

      {step === 2 ? (
        <ScreenFirstRecall onNext={() => go(3)} />
      ) : null}

      {step === 3 ? (
        <ScreenGloss
          value={glossLang}
          onChoose={(lang) => {
            setGlossLang(lang);
            go(4);
          }}
          onBack={() => go(2)}
        />
      ) : null}

      {step === 4 ? (
        <ScreenPlacement
          onSkip={() => {
            setPlacement({ kind: "skipped" });
            go(5);
          }}
          onAnswer={(outcome) => {
            setPlacement(outcome);
            go(5);
          }}
          onBack={() => go(3)}
        />
      ) : null}

      {step === 5 ? (
        <ScreenSurah
          value={surah}
          onChoose={setSurah}
          onNext={() => go(6)}
          onBack={() => go(4)}
        />
      ) : null}

      {step === 6 ? (
        <ScreenPace
          value={pace}
          surah={surah}
          onChoose={setPace}
          onNext={() => go(7)}
          onBack={() => go(5)}
        />
      ) : null}

      {step === 7 ? (
        <ScreenFirstSession
          glossLang={glossLang}
          surah={surah}
          pace={pace}
          placement={placement}
          committing={committing}
          error={commitError}
          onFinish={() => void finish()}
          onBack={() => go(6)}
        />
      ) : null}
    </div>
  );
}

/** Where the learner is, stated plainly. Seven screens is short enough to name
 *  the number honestly — hiding the length of a flow is how a "two-minute
 *  setup" becomes nine screens of profiling. */
function Progress({ step }: { step: Step }) {
  return (
    <p className="caption" aria-live="polite">
      Step {step} of {STEP_COUNT}
    </p>
  );
}

// ---------------------------------------------------------------------------
// SCREEN 1 — THE HONEST PROMISE (~5s, not skippable, no carousel)
// ---------------------------------------------------------------------------
// §17: "Sets the retention frame so gates/calendar/half-life read as coherent
// later." This screen exists so that when the app later says "you'd forget half
// of this in 9 days" or refuses to unlock a new ayah, those behaviours read as
// the promise being KEPT rather than as the app being difficult.
//
// It captures nothing and it does not oversell. No carousel, per §17.
function ScreenPromise({ onNext }: { onNext: () => void }) {
  return (
    <section className="card" aria-labelledby="promise-h">
      <div className="card-header">
        <span id="promise-h">What this app is</span>
      </div>
      <p className="voice">Memorising is the easy half. Keeping it is the half that fails.</p>
      <p className="caption">
        This app schedules your review around the moment you are about to
        forget, and it will tell you the truth about what you are holding — even
        when the truth is that a surah you finished last year is mostly gone.
      </p>
      <p className="caption">
        It means some days it will hold back a new ayah until yesterday&apos;s
        has survived a night. That is the whole mechanism, and it is the reason
        the app is worth using.
      </p>
      <button type="button" className="btn btn--primary hit" onClick={onNext}>
        Show me
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SCREEN 2 — FIRST RECALL, IMMEDIATELY (~45s). THE CRUX.
// ---------------------------------------------------------------------------
// The whole screen is `<FirstRecall/>`, which drives the REAL engine and the
// REAL quiz components. See that file for the three passes and for why pass 1
// shows the ayah before any recall is asked.
//
// Nothing is captured here. Not a tap, not a timing, not an event.
function ScreenFirstRecall({ onNext }: { onNext: () => void }) {
  const [produced, setProduced] = useState(false);
  return (
    <>
      <header className="page-head">
        <h1>Try it now</h1>
        <p className="caption">
          No account, nothing to fill in. Four words you almost certainly
          already know.
        </p>
      </header>
      <FirstRecall
        onProduced={() => setProduced(true)}
        continueLabel={produced ? "Set it up for a whole surah" : undefined}
      />
      {produced ? (
        <button type="button" className="btn btn--primary hit" onClick={onNext}>
          Continue
        </button>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// SCREEN 3 — GLOSS LANGUAGE (one tap)
// ---------------------------------------------------------------------------
// Consumed by `corpus.ts#wordGloss(word, lang)`. This is asked because it
// changes every meaning question the learner will ever see.
//
// THE HONEST CAVEAT (v3-D15, and verified against the compiled corpus): MS
// glosses are not authored for the launch surahs yet — every one of 112's 15
// words has `gloss.ms === null`. `wordGloss` falls back `ms → en → the word
// itself`, so choosing MS today yields English glosses, and the screen says so
// rather than letting the learner discover it mid-session. The preference is
// still recorded, because it is what the MS content ships INTO.
function ScreenGloss({
  value,
  onChoose,
  onBack,
}: {
  value: GlossLang;
  onChoose: (lang: GlossLang) => void;
  onBack: () => void;
}) {
  return (
    <section className="card" aria-labelledby="gloss-h">
      <div className="card-header">
        <span id="gloss-h">Word meanings in</span>
      </div>
      <p className="caption">
        Which language should word-by-word meanings appear in? You can change
        this later.
      </p>
      <div className="stack stack--tight">
        <button
          type="button"
          className={value === "en" ? "btn btn--primary hit" : "btn hit"}
          onClick={() => onChoose("en")}
        >
          English
        </button>
        <button
          type="button"
          className={value === "ms" ? "btn btn--primary hit" : "btn hit"}
          onClick={() => onChoose("ms")}
        >
          Bahasa Melayu
        </button>
      </div>
      <p className="caption">
        Malay glosses are still being written. Choose it and we will record the
        preference, but until that work lands you will see the English gloss —
        we would rather say so now than surprise you in a session.
      </p>
      <button type="button" className="btn btn--ghost hit" onClick={onBack}>
        Back
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SCREEN 4 — PLACEMENT PROBE (SKIPPABLE, default fresh)
// ---------------------------------------------------------------------------
// §17: "3 narrative-landmark probes seed FSRS priors as 'known but unstable'."
// It exists so a returning hafiz is not marched from ayah 1 through material
// they already carry.
//
// WHAT THIS BUILD CAN HONESTLY DO. `placement.ts` binary-searches over
// `actLandmarks(corpus)`, which reads `corpus.sceneBeats`. Verified against the
// compiled corpus: surah 12 carries 19 scene beats, but 112 and 103 carry ZERO
// — and 112/103 are the surahs this build can actually serve to a learner. A
// 4-ayah surah has no narrative landmarks to binary-search between, and
// inventing three would be fabricating the exact "structure" the probe claims
// to measure.
//
// So this screen asks the ONE question it can answer honestly — have you
// memorised this before? — and treats it as what §17 calls it: a PRIOR, not a
// score. The three-probe binary search lands with the surahs that have scene
// beats. The screen does not pretend to run it, and the skip path is the
// documented default rather than a consolation.
function ScreenPlacement({
  onSkip,
  onAnswer,
  onBack,
}: {
  onSkip: () => void;
  onAnswer: (outcome: PlacementOutcome) => void;
  onBack: () => void;
}) {
  return (
    <section className="card" aria-labelledby="placement-h">
      <div className="card-header">
        <span id="placement-h">Have you memorised before?</span>
        <span>optional</span>
      </div>
      <p className="caption">
        If you already carry some of this, the schedule can start you where you
        actually are instead of at the first ayah.
      </p>
      <div className="stack stack--tight">
        <button
          type="button"
          className="btn hit"
          onClick={() => onAnswer({ kind: "fresh" })}
        >
          Starting fresh
        </button>
        <button
          type="button"
          className="btn hit"
          onClick={() => onAnswer({ kind: "carried", throughAct: 0, probed: 0 })}
        >
          I memorised this before, but it has faded
        </button>
      </div>
      <p className="caption">
        Either answer only sets a starting assumption. The app corrects it from
        your first few sessions — what you actually recall always outranks what
        either of us guessed here.
      </p>
      <div className="stack stack--tight">
        <button type="button" className="btn btn--ghost hit" onClick={onSkip}>
          Skip this
        </button>
        <button type="button" className="btn btn--ghost hit" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SCREEN 5 — CHOOSE YOUR SURAH (pre-selected). "The learner's one real choice."
// ---------------------------------------------------------------------------
// §17's default is Al-Mulk (30 ayat, ~5 weeks). VERIFIED AGAINST THE COMPILED
// CORPUS: this build has 12, 103 and 112 and NOT 67 — so offering Al-Mulk here
// would enroll a learner in a surah the app cannot serve one ayah of. The
// offered list is derived from what is actually compiled (see
// lib/onboarding/surahs.ts), and the default is the shortest complete one.
// When 67 compiles, it appears here by data, not by an edit to this JSX.
function ScreenSurah({
  value,
  onChoose,
  onNext,
  onBack,
}: {
  value: number;
  onChoose: (surah: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <section className="card" aria-labelledby="surah-h">
      <div className="card-header">
        <span id="surah-h">Which surah</span>
      </div>
      <p className="caption">
        This is the one real choice here. Pick something you want to hold for
        years, not something short.
      </p>
      <div className="stack stack--tight">
        {OFFERED_SURAHS.map((s) => (
          <button
            key={s.surah}
            type="button"
            className={value === s.surah ? "btn btn--primary hit" : "btn hit"}
            onClick={() => onChoose(s.surah)}
            aria-pressed={value === s.surah}
          >
            {surahLabel(s)}
          </button>
        ))}
      </div>
      <p className="caption">
        Only surahs this build has finished preparing are listed. You can add
        another one later from the Library — it will show you what that costs
        your daily time before you commit.
      </p>
      <div className="stack stack--tight">
        <button type="button" className="btn btn--primary hit" onClick={onNext}>
          Continue
        </button>
        <button type="button" className="btn btn--ghost hit" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SCREEN 6 — PACE (pre-selected, with the load stated)
// ---------------------------------------------------------------------------
// Consumed by `pace.ts#paceConfig(mode)`: budgetMin, newAyahCeiling and
// gateTolerance. Every number shown below comes FROM that function — the view
// reads the engine's own config rather than restating it, so a pace change in
// the engine cannot leave a stale promise on this screen.
function ScreenPace({
  value,
  surah,
  onChoose,
  onNext,
  onBack,
}: {
  value: PaceMode;
  surah: number;
  onChoose: (pace: PaceMode) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const modes: PaceMode[] = ["steady", "sprint", "maintain"];
  const chosen = useMemo(() => OFFERED_SURAHS.find((s) => s.surah === surah), [surah]);

  return (
    <section className="card" aria-labelledby="pace-h">
      <div className="card-header">
        <span id="pace-h">How fast</span>
      </div>
      <p className="caption">
        This sets your daily minutes and how many new ayat you can take on. It
        is changeable any time.
      </p>
      <div className="stack stack--tight">
        {modes.map((mode) => {
          // The engine's own config — never a hardcoded duplicate of it.
          const cfg = paceConfig(mode);
          return (
            <button
              key={mode}
              type="button"
              className={value === mode ? "btn btn--primary hit" : "btn hit"}
              onClick={() => onChoose(mode)}
              aria-pressed={value === mode}
            >
              <PaceLabel mode={mode} minutes={cfg.budgetMin} ceiling={cfg.newAyahCeiling} />
            </button>
          );
        })}
      </div>
      <PaceLoad
        mode={value}
        minutes={paceConfig(value).budgetMin}
        ceiling={paceConfig(value).newAyahCeiling}
        ayat={chosen?.ayahCount ?? null}
      />
      <div className="stack stack--tight">
        <button type="button" className="btn btn--primary hit" onClick={onNext}>
          Continue
        </button>
        <button type="button" className="btn btn--ghost hit" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}

function PaceLabel({
  mode,
  minutes,
  ceiling,
}: {
  mode: PaceMode;
  minutes: number;
  ceiling: number;
}) {
  const name = mode === "steady" ? "Steady" : mode === "sprint" ? "Sprint" : "Maintain";
  return (
    <span>
      {name} · about {minutes} min a day ·{" "}
      {ceiling === 0
        ? "no new ayat, review only"
        : `up to ${ceiling} new ayah${ceiling === 1 ? "" : "s"} a day`}
    </span>
  );
}

/**
 * §17 screen 6 asks for "a live 7-day load strip". What is shown here is the
 * part that can be stated HONESTLY before any enrollment exists: the daily
 * budget and the new-ayah ceiling, both read from `paceConfig`, and the
 * resulting horizon when a ceiling and an ayah count are both known.
 *
 * A seven-bar strip is NOT drawn, and the omission is deliberate. Before the
 * first session there are no atoms, so there are no review obligations, so
 * every bar past day 1 would be a shape invented to look informative. WIREFRAME
 * §14's own honesty rule for forecasts is that confidence decays with distance;
 * a strip drawn from zero evidence has no confidence at all. The real strip
 * belongs on the plan calendar, which has atoms behind it.
 */
function PaceLoad({
  mode,
  minutes,
  ceiling,
  ayat,
}: {
  mode: PaceMode;
  minutes: number;
  ceiling: number;
  ayat: number | null;
}) {
  if (mode === "maintain") {
    return (
      <p className="caption">
        Maintain takes on nothing new — about {minutes} minutes a day of review,
        holding what you already have.
      </p>
    );
  }
  if (ayat === null || ceiling === 0) {
    return (
      <p className="caption">
        About {minutes} minutes a day.
      </p>
    );
  }
  // The ceiling is a CEILING, not a rate: the gate can and will hold a day
  // back. Stating it as "at best" is the difference between a plan and a promise
  // the scheduler never made.
  const bestCaseDays = Math.ceil(ayat / ceiling);
  return (
    <p className="caption">
      About {minutes} minutes a day. At best that is {bestCaseDays} day
      {bestCaseDays === 1 ? "" : "s"} of new material for {ayat} ayat — longer in
      practice, because a new ayah waits until the previous one has survived a
      night. We will never shorten that estimate to flatter you.
    </p>
  );
}

// ---------------------------------------------------------------------------
// SCREEN 7 — FIRST REAL SESSION. The commit point.
// ---------------------------------------------------------------------------
// §17: "Cold gate armed. ONLY NOW does the app ask for notifications or an
// account."
//
// AND THIS BUILD ASKS FOR NEITHER, YET. Auth exists (v2-D03 anonymous-first)
// but the account-adoption surface is not built at this step, and a
// notification prompt fired here would be the exact dark pattern §17 is written
// against. What screen 7 does is SUMMARISE the four answers and commit them.
// The account offer belongs where the learner has something to lose — after
// real sessions, not before the first one.
//
// This is also why `@allow-identity-capture` is NOT on this file: it captures
// no identity. The marker exists for a surface that legitimately does, and
// adding it pre-emptively would be a hole waiting for someone to fill.
function ScreenFirstSession({
  glossLang,
  surah,
  pace,
  placement,
  committing,
  error,
  onFinish,
  onBack,
}: {
  glossLang: GlossLang;
  surah: number;
  pace: PaceMode;
  placement: PlacementOutcome;
  committing: boolean;
  error: string | null;
  onFinish: () => void;
  onBack: () => void;
}) {
  const chosen = OFFERED_SURAHS.find((s) => s.surah === surah);
  return (
    <section className="card" aria-labelledby="ready-h">
      <div className="card-header">
        <span id="ready-h">Ready</span>
      </div>
      <p className="caption">This is everything the app knows about you:</p>
      <ul className="stack stack--tight" style={{ margin: 0, paddingInlineStart: "1.1rem" }}>
        <li className="caption">
          Surah: {chosen ? surahLabel(chosen) : surah}
        </li>
        <li className="caption">
          Word meanings: {glossLang === "en" ? "English" : "Bahasa Melayu"}
        </li>
        <li className="caption">
          Pace: {pace} · about {paceConfig(pace).budgetMin} minutes a day
        </li>
        <li className="caption">
          {/* v3-D19: the app never tells the learner they HAVE memorised
              something. This line reports what THEY said, as their report —
              which is all a placement prior ever was. */}
          Starting point:{" "}
          {placement.kind === "carried"
            ? "you said you worked on this before"
            : placement.kind === "fresh"
              ? "starting fresh"
              : "not asked"}
        </li>
      </ul>
      <p className="caption">
        No email, no password, no notifications — none of that has been asked
        for and none of it is needed to start. Everything so far lives on this
        device.
      </p>

      {error ? (
        <div className="banner banner--warn" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn--primary hit"
        onClick={onFinish}
        disabled={committing}
      >
        {committing ? "Saving…" : "Start my first session"}
      </button>
      <button
        type="button"
        className="btn btn--ghost hit"
        onClick={onBack}
        disabled={committing}
      >
        Back
      </button>
    </section>
  );
}
