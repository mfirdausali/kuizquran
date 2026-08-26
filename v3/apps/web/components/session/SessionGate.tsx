"use client";

// WHICH SURAH THIS SESSION DRILLS — read from the enrollment, never guessed.
//
// The enrollment lives in IndexedDB (written once by `commitOnboarding`), so it
// can only be read on the client. This component is that read, kept separate
// from `SessionIsland` so the island takes its surah as a plain prop and stays
// trivially testable without a database.
//
// A learner who has not onboarded has no enrollment. That is not an error and
// must not be papered over by defaulting to some surah — enrolling someone in
// scripture they did not choose is the wrong failure. They are sent to
// onboarding instead.

import { useEffect, useState } from "react";
import Link from "next/link";

import { readChoices } from "@/lib/onboarding/choices";
import { SessionIsland } from "@/components/session/SessionIsland";
import { ONBOARDING_HREF } from "@/lib/onboarding/surahs";
import type { SessionMode } from "@/lib/session/run";
import type { DrillSpec } from "@/lib/drill/handoff";
import type { PracticeSpec } from "@/lib/practice/handoff";
import { DEFAULT_PACE_MODE, type PaceMode } from "@engine/pace.ts";

type State =
  | { kind: "loading" }
  | { kind: "not-enrolled" }
  | { kind: "ready"; surah: number; pace: PaceMode };

export interface SessionGateProps {
  /** Which queue to drill — the ordinary daily assembly, or FR9's floor
   *  session. Read from `/session`'s own `?mode=` and passed straight down;
   *  this component decides nothing about it. */
  mode?: SessionMode;
  /** Step 20 — a continuous drill request from `/drill` (`?drill=range|page`),
   *  or null for an ordinary session. Passed straight down; the surah is still
   *  the enrolled one this gate reads, so a drill runs within the surah the
   *  learner is actually enrolled in. */
  drill?: DrillSpec | null;
  /** FR6 Door 3 — an open-practice request from `/practice`
   *  (`?practice=1&ayah=&drill=`), or null for an ordinary session. Passed
   *  straight down for the same reason `drill` is: the surah stays the
   *  enrolled one this gate reads. */
  practice?: PracticeSpec | null;
}

export function SessionGate({ mode = "full", drill = null, practice = null }: SessionGateProps) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const choices = await readChoices();
      if (!alive) return;
      setState(
        choices && typeof choices.surah === "number"
          ? { kind: "ready", surah: choices.surah, pace: choices.pace ?? DEFAULT_PACE_MODE }
          : { kind: "not-enrolled" },
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.kind === "loading") {
    return <p className="caption">Loading your enrollment…</p>;
  }

  if (state.kind === "not-enrolled") {
    return (
      <p className="caption">
        You haven&apos;t started a surah yet.{" "}
        {/* `/onboarding` is NOT a route: the `(onboarding)` route group
            contributes no URL segment, so onboarding lives at `/start`. The
            link here pointed at a 404 — a learner with no enrollment was sent
            from the one screen that noticed to a page that does not exist. */}
        <Link href={ONBOARDING_HREF}>Choose one</Link> to begin.
      </p>
    );
  }

  return (
    <SessionIsland surah={state.surah} pace={state.pace} mode={mode} drill={drill} practice={practice} />
  );
}
