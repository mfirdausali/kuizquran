"use client";

// TODAY — the dashboard's route into the session, and the honest due count
// beside it. WIREFRAME §1 / §12, edge cases #72 and #73.
//
// ---------------------------------------------------------------------------
// WHAT THIS COMPONENT IS ALLOWED TO DECIDE: NOTHING
// ---------------------------------------------------------------------------
// It reads the enrollment, loads a corpus, hands both to
// `lib/home/queue.ts#buildHomeSurah`, and paints the row that comes back. It
// performs no queue assembly, no band test and no strength comparison —
// `check-boundaries.mjs` clause 5 fails the build if any of those appear under
// `components/`, and the regex matches the TOKEN, so even importing
// `assembleQueue` here would be a violation. That is what keeps
// DEFECTS.md#B2 impossible by construction rather than merely fixed once.
//
// In particular it never decides how many items are due. `buildHomeSurah`
// returns `dueLabel` already written; this file prints it.
//
// ---------------------------------------------------------------------------
// WHY IT DOES NOT ACQUIRE THE WRITE LOCK, AND DOES NOT CALL `startSession`
// ---------------------------------------------------------------------------
// `SessionIsland` acquires the writer lock because it APPENDS. This surface is
// read-only, and a dashboard that grabbed the lock would leave the learner's
// own /session tab a non-writer — the drill would refuse to run, and the cause
// would be the page they opened it from.
//
// It also calls `assembleFor`, never `startSession`: `startSession` appends a
// `session_start`, and a dashboard that emitted one would fabricate a session
// the learner never opened and shift the window every summary is measured in.
//
// ---------------------------------------------------------------------------
// FOUR STATES, AND A SKELETON IS NEVER A ZERO (#73)
// ---------------------------------------------------------------------------
// A due count is the most dangerous number on this surface. "Nothing due
// today" painted while the log is still being read is the exact
// retention-honesty violation the boundary exists for, so `loading` paints a
// skeleton carrying NO DIGIT, and `unavailable` (no corpus) is its OWN state,
// distinct from a due count of zero. A learner cannot tell a missing corpus
// from a finished day out of one shared empty state, and those need different
// responses.
//
// NO ARABIC. The row is labelled from `surahLabel()` — Latin metadata only.

import { useEffect, useState } from "react";
import Link from "next/link";

import { readChoices } from "@/lib/onboarding/choices";
import { ONBOARDING_HREF } from "@/lib/onboarding/surahs";
import { fetchCorpus } from "@/lib/corpus/client";
import { buildHomeSurah, type HomeSurahRow } from "@/lib/home/queue";

type State =
  | { kind: "loading" }
  | { kind: "not-enrolled" }
  | { kind: "unavailable"; surah: number }
  | { kind: "broken"; message: string }
  | { kind: "ready"; row: HomeSurahRow };

export function TodaySession() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const choices = await readChoices();
        if (!alive) return;

        // A learner who has not onboarded has no enrollment. That is not an
        // error, and it must not be papered over by defaulting to some surah:
        // enrolling someone in scripture they did not choose is the wrong
        // failure. They are sent to onboarding instead.
        if (!choices || typeof choices.surah !== "number") {
          setState({ kind: "not-enrolled" });
          return;
        }
        const surah = choices.surah;

        const corpus = await fetchCorpus(surah);
        if (!alive) return;
        if (!corpus) {
          setState({ kind: "unavailable", surah });
          return;
        }

        // The clock is captured HERE and passed in. The engine never reaches
        // for `Date.now()` (invariant 5) and neither does `lib/home/queue.ts`;
        // supplying it is the frontend's job.
        const row = await buildHomeSurah({ surah, corpus, now: Date.now() });
        if (!alive) return;
        if (!row) {
          setState({ kind: "unavailable", surah });
          return;
        }
        setState({ kind: "ready", row });
      } catch (err) {
        // A thrown read must show a state, never leave the learner on a
        // skeleton. An eternal skeleton is indistinguishable from a hang, and
        // it is also indistinguishable from "nothing due" — which is precisely
        // the conflation this surface must not make.
        if (!alive) return;
        setState({
          kind: "broken",
          message:
            err instanceof Error ? err.message : "Your schedule could not be read.",
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  switch (state.kind) {
    case "loading":
      // #73: a skeleton, and NO DIGIT anywhere on screen. "Nothing due today"
      // shown to a learner who has four items is the violation this exists for.
      return (
        <p className="caption">
          <span className="skel" aria-hidden="true" />{" "}
          <span className="sr-only">Working out what is due today…</span>
          working out what is due today…
        </p>
      );

    case "not-enrolled":
      // No CTA into a session there is no enrollment for (§12).
      return (
        <p className="caption">
          You haven&apos;t started a surah yet.{" "}
          <Link href={ONBOARDING_HREF}>Choose one</Link> to begin.
        </p>
      );

    case "unavailable":
      // Its OWN sentence. Not a zero, not a skeleton — this is a failure, and
      // saying "nothing due" here would tell a learner their work is finished
      // when in fact the app cannot see it.
      return (
        <p className="caption">
          This surah is not available on this device yet. Reconnect once and
          reload to fetch it.
        </p>
      );

    case "broken":
      return (
        <div className="banner banner--warn" role="alert">
          <p>Today&apos;s schedule could not be worked out on this device.</p>
          <p className="sub">
            Reason: <code>{state.message}</code>. Nothing has been lost — the log
            is append-only and the schedule is re-derived from it every time.
          </p>
        </div>
      );

    case "ready": {
      const { row } = state;
      return (
        <div className="stack stack--tight" data-testid="today-session">
          <p className="voice">
            {row.label}
            {/* FR9's quiet streak (the landing FAQ's own claim, backed for
                real). `null` when there is nothing to show yet — see
                `HomeSurahRow.streakLabel`'s doc comment. Already a finished
                sentence fragment; nothing is counted here. */}
            {row.streakLabel ? (
              <>
                {" "}
                <span className="pill-streak">{row.streakLabel}</span>
              </>
            ) : null}
          </p>
          {/* Already a sentence when it arrived. Nothing is counted here. */}
          <p className="caption">{row.dueLabel}</p>
          {row.ctaEnabled ? (
            <Link href={row.ctaHref} className="btn hit">
              {row.ctaLabel}
            </Link>
          ) : (
            // Nothing due is SUCCESS, and it gets words that say so rather
            // than a disabled button implying something went wrong.
            <p className="caption">
              You are up to date. Come back tomorrow — the schedule spaces this
              on purpose, and doing more today would not make it stick harder.
            </p>
          )}
        </div>
      );
    }
  }
}
