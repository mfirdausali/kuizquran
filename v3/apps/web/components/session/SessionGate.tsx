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

type State =
  | { kind: "loading" }
  | { kind: "not-enrolled" }
  | { kind: "ready"; surah: number };

export function SessionGate() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const choices = await readChoices();
      if (!alive) return;
      setState(
        choices && typeof choices.surah === "number"
          ? { kind: "ready", surah: choices.surah }
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
        <Link href="/onboarding">Choose one</Link> to begin.
      </p>
    );
  }

  return <SessionIsland surah={state.surah} />;
}
